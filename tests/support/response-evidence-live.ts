/** Real-model regression with synthetic questions/answers only; no database or saved user material. */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { config as dotenv } from 'dotenv';
import {
  interviewPolicy,
  INTERVIEW_POLICY_VERSION,
  type InterviewSnapshot,
  type InterviewTurn,
  type InterviewConfig,
} from '@interviewlab/core';
import { loadConfig } from '../../code/backend/src/foundation/config';
import { ServiceError } from '../../code/backend/src/foundation/errors';
import { createInterviewAgent } from '../../code/backend/src/modules/interviews/agent';
import { createAllRoleKnowledge } from '../../code/backend/src/modules/knowledge/all-roles';
import { planningRoleContext } from '../../code/backend/src/modules/knowledge/catalog';
import { newInterviewState } from '../../code/backend/src/modules/interviews/repository';

async function main() {
  dotenv({ quiet: true });
  const config = loadConfig({
    NODE_ENV: 'test',
    LLM_API_KEY: process.env.LLM_API_KEY,
    LLM_BASE_URL: process.env.LLM_BASE_URL,
    LLM_MODEL: process.env.LLM_MODEL,
    LLM_OUTPUT_MODE:
      process.argv.find((arg) => arg.startsWith('--mode='))?.slice(7) ?? 'json_schema',
  });
  if (!config.LLM_API_KEY) throw new Error('Real model configuration required');
  const knowledge = createAllRoleKnowledge(config);
  const agent = createInterviewAgent(config, (event) => {
    if (process.argv.includes('--debug')) console.log(JSON.stringify(event));
  });
  const records: object[] = [];
  const setup = async (type: InterviewConfig['interview_type'] = 'technical_qa') => {
    const state = newInterviewState('synthetic-response-qa', {
      job: 'frontend',
      career_stage: 'internship',
      interview_type: type,
      difficulty: '基础',
      duration_minutes: 10,
      interviewer_style: '标准',
      interaction_mode: 'text_fallback',
    });
    state.view.status = 'in_progress';
    state.view.started_at = new Date().toISOString();
    state.view.target_at = new Date(Date.now() + 600000).toISOString();
    const k = await knowledge.read(state.view.configuration);
    const policy = interviewPolicy(state.view.configuration);
    const snapshot: InterviewSnapshot = {
      job_title: '前端开发',
      model: config.LLM_MODEL,
      runtime_version: 'graph-v1',
      knowledge: k,
      prompt_version: INTERVIEW_POLICY_VERSION,
      rubric_version: 'evidence-uncalibrated-v1',
      interview_type: type,
      scoring_evidence_version: 'candidate-answer-v1',
      preparation_plan: {
        policy,
        role_context: planningRoleContext(state.view.configuration),
        goals: policy.themes.map((t) => ({ goal: t.goal, focus: t.purpose, material_refs: [] })),
        limitations: [],
      },
    };
    return { state, snapshot };
  };
  const turn = (
    question: string,
    answer: string,
    stage: InterviewTurn['stage'],
  ): InterviewTurn => ({
    id: randomUUID(),
    text: question,
    topic: stage === 'introduction' ? '自我介绍' : '专业基础',
    purpose: stage === 'introduction' ? '了解学习背景与求职方向' : '考察数据结构的查询复杂度',
    stage,
    acknowledgement: '',
    knowledge_question_id: null,
    source_refs: [],
    evidence_refs: [],
    main_question_index: 1,
    follow_up_index: 0,
    generation_id: randomUUID(),
    answer_status: 'answered',
    answer_text: answer,
    revision: 1,
    input_mode: 'text_fallback',
    presented_at: new Date().toISOString(),
    answered_at: new Date().toISOString(),
  });
  let failed = 0;
  async function check(name: string, run: () => Promise<object>) {
    const filter = process.argv.find((arg) => arg.startsWith('--case='))?.slice(7);
    if (filter && !name.includes(filter)) return;
    try {
      const result = await run();
      records.push({ name, passed: true, ...result });
      console.log(`${name}: passed`);
    } catch (error) {
      failed++;
      records.push({
        name,
        passed: false,
        error:
          error instanceof ServiceError
            ? error.code
            : error instanceof assert.AssertionError
              ? error.message
              : 'validation_failed',
      });
      console.log(`${name}: failed`);
    }
  }
  try {
    for (const type of ['technical_qa', 'hr'] as const) {
      await check(`${type}: greeting does not complete introduction`, async () => {
        const { state, snapshot } = await setup(type);
        state.view.turns = [turn('请介绍你的学习背景和求职方向。', '你好', 'introduction')];
        const result = await agent.advance(
          state.view,
          snapshot,
          false,
          new AbortController().signal,
          false,
          {
            memory: null,
            retrieval: {
              release: snapshot.knowledge.content_version,
              chunks: [],
              mode: 'empty',
              missing_reason: '定向回答资格检查',
            },
            preview: async () => {},
          },
        );
        assert.equal(result.memory?.response?.response_eligibility, 'non_answer');
        assert.ok(!result.memory?.introduction_complete);
        assert.equal(result.question?.stage, 'introduction');
        assert.equal(result.memory?.claims.length, 0);
        return { question: result.question?.text, response: result.memory?.response };
      });
    }
    await check('greeting receives no numerical scores or claimed strengths', async () => {
      const { snapshot } = await setup();
      const answer = turn('请介绍你的学习背景和求职方向。', '你好', 'introduction');
      const result = await agent.evaluate(answer, snapshot, new AbortController().signal, false);
      assert.equal(result.response_assessment?.response_eligibility, 'non_answer');
      assert.equal(result.feedback_assessments?.length, 0);
      assert.equal(result.strengths.length, 0);
      assert.equal(result.gaps.length, 0);
      return { assessment: result.response_assessment, scores: result.feedback_assessments };
    });
    await check(
      'self-description and waiting remarks do not demonstrate technical competence',
      async () => {
        const { snapshot } = await setup();
        const answer = turn(
          '请简要介绍学习背景和与岗位相关的经历。',
          '我学过计算机，想应聘前端开发。我精通HTML、CSS和JavaScript，做过很多项目。怎么还没回复，我等了一会儿。',
          'introduction',
        );
        answer.input_mode = 'voice';
        const result = await agent.evaluate(answer, snapshot, new AbortController().signal, false);
        assert.ok(result.feedback_assessments?.every((a) => a.dimension === 'communication'));
        assert.ok(
          result.response_assessments?.every((r) =>
            r.question_scope.dimensions.every((d) => d === 'communication'),
          ),
        );
        for (const finding of [...result.strengths, ...result.gaps])
          assert.ok(!/杂音|噪音|不耐烦|态度|影响专业性/.test(finding.text));
        return {
          assessment: result.response_assessment,
          scores: result.feedback_assessments,
          gaps: result.gaps,
        };
      },
    );
    await check('a short relevant complexity answer remains assessable', async () => {
      const { snapshot } = await setup();
      const answer = turn('哈希表按键查询的平均时间复杂度是多少？', 'O(1)', 'technical');
      const result = await agent.evaluate(answer, snapshot, new AbortController().signal, false);
      assert.equal(result.response_assessment?.response_eligibility, 'answer');
      assert.equal(result.response_assessment?.sufficiency, 'sufficient');
      assert.ok(
        result.feedback_assessments?.some(
          (a) => a.dimension === 'professional_foundation' && a.score >= 80,
        ),
      );
      assert.ok(
        !result.feedback_assessments?.some((a) =>
          [
            'project_reflection',
            'learning_initiative',
            'problem_solving',
            'communication',
          ].includes(a.dimension),
        ),
      );
      return { assessment: result.response_assessment, scores: result.feedback_assessments };
    });
    await check('an explicit knowledge limit is accepted without inventing mastery', async () => {
      const { snapshot } = await setup();
      const answer = turn(
        '哈希表按键查询的平均时间复杂度是多少？',
        '这个我还不知道。',
        'technical',
      );
      const result = await agent.evaluate(answer, snapshot, new AbortController().signal, false);
      assert.equal(result.response_assessment?.continuation, 'at_limit');
      assert.ok(
        result.feedback_assessments?.every(
          (a) => a.dimension !== 'professional_foundation' || a.score < 40,
        ),
      );
      return { assessment: result.response_assessment, scores: result.feedback_assessments };
    });
  } finally {
    await knowledge.close();
    await mkdir('tests/artifacts', { recursive: true });
    const artifact = `tests/artifacts/response-evidence-live-${Date.now()}.json`;
    await writeFile(
      artifact,
      JSON.stringify({ model: config.LLM_MODEL, mode: config.LLM_OUTPUT_MODE, records }, null, 2),
    );
    console.log(artifact);
  }
  if (failed) process.exitCode = 1;
}

void main().catch(() => {
  console.error('Real-model response regression could not start.');
  process.exitCode = 1;
});
