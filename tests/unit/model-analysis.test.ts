import { evaluationWire } from '../support/report-wire';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  evidenceMatches,
  FEEDBACK_DIMENSIONS,
  interviewOpening,
  interviewConversationHistory,
  nextQuestionPosition,
  type InterviewSnapshot,
  type InterviewTurn,
  type InterviewComparison,
} from '@interviewlab/core';
import {
  createModelAnalysis,
  assertEvaluation,
  assertQuestion,
} from '../../code/backend/src/modules/interviews/model-analysis';
import { loadConfig } from '../../code/backend/src/foundation/config';
import { ServiceError } from '../../code/backend/src/foundation/errors';
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
  if (content && typeof content === 'object' && 'turn_id' in content && 'retry_goal' in content)
    content = {
      six_scores: Object.fromEntries(
        FEEDBACK_DIMENSIONS.map((d) => [d.key, { score: 0, text: '本次未体现', evidence_ids: [] }]),
      ),
      ...content,
    };
  content = evaluationWire(content);
  return new Response(
    JSON.stringify({
      choices: [{ finish_reason, message: { content: JSON.stringify(content) } }],
      usage: { prompt_tokens: 10, completion_tokens: 20 },
    }),
    { headers: { 'content-type': 'application/json' } },
  );
}
const probeTurn: InterviewTurn = {
  ...question,
  id: 'probe',
  main_question_index: 1,
  follow_up_index: 0,
  generation_id: 'probe',
  presented_at: null,
  answer_status: 'answered',
  answer_text: '我负责测试。',
  revision: 1,
  input_mode: 'text_fallback',
  answered_at: null,
};
const probeOutput = {
  turn_id: 'probe',
  revision: 1,
  strengths: [],
  gaps: [],
  reference_points: [],
  retry_goal: '补充验证过程',
  dimensions: [],
  limitations: [],
};
test('ecnu-plus is the default model and uses the configured compatible endpoint with server-only credentials', async () => {
  const log: object[] = [];
  let request: Record<string, unknown> = {};
  const agent = createModelAnalysis(
    loadConfig({ LLM_API_KEY: 'synthetic-secret' }),
    async (url, init) => {
      assert.equal(url, 'https://chat.ecnu.edu.cn/open/api/v1/chat/completions');
      assert.equal(new Headers(init?.headers).get('authorization'), 'Bearer synthetic-secret');
      request = JSON.parse(init!.body as string);
      return response(probeOutput);
    },
    (entry) => log.push(entry),
  );
  assert.equal(agent.available, true);
  await agent.evaluate(probeTurn, snapshot, new AbortController().signal, false);
  assert.equal(request.model, 'ecnu-plus');
  assert.deepEqual(request.response_format, { type: 'json_object' });
  assert.deepEqual(request.thinking, { type: 'disabled' });
  assert.equal(request.max_tokens, 1000);
  assert.ok(!JSON.stringify(log).includes('synthetic-secret'));
  assert.ok(!JSON.stringify(log).includes(question.text));
  assert.equal(log.filter((e) => 'invocation_id' in e).length, 1);
  assert.ok(log.some((e) => (e as { workflow?: string }).workflow === 'report_question'));
});
test('missing credentials stay unavailable and never trigger a provider request', async () => {
  const agent = createModelAnalysis(loadConfig({}), async () => {
    throw new Error('must not call');
  });
  assert.equal(agent.available, false);
  await assert.rejects(
    agent.evaluate(probeTurn, snapshot, new AbortController().signal, false),
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
    const agent = createModelAnalysis(loadConfig({ LLM_API_KEY: 'test' }), async () => result);
    await assert.rejects(
      agent.evaluate(probeTurn, snapshot, new AbortController().signal, false),
      (e: ServiceError) => e.code === 'invalid_model_output',
    );
  }
  const agent = createModelAnalysis(
    loadConfig({ LLM_API_KEY: 'test', LLM_OUTPUT_MODE: 'json_schema' }),
    async (_url, init) => {
      assert.equal(JSON.parse(init!.body as string).response_format.type, 'json_schema');
      return response(probeOutput);
    },
  );
  await agent.evaluate(probeTurn, snapshot, new AbortController().signal, false);
});
test('provider errors are sanitized and do not perform hidden retries', async () => {
  let calls = 0;
  const logs: object[] = [];
  const agent = createModelAnalysis(
    loadConfig({ LLM_API_KEY: 'private-key' }),
    async () => {
      calls++;
      return new Response('private provider failure', { status: 429 });
    },
    (entry) => logs.push(entry),
  );
  await assert.rejects(
    agent.evaluate(probeTurn, snapshot, new AbortController().signal, true),
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
  const agent = createModelAnalysis(
    loadConfig({ LLM_API_KEY: 'test', LLM_TIMEOUT_MS: 100 }),
    fetcher,
  );
  const keepAlive = setTimeout(() => {}, 1000);
  try {
    await assert.rejects(
      agent.evaluate(probeTurn, snapshot, new AbortController().signal, false),
      (e: ServiceError) => e.code === 'provider_timeout',
    );
    const controller = new AbortController();
    const promise = agent.evaluate(probeTurn, snapshot, controller.signal, false);
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
  const agent = createModelAnalysis(
    loadConfig({ LLM_API_KEY: 'synthetic-key' }),
    async (_url, init) => {
      const request = JSON.parse(init!.body as string);
      const task = JSON.parse(request.messages[1].content);
      assert.equal(task.schema.properties.scores.minItems, 6);
      assert.equal(task.schema.properties.scores.maxItems, 6);
      assert.equal(task.input.dimension_order.length, 6);
      assert.ok(!('turn_id' in task.schema.properties));
      assert.ok(!('revision' in task.schema.properties));
      return response({
        turn_id: turn.id,
        revision: 1,
        strengths: [
          {
            text: '区分了本人和团队职责。',
            evidence_refs: [{ turn_id: turn.id, revision: 1, quote: 'q0' }],
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
  assert.equal(result.feedback_assessments?.length, 6);
  assert.equal(result.turn_id, turn.id);
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
  const agent = createModelAnalysis(
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
