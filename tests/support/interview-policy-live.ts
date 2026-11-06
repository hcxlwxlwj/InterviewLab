/** Synthetic dialogue QA only: no database, saved resume, microphone or public index writes. */
import { config as dotenv } from 'dotenv';
import { mkdir, writeFile } from 'node:fs/promises';
import {
  ACTIVE_INTERVIEW_TYPES,
  interviewPolicy,
  interviewOpening,
  nextQuestionPosition,
  type InterviewMemory,
  type InterviewSnapshot,
  type InterviewTurn,
} from '@interviewlab/core';
import { loadConfig } from '../../code/backend/src/foundation/config';
import { createAllRoleKnowledge } from '../../code/backend/src/modules/knowledge/all-roles';
import { createWorkflowModels } from '../../code/backend/src/modules/interviews/workflow-models';
import { createInterviewAgent } from '../../code/backend/src/modules/interviews/agent';
import { newInterviewState } from '../../code/backend/src/modules/interviews/repository';
import { ServiceError } from '../../code/backend/src/foundation/errors';

const answers: Record<string, string> = {
  introduction:
    '我想应聘前端实习，学过JavaScript和React。课程项目是校园活动报名页面，本人负责表单校验和报名结果展示，需求访谈由同学负责。我希望把学过的知识用在真实用户任务上。',
  understanding:
    '表单中的必填和格式检查在前端做，提交结果以接口返回为准。我理解客户端检查不能替代服务端校验。',
  contribution: '我负责表单校验和报名结果展示，没有参与后端接口，也没有负责访谈。',
  verification:
    '我用空输入、错误格式和重复点击做测试，检查错误提示以及提交后页面展示，测试结果记在表格里。',
  tradeoffs:
    '时间只有一周，我先保证报名和结果确认能完成，动效放在后面，因为同学首先需要知道自己是否报名成功。',
  business:
    '目标是让同学完成报名并确认结果。我根据已有访谈结论把报名状态放到明显位置，不用收入作为课程项目目标。',
  collaboration: '我和负责接口的同学先约定返回字段，发现不一致时用一条实际请求核对，再更新约定。',
  learning:
    '第一次提示只写失败，同学不知道怎么办；我按反馈区分输入错误和网络失败，后来请同学重新操作，检查能否继续报名。',
  motivation:
    '我喜欢把实际需求变成可以使用的页面，做过React练习，也看过岗位要求，想继续学习交互和可靠性。',
  availability: '我可以两周后到岗，每周四天，连续实习三个月，地点希望在上海。',
  expectations: '期望每天两百元左右，也关注指导和实际参与机会，可以结合岗位职责沟通。',
};

async function main() {
  dotenv({ quiet: true });
  const cfg = loadConfig({
    LLM_API_KEY: process.env.LLM_API_KEY,
    LLM_BASE_URL: process.env.LLM_BASE_URL,
    LLM_MODEL: process.env.LLM_MODEL,
    LLM_OUTPUT_MODE: 'json_schema',
    NODE_ENV: 'test',
  });
  if (!cfg.LLM_API_KEY) throw new Error('Real model configuration required');
  const log = (entry: object) => {
    if (process.argv.includes('--debug')) console.log(JSON.stringify(entry));
  };
  const knowledge = createAllRoleKnowledge(cfg),
    models = createWorkflowModels(cfg, fetch, log),
    agent = createInterviewAgent(cfg, log);
  const records: object[] = [];
  let failures = 0;
  try {
    for (const type of ACTIVE_INTERVIEW_TYPES) {
      const state = newInterviewState('synthetic-policy-qa', {
        job: 'frontend',
        career_stage: type === 'hr' ? 'campus' : 'internship',
        interview_type: type,
        duration_minutes: type === 'mixed' ? 20 : 10,
        difficulty: '基础',
        interviewer_style: '标准',
        interaction_mode: 'text_fallback',
      });
      const configuration = state.view.configuration;
      try {
        const k = await knowledge.read(configuration);
        const plan = await models.prepare(
          configuration,
          k,
          undefined,
          new AbortController().signal,
        );
        if (plan.policy?.version !== interviewPolicy(configuration).version)
          throw new Error('Missing policy');
        const snapshot: InterviewSnapshot = {
          runtime_version: 'graph-v1',
          interview_type: type,
          job_title: '前端开发',
          knowledge: k,
          model: cfg.LLM_MODEL,
          prompt_version: 'interview-policy-v2',
          rubric_version: 'evidence-uncalibrated-v1',
          preparation_plan: plan,
        };
        state.view.status = 'in_progress';
        state.view.started_at = new Date().toISOString();
        state.view.target_at = new Date(
          Date.now() + configuration.duration_minutes * 60000,
        ).toISOString();
        state.view.turns = [
          {
            ...interviewOpening('前端开发', configuration),
            id: 't0',
            ...nextQuestionPosition([], false)!,
            answer_text: answers.introduction,
            answer_status: 'answered',
            revision: 1,
            input_mode: 'text_fallback',
            generation_id: 'synthetic',
            presented_at: null,
            answered_at: null,
          },
        ];
        let memory: InterviewMemory | null = null;
        const questions: object[] = [];
        for (let i = 0; i < 3; i++) {
          const context = {
            memory,
            retrieval: {
              release: k.content_version,
              chunks: [],
              mode: 'empty' as const,
              missing_reason: 'Synthetic QA without vector index',
            },
            preview: async () => {},
          };
          let result;
          try {
            result = await agent.advance(
              state.view,
              snapshot,
              false,
              new AbortController().signal,
              false,
              context,
            );
          } catch (error) {
            if (!(error instanceof ServiceError) || !error.retryable) throw error;
            log({ type, retry: i });
            result = await agent.advance(
              state.view,
              snapshot,
              false,
              new AbortController().signal,
              true,
              context,
            );
          }
          memory = result.memory ?? memory;
          questions.push({
            action: result.action,
            question: result.question,
            decision: memory?.decision,
            focus: memory?.focus,
          });
          if (!result.question) break;
          const position = nextQuestionPosition(
            state.view.turns,
            result.action === 'follow_up',
            configuration.duration_minutes,
          );
          if (!position) break;
          const t: InterviewTurn = {
            ...result.question,
            ...position,
            id: `t${i + 1}`,
            answer_text: answers[memory?.focus ?? 'contribution'] ?? answers.contribution,
            answer_status: 'answered',
            revision: 1,
            input_mode: 'text_fallback',
            generation_id: 'synthetic',
            presented_at: null,
            answered_at: null,
          };
          state.view.turns.push(t);
        }
        if (type === 'hr' || type === 'technical_qa') {
          const evaluation = await agent.evaluate(
            state.view.turns.at(-1)!,
            snapshot,
            new AbortController().signal,
            false,
          );
          if (
            type === 'hr' &&
            evaluation.feedback_assessments?.some((a) => a.dimension === 'professional_foundation')
          )
            throw new Error('HR logistics must not imply professional competence');
          if (type !== 'hr' && evaluation.feedback_assessments?.length !== 6)
            throw new Error('Non-HR requires six dimensions');
          records.push({
            type,
            scoring: evaluation.feedback_assessments,
            version: evaluation.question_scoring_version,
          });
          console.log(
            JSON.stringify({
              type,
              scoring: evaluation.feedback_assessments,
              version: evaluation.question_scoring_version,
            }),
          );
        }
        records.push({ type, duration: configuration.duration_minutes, plan, questions });
        console.log(JSON.stringify({ type, questions, status: 'ok' }));
      } catch (error) {
        failures++;
        const code =
          error instanceof ServiceError
            ? error.code
            : error instanceof Error
              ? error.name
              : 'unknown';
        records.push({ type, status: 'failed', code });
        console.log(JSON.stringify({ type, status: 'failed', code }));
      }
    }
  } finally {
    await knowledge.close();
    await mkdir('tests/artifacts', { recursive: true });
    await writeFile(
      'tests/artifacts/interview-policy-live.json',
      JSON.stringify({ model: cfg.LLM_MODEL, failures, records }, null, 2),
    );
  }
  if (failures) process.exitCode = 1;
}
void main().catch(() => {
  console.error('Synthetic policy QA failed; no private provider details logged');
  process.exitCode = 1;
});
