import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import React, { createElement } from 'react';
import {
  ACTIVE_INTERVIEW_TYPES,
  interviewPolicy,
  interviewPacing,
  interviewDeadline,
  mainQuestionLimit,
  nextQuestionPosition,
  HR_SCORING_VERSION,
  FEEDBACK_DIMENSIONS,
  type InterviewTurn,
  type InterviewSnapshot,
} from '@interviewlab/core';
import { newInterviewState } from '../../code/backend/src/modules/interviews/repository';
import {
  interviewConfigSchema,
  newInterviewConfigSchema,
} from '../../code/backend/src/modules/interviews/schemas';
import { assertPolicyQuestion } from '../../code/backend/src/modules/interviews/question-policy';
import { createStreamingAgent } from '../../code/backend/src/modules/interviews/streaming-agent';
import { createModelAnalysis } from '../../code/backend/src/modules/interviews/model-analysis';
import { createReportAnalysis } from '../../code/backend/src/modules/reports/analysis';
import { COMPETENCIES, catalogProfile } from '../../code/backend/src/modules/knowledge/catalog';
import { loadConfig } from '../../code/backend/src/foundation/config';
import { AbilityRadar } from '../../code/frontend/features/live-interview/report-charts';
import {
  conversationPolicy,
  assertConversationQuestion,
} from '../../code/backend/src/modules/interviews/conversation';
(globalThis as typeof globalThis & { React: typeof React }).React = React;

const config = {
  job: 'frontend',
  career_stage: 'internship',
  interview_type: 'technical_qa',
  difficulty: '基础',
  duration_minutes: 10,
  interviewer_style: '标准',
  interaction_mode: 'text_fallback',
} as const;
const turn = (text: string, answer: string, index = 1, follow = 0): InterviewTurn => ({
  id: `t-${index}-${follow}`,
  text,
  answer_text: answer,
  topic: '经历',
  purpose: '了解本人行动',
  main_question_index: index,
  follow_up_index: follow,
  answer_status: 'answered',
  knowledge_question_id: null,
  source_refs: [],
  evidence_refs: [],
  generation_id: 'test',
  presented_at: null,
  revision: 1,
  input_mode: 'text_fallback',
  answered_at: null,
});

test('HR salary refusals block paraphrased questions without blocking other arrangements', () => {
  const state = newInterviewState('hr-boundary', { ...config, interview_type: 'hr' });
  state.view.turns = [turn('你的薪资期望是多少？', '薪资我不方便透露。')];
  const conversation = conversationPolicy(state.view);
  assert.equal(conversation.boundaries[0].topic, 'expectations');
  assert.throws(() => assertConversationQuestion('你期望的薪酬范围是什么？', conversation, true));
  assert.doesNotThrow(() => assertConversationQuestion('你什么时候能够到岗？', conversation, true));
});

test('four current types have distinct themes, stage-specific HR arrangements and 10/20/30 minute budgets', () => {
  assert.deepEqual(ACTIVE_INTERVIEW_TYPES, ['technical_qa', 'business_scenario', 'hr', 'mixed']);
  for (const type of ACTIVE_INTERVIEW_TYPES)
    for (const duration of [10, 20, 30] as const) {
      const p = interviewPolicy({ ...config, interview_type: type, duration_minutes: duration });
      assert.equal(p.opening_seconds + p.core_seconds + p.closing_seconds, duration * 60);
      assert.equal(p.required_dimensions, type !== 'hr');
      assert.ok(p.themes.every((t) => t.purpose && t.probe && t.stop));
    }
  const intern = interviewPolicy({ ...config, interview_type: 'hr' });
  const campus = interviewPolicy({ ...config, interview_type: 'hr', career_stage: 'campus' });
  assert.match(intern.themes.find((t) => t.goal === 'availability')!.purpose, /出勤.*时长/);
  assert.match(campus.themes.find((t) => t.goal === 'availability')!.purpose, /到岗.*地点/);
  assert.ok(intern.themes.some((t) => t.goal === 'expectations'));
  assert.equal(
    newInterviewConfigSchema.safeParse({ ...config, interview_type: 'project_deep_dive' }).success,
    false,
  );
  assert.equal(
    interviewConfigSchema.safeParse({ ...config, interview_type: 'project_deep_dive' }).success,
    true,
  );
});

test('new interviews start at ten minutes and long sessions retain their time and question budgets', () => {
  assert.equal(
    newInterviewConfigSchema.safeParse({ ...config, duration_minutes: 5 }).success,
    false,
  );
  assert.equal(interviewConfigSchema.safeParse({ ...config, duration_minutes: 5 }).success, true);
  const started = '2026-11-06T00:00:00.000Z';
  for (const duration of [10, 20, 30] as const) {
    assert.equal(
      newInterviewConfigSchema.safeParse({ ...config, duration_minutes: duration }).success,
      true,
    );
    assert.equal(
      interviewDeadline(started, duration) - Date.parse(started),
      (duration + 2) * 60000,
    );
    const limit = mainQuestionLimit(duration);
    assert.equal(nextQuestionPosition([turn('问题', '回答', limit)], false, duration), null);
    assert.equal(
      nextQuestionPosition([turn('问题', '回答', limit - 1)], false, duration)?.main_question_index,
      limit,
    );
  }
  assert.equal(nextQuestionPosition([turn('问题', '回答', 6)], false, 20)?.main_question_index, 7);
  assert.equal(interviewDeadline(started, 5) - Date.parse(started), 12 * 60000);
});

test('pacing stops settled, declined, unknown and repeated answers and reserves the closing window', () => {
  const state = newInterviewState('test', config);
  state.view.turns = [turn('你负责什么？', '我负责表单和校验。')];
  state.view.target_at = new Date(Date.now() + 240000).toISOString();
  assert.equal(interviewPacing(state.view, null).allow_follow_up, true);
  for (const stateName of ['covered', 'inconclusive', 'not_applicable'] as const)
    assert.equal(
      interviewPacing(state.view, {
        version: 1,
        focus: 'contribution',
        claims: [],
        asked_intents: [],
        observations: [
          { goal: 'contribution', state: stateName, evidence_refs: [], pending: null },
        ],
      }).allow_follow_up,
      false,
    );
  for (const last_act of ['dont_know', 'decline_topic'] as const)
    assert.equal(
      interviewPacing(state.view, {
        version: 1,
        focus: null,
        observations: [],
        claims: [],
        asked_intents: [],
        conversation: { last_act, boundaries: [] },
      }).allow_follow_up,
      false,
    );
  state.view.turns.push(turn('能补充什么？', '我负责表单和校验。', 1, 1));
  state.view.configuration.interviewer_style = '深入追问';
  assert.equal(interviewPacing(state.view, null).allow_follow_up, false);
  state.view.turns.pop();
  state.view.target_at = new Date(Date.now() + 45000).toISOString();
  assert.equal(interviewPacing(state.view, null).phase, 'closing');
  assert.equal(interviewPacing(state.view, null).allow_follow_up, false);
});

test('mixed interviews reserve business and HR topics before the main-question budget is exhausted', () => {
  const state = newInterviewState('mixed-test', {
    ...config,
    interview_type: 'mixed',
    duration_minutes: 10,
  });
  state.view.target_at = new Date(Date.now() + 590000).toISOString();
  state.view.turns = [turn('你如何理解这个任务？', '先明确目标。', 4)];
  assert.deepEqual(interviewPacing(state.view, null).preferred_goals, [
    'business',
    'tradeoffs',
    'verification',
  ]);
  state.view.turns = [turn('你会如何取舍？', '先保证任务完成。', 5)];
  assert.ok(interviewPacing(state.view, null).preferred_goals.includes('availability'));
});

test('new HR turns carry recent dialogue and policy, accept neutral bridges, and block technical questions before preview', async () => {
  const c = { ...config, interview_type: 'hr' as const };
  const state = newInterviewState('test', c);
  state.view.turns = [
    turn('请介绍自己。', '我想找前端实习，之前负责课程项目表单。'),
    turn('为什么选择这个方向？', '我做过React练习，希望参与用户任务。', 2),
    turn('还做过什么准备？', '我看过岗位职责，也做过相关课程作业。', 3),
  ];
  state.view.target_at = new Date(Date.now() + 240000).toISOString();
  const snapshot: InterviewSnapshot = {
    runtime_version: 'graph-v1',
    interview_type: 'hr',
    model: 'test',
    job_title: '前端',
    prompt_version: 'interview-policy-v2',
    rubric_version: 'test',
    knowledge: {
      content_version: 'test',
      questions: [],
      sources: [],
      missing_reason: null,
      agent_release: {
        id: 'test',
        embedding_model: 'test',
        dimensions: 1024,
        profile: catalogProfile('hr'),
        competencies: COMPETENCIES,
      },
    },
    preparation_plan: { policy: interviewPolicy(c), goals: [], limitations: [] },
  };
  const cfg = loadConfig({ LLM_API_KEY: 'test' });
  let question = '你选择前端实习的主要原因是什么？';
  const seen: string[] = [];
  const agent = createStreamingAgent(
    createModelAnalysis(cfg),
    cfg,
    () => {},
    async (_url, init) => {
      const body = JSON.parse(String(init?.body));
      const input = JSON.parse(body.messages[1].content);
      assert.equal(input.recent_dialogue[0].answer, state.view.turns[0].answer_text);
      assert.equal(input.policy.required_dimensions, false);
      assert.deepEqual(input.required_feedback_coverage, []);
      assert.equal(
        input.can_finish,
        false,
        'HR must leave an opportunity for arrangements and expectations',
      );
      assert.equal(body.response_format.json_schema.schema.properties.q.maxLength, 100);
      const output = {
        a: 'n',
        g: 0,
        e: 0,
        o: 1,
        r: [],
        b: '我们聊聊求职选择。',
        d: 'type_priority',
        q: question,
        s: [],
      };
      return new Response(
        `data: ${JSON.stringify({ choices: [{ delta: { content: JSON.stringify(output) } }] })}\n\ndata: [DONE]\n\n`,
      );
    },
  );
  const context = {
    memory: null,
    retrieval: { release: 'test', chunks: [], mode: 'empty' as const, missing_reason: null },
    preview: async (v: { text: string }) => {
      seen.push(v.text);
    },
  };
  const result = await agent.advance(
    state.view,
    snapshot,
    false,
    new AbortController().signal,
    false,
    context,
  );
  assert.equal(result.question?.acknowledgement, '我们聊聊求职选择。');
  assert.equal(result.memory?.decision?.reason, 'type_priority');
  seen.length = 0;
  question = '你如何解释缓存机制？';
  await assert.rejects(
    agent.advance(state.view, snapshot, false, new AbortController().signal, false, context),
  );
  assert.ok(!seen.some((t) => t.includes('缓存机制')));
  assert.throws(() =>
    assertPolicyQuestion('请手写代码实现。', { ...c, interview_type: 'business_scenario' }),
  );
});

test('HR omits unexamined dimensions without converting them to zeros and charts hide absent axes', async () => {
  const t = turn(
    '为什么选择这个岗位？',
    '我喜欢把用户遇到的问题转成可操作的页面，因此做了相关练习。',
  );
  const analysis = createReportAnalysis(async (_kind, schema) =>
    schema.parse({
      scores: FEEDBACK_DIMENSIONS.map((d) =>
        d.key === 'motivation' ? [80, '说明岗位选择及准备', 'g0-0'] : [null, '未考察', null],
      ),
      strengths: [],
      gaps: [],
      retry_goal: '',
      reference_points: [],
    }),
  );
  const snapshot: InterviewSnapshot = {
    interview_type: 'hr',
    job_title: '前端',
    model: 'test',
    prompt_version: 'test',
    rubric_version: 'test',
    knowledge: { content_version: 'test', questions: [], sources: [], missing_reason: null },
  };
  const e = await analysis.evaluate(t, snapshot, new AbortController().signal, false);
  assert.equal(e.question_scoring_version, HR_SCORING_VERSION);
  assert.deepEqual(
    e.feedback_assessments?.map((a) => a.dimension),
    ['motivation'],
  );
  const html = renderToStaticMarkup(
    createElement(AbilityRadar, { feedback: null, assessments: e.feedback_assessments }),
  );
  assert.match(html, /岗位匹配/);
  assert.ok(!html.includes('专业基础'));
  assert.match(html, /meter/);
});
