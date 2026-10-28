import test from 'node:test';
import assert from 'node:assert/strict';
import {
  evidenceMatches,
  INTERVIEW_PROMPT_VERSION,
  interviewOpening,
  interviewConversationHistory,
  nextQuestionPosition,
  type InterviewSnapshot,
  type InterviewTurn,
  type InterviewComparison,
} from '@interviewlab/core';
import {
  createInterviewAgent,
  assertEvaluation,
  assertQuestion,
} from '../../code/backend/src/modules/interviews/agent';
import { newInterviewState } from '../../code/backend/src/modules/interviews/repository';
import { loadConfig } from '../../code/backend/src/foundation/config';
import { ServiceError } from '../../code/backend/src/foundation/errors';
const state = () =>
  newInterviewState('synthetic', {
    job: 'frontend',
    career_stage: 'internship',
    interview_type: 'project_deep_dive',
    difficulty: '基础',
    duration_minutes: 5,
    interviewer_style: '标准',
    interaction_mode: 'text_fallback',
  });
const question = {
  text: '请介绍你本人负责的工作。',
  topic: '个人职责',
  purpose: '区分本人和团队',
  knowledge_question_id: null,
  source_refs: [],
  evidence_refs: [],
};
const snapshot: InterviewSnapshot = {
  job_title: '前端开发',
  knowledge: {
    content_version: 'empty-v1',
    questions: [],
    sources: [],
    missing_reason: '未接入专业知识',
  },
  model: 'ecnu-plus',
  prompt_version: 'interview-text-v1',
  rubric_version: 'evidence-uncalibrated-v1',
};
function response(content: unknown, finish_reason = 'stop') {
  return new Response(
    JSON.stringify({
      choices: [{ finish_reason, message: { content: JSON.stringify(content) } }],
      usage: { prompt_tokens: 10, completion_tokens: 20 },
    }),
    { headers: { 'content-type': 'application/json' } },
  );
}
test('ecnu-plus is the default model and uses the configured compatible endpoint with server-only credentials', async () => {
  const log: object[] = [];
  let request: Record<string, unknown> = {};
  const agent = createInterviewAgent(
    loadConfig({ LLM_API_KEY: 'synthetic-secret' }),
    async (url, init) => {
      assert.equal(url, 'https://chat.ecnu.edu.cn/open/api/v1/chat/completions');
      assert.equal(new Headers(init?.headers).get('authorization'), 'Bearer synthetic-secret');
      request = JSON.parse(init!.body as string);
      return response({ topics: ['个人职责'], question });
    },
    (entry) => log.push(entry),
  );
  assert.equal(agent.available, true);
  await agent.plan(state().view, snapshot, new AbortController().signal, false);
  assert.equal(request.model, 'ecnu-plus');
  assert.deepEqual(request.response_format, { type: 'json_object' });
  assert.ok(!JSON.stringify(log).includes('synthetic-secret'));
  assert.ok(!JSON.stringify(log).includes(question.text));
  assert.equal(log.length, 1);
});
test('missing credentials stay unavailable and never trigger a provider request', async () => {
  const agent = createInterviewAgent(loadConfig({}), async () => {
    throw new Error('must not call');
  });
  assert.equal(agent.available, false);
  await assert.rejects(
    agent.plan(state().view, snapshot, new AbortController().signal, false),
    (e: ServiceError) => e.code === 'capability_unavailable',
  );
});
test('JSON schema output is opt-in and malformed, incomplete or fabricated output is rejected', async () => {
  for (const result of [
    response({ topics: ['主题'], question: { ...question, extra: 'unexpected' } }),
    response({ topics: ['主题'], question }, 'length'),
    new Response('not-json'),
    response({ topics: ['主题'], question: { ...question, source_refs: ['invented'] } }),
  ]) {
    const agent = createInterviewAgent(loadConfig({ LLM_API_KEY: 'test' }), async () => result);
    await assert.rejects(
      agent.plan(state().view, snapshot, new AbortController().signal, false),
      (e: ServiceError) => e.code === 'invalid_model_output',
    );
  }
  const agent = createInterviewAgent(
    loadConfig({ LLM_API_KEY: 'test', LLM_OUTPUT_MODE: 'json_schema' }),
    async (_url, init) => {
      assert.equal(JSON.parse(init!.body as string).response_format.type, 'json_schema');
      return response({ topics: ['职责'], question });
    },
  );
  await agent.plan(state().view, snapshot, new AbortController().signal, false);
});
test('provider errors are sanitized and do not perform hidden retries', async () => {
  let calls = 0;
  const logs: object[] = [];
  const agent = createInterviewAgent(
    loadConfig({ LLM_API_KEY: 'private-key' }),
    async () => {
      calls++;
      return new Response('private provider failure', { status: 429 });
    },
    (entry) => logs.push(entry),
  );
  await assert.rejects(
    agent.plan(state().view, snapshot, new AbortController().signal, true),
    (e: ServiceError) => !e.message.includes('private') && e.code === 'provider_error',
  );
  assert.equal(calls, 1);
  assert.ok(!JSON.stringify(logs).includes('private'));
});
test('timeout and user cancellation reach fetch and are distinguished', async () => {
  const fetcher: typeof fetch = async (_url, init) =>
    new Promise((_resolve, reject) => {
      if (init?.signal?.aborted) reject(new Error('aborted'));
      else
        init?.signal?.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
    });
  const agent = createInterviewAgent(
    loadConfig({ LLM_API_KEY: 'test', LLM_TIMEOUT_MS: 100 }),
    fetcher,
  );
  const keepAlive = setTimeout(() => {}, 1000);
  try {
    await assert.rejects(
      agent.plan(state().view, snapshot, new AbortController().signal, false),
      (e: ServiceError) => e.code === 'provider_timeout',
    );
    const controller = new AbortController();
    const promise = agent.plan(state().view, snapshot, controller.signal, false);
    controller.abort();
    await assert.rejects(promise, (e: ServiceError) => e.code === 'cancelled');
  } finally {
    clearTimeout(keepAlive);
  }
});
test('six main questions and two follow-ups are hard programmatic limits', () => {
  const turns: InterviewTurn[] = [];
  for (let main = 1; main <= 6; main++)
    for (let follow = 0; follow <= 2; follow++) {
      assert.deepEqual(nextQuestionPosition(turns, follow > 0), {
        main_question_index: main,
        follow_up_index: follow,
      });
      turns.push({
        ...question,
        id: `${main}-${follow}`,
        main_question_index: main,
        follow_up_index: follow,
        generation_id: 'generation',
        presented_at: null,
        answer_status: 'answered',
        answer_text: '我负责测试。',
        revision: 1,
        input_mode: 'text_fallback',
        answered_at: null,
      });
    }
  assert.equal(nextQuestionPosition(turns, false), null);
  assert.equal(nextQuestionPosition(turns, true), null);
  turns[0].answer_status = 'skipped';
  assert.deepEqual(nextQuestionPosition([turns[0]], true), {
    main_question_index: 2,
    follow_up_index: 0,
  });
});
test('evidence requires verbatim text at the exact answered revision; unsupported professional observation is rejected', () => {
  const turn: InterviewTurn = {
    ...question,
    id: 'turn',
    main_question_index: 1,
    follow_up_index: 0,
    generation_id: 'generation',
    presented_at: null,
    answer_status: 'answered',
    answer_text: '团队四人，我负责接口测试。',
    revision: 1,
    input_mode: 'text_fallback',
    answered_at: null,
  };
  assert.equal(
    evidenceMatches({ turn_id: 'turn', revision: 1, quote: '我负责接口测试。' }, [turn]),
    true,
  );
  assert.equal(
    evidenceMatches({ turn_id: 'turn', revision: 2, quote: '我负责接口测试。' }, [turn]),
    false,
  );
  assert.throws(() =>
    assertQuestion(
      {
        ...question,
        text: '新的问题',
        evidence_refs: [{ turn_id: 'turn', revision: 1, quote: '本人完成了全部项目' }],
      },
      snapshot,
      [turn],
    ),
  );
  assert.throws(() =>
    assertEvaluation(
      {
        turn_id: 'turn',
        revision: 1,
        strengths: [
          {
            text: '错误的专业判断',
            evidence_refs: [{ turn_id: 'turn', revision: 1, quote: '团队四人' }],
          },
        ],
        gaps: [],
        reference_points: [],
        retry_goal: '补充测试',
        dimensions: ['technical_knowledge'],
        limitations: [],
      },
      turn,
      snapshot,
    ),
  );
});
test('evaluation schema offers only grounded dimensions to the provider', async () => {
  const turn: InterviewTurn = {
    ...question,
    id: 'turn',
    main_question_index: 1,
    follow_up_index: 0,
    generation_id: 'generation',
    presented_at: null,
    answer_status: 'answered',
    answer_text: '我负责搜索页面，接口由同学实现。',
    revision: 1,
    input_mode: 'text_fallback',
    answered_at: null,
  };
  const agent = createInterviewAgent(
    loadConfig({ LLM_API_KEY: 'synthetic-key' }),
    async (_url, init) => {
      const request = JSON.parse(init!.body as string);
      const task = JSON.parse(request.messages[1].content);
      assert.deepEqual(task.schema.properties.dimensions.items.enum, [
        'project_communication',
        'logical_expression',
      ]);
      assert.deepEqual(task.input.allowed_dimensions, [
        'project_communication',
        'logical_expression',
      ]);
      assert.ok(task.input.missing_reason);
      assert.equal(task.schema.properties.turn_id.const, turn.id);
      assert.equal(task.schema.properties.revision.const, turn.revision);
      return response({
        turn_id: turn.id,
        revision: 1,
        strengths: [
          {
            text: '区分了本人和团队职责。',
            evidence_refs: [{ turn_id: turn.id, revision: 1, quote: turn.answer_text }],
          },
        ],
        gaps: [],
        reference_points: [],
        retry_goal: '补充验证过程',
        dimensions: ['project_communication'],
        limitations: [],
      });
    },
  );
  const result = await agent.evaluate(turn, snapshot, new AbortController().signal, false);
  assert.deepEqual(result.dimensions, ['project_communication']);
});
test('follow-up schema requires the current answer revision and removes unavailable actions', async () => {
  const v = state().view;
  v.target_at = new Date(Date.now() + 60000).toISOString();
  const turn: InterviewTurn = {
    ...question,
    id: 'turn-current',
    main_question_index: 1,
    follow_up_index: 1,
    generation_id: 'generation',
    presented_at: null,
    answer_status: 'answered',
    answer_text: '我用并发测试验证约束。',
    revision: 1,
    input_mode: 'text_fallback',
    answered_at: null,
  };
  v.turns = [
    {
      ...turn,
      id: 'turn-old',
      text: '你负责什么？',
      follow_up_index: 0,
      answer_text: '我负责预约接口。',
    },
    turn,
  ];
  const agent = createInterviewAgent(
    loadConfig({ LLM_API_KEY: 'synthetic-key' }),
    async (_url, init) => {
      const task = JSON.parse(JSON.parse(init!.body as string).messages[1].content);
      const schema = JSON.stringify(task.schema);
      if (turn.follow_up_index < 2) assert.ok(schema.includes('"const":"turn-current"'));
      else assert.ok(!schema.includes('"const":"follow_up"'));
      assert.ok(!schema.includes('"const":"turn-old"'));
      assert.ok(!schema.includes('"const":"clarify"'));
      return response({
        action: 'follow_up',
        question: {
          ...question,
          text: '这些并发用例怎样设置？',
          evidence_refs: [{ turn_id: turn.id, revision: 1, quote: turn.answer_text }],
        },
        clarification: null,
      });
    },
  );
  assert.equal(
    (await agent.advance(v, snapshot, false, new AbortController().signal, false)).action,
    'follow_up',
  );
  v.turns[1].follow_up_index = 2;
  await assert.rejects(
    agent.advance(v, snapshot, false, new AbortController().signal, false),
    (e: ServiceError) => e.code === 'invalid_model_output',
  );
});
test('clarification schema only permits a short restatement without answer examples', async () => {
  const v = state().view;
  const agent = createInterviewAgent(
    loadConfig({ LLM_API_KEY: 'synthetic-key' }),
    async (_url, init) => {
      const request = JSON.parse(init!.body as string);
      const task = JSON.parse(request.messages[1].content);
      assert.equal(task.schema.properties.action.const, 'clarify');
      assert.equal(task.schema.properties.question.type, 'null');
      assert.ok(task.input.instructions.includes('不得举例'));
      return response({
        action: 'clarify',
        question: null,
        clarification: '这道题询问你本人负责什么，以及你如何验证自己的工作。',
      });
    },
  );
  assert.equal(
    (await agent.advance(v, snapshot, true, new AbortController().signal, false)).action,
    'clarify',
  );
});
test('comparison output is scoped to both pinned answer versions', async () => {
  const input: InterviewComparison = {
    id: 'comparison',
    version: 1,
    task_id: null,
    original_interview_id: 'interview-old',
    retry_interview_id: 'interview-new',
    original_turn_id: 'turn-old',
    retry_turn_id: 'turn-new',
    original_revision: 1,
    retry_revision: 2,
    original_text: '我负责接口。',
    retry_text: '我负责接口，并验证重复提交。',
    goal: '补充验证过程',
    question: '你负责什么，如何验证？',
    status: 'pending',
    changes: [],
    remaining_gaps: [],
    limitations: [],
  };
  let wrongRevision = false;
  const agent = createInterviewAgent(
    loadConfig({ LLM_API_KEY: 'synthetic-key' }),
    async (_url, init) => {
      const task = JSON.parse(JSON.parse(init!.body as string).messages[1].content);
      const schema = JSON.stringify(task.schema);
      assert.ok(schema.includes('"const":"turn-old"'));
      assert.ok(schema.includes('"const":"turn-new"'));
      return response({
        changes: [
          {
            text: '新增了验证陈述。',
            evidence_refs: [
              { turn_id: input.original_turn_id, revision: 1, quote: input.original_text },
              {
                turn_id: input.retry_turn_id,
                revision: wrongRevision ? 1 : 2,
                quote: input.retry_text,
              },
            ],
          },
        ],
        remaining_gaps: [],
        limitations: [],
      });
    },
  );
  assert.equal((await agent.compare(input, new AbortController().signal, false)).changes.length, 1);
  wrongRevision = true;
  await assert.rejects(
    agent.compare(input, new AbortController().signal, false),
    (e: ServiceError) => e.code === 'invalid_model_output',
  );
});

test('conversation retains the entire introduction and recent answers with explicit older truncation', () => {
  const turn: InterviewTurn = {
    ...interviewOpening('后端开发'),
    id: 'intro',
    main_question_index: 1,
    follow_up_index: 0,
    generation_id: 'generation',
    presented_at: null,
    answer_status: 'answered',
    answer_text: '背景'.repeat(1800) + '我只负责前端，没有做过后端。',
    revision: 1,
    input_mode: 'text_fallback',
    answered_at: null,
  };
  const turns = Array.from({ length: 10 }, (_, i) => ({ ...turn, id: `turn-${i}` }));
  const history = interviewConversationHistory(turns);
  assert.equal(history[0].answer_text, turn.answer_text);
  assert.equal(history[1].answer_text?.length, 800);
  assert.equal(history[1].answer_truncated, true);
  assert.equal(history[9].answer_text, turn.answer_text);
  assert.equal(history[9].answer_truncated, false);
});
test('interviewer bridges reject common solution feedback during an ongoing interview', () => {
  assert.throws(
    () =>
      assertQuestion({ ...question, acknowledgement: '了解了，这是一种有效手段。' }, snapshot, []),
    (e: ServiceError) => e.code === 'invalid_model_output',
  );
  assert.doesNotThrow(() =>
    assertQuestion(
      { ...question, acknowledgement: '你提到了数据库约束，我们继续聊聊这部分。' },
      snapshot,
      [],
    ),
  );
  assert.throws(
    () =>
      assertQuestion(
        { ...question, stage: 'experience', text: '你负责什么？怎样验证？' },
        snapshot,
        [],
      ),
    (e: ServiceError) => e.code === 'invalid_model_output',
  );
});

test('conversational generation forbids premature finish and pins follow-up to actual introduction evidence', async () => {
  const v = state().view;
  const intro: InterviewTurn = {
    ...interviewOpening('后端开发'),
    id: 'intro',
    main_question_index: 1,
    follow_up_index: 0,
    generation_id: 'generation',
    presented_at: null,
    answer_status: 'answered',
    answer_text: '我负责 React 搜索页，没有后端项目，想学习后端。',
    revision: 1,
    input_mode: 'text_fallback',
    answered_at: null,
  };
  v.turns = [intro];
  let earlyFinish = false;
  const agent = createInterviewAgent(
    loadConfig({ LLM_API_KEY: 'synthetic-key' }),
    async (_url, init) => {
      const task = JSON.parse(JSON.parse(init!.body as string).messages[1].content);
      assert.equal(task.input.history[0].answer_text, intro.answer_text);
      assert.ok(task.input.conversation_guidance.includes('不能假设做过项目'));
      assert.ok(!JSON.stringify(task.schema).includes('"const":"finish"'));
      return response(
        earlyFinish
          ? { action: 'finish', question: null, clarification: null }
          : {
              action: 'follow_up',
              clarification: null,
              question: {
                ...question,
                text: '你做搜索页时遇到过什么具体问题？',
                stage: 'experience',
                acknowledgement: '你提到了 React 搜索页，我们从这段经历聊起。',
                evidence_refs: [{ turn_id: intro.id, revision: 1, quote: '我负责 React 搜索页' }],
              },
            },
      );
    },
  );
  const frozen = { ...snapshot, prompt_version: INTERVIEW_PROMPT_VERSION };
  const result = await agent.advance(v, frozen, false, new AbortController().signal, false);
  assert.equal(result.question?.stage, 'experience');
  earlyFinish = true;
  await assert.rejects(
    agent.advance(v, frozen, false, new AbortController().signal, false),
    (e: ServiceError) => e.code === 'invalid_model_output',
  );
});
