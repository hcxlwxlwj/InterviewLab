import { after, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { config as dotenv } from 'dotenv';
import type {
  Interview,
  InterviewConfig,
  InterviewQuestion,
  InterviewTurn,
} from '@interviewlab/core';
import { loadConfig } from '../../../code/backend/src/foundation/config';
import { createDatabase, type Database } from '../../../code/backend/src/database/connection';
import { migrateDatabase } from '../../../code/backend/src/database/migrate';
import { buildApp } from '../../../code/backend/src/server/app';
import { createInterviewRuntime } from '../../../code/backend/src/modules/interview-runtime';
import type { InterviewAgent } from '../../../code/backend/src/modules/interviews/agent';
import { runTask, TaskDeliveryError } from '../../../code/backend/src/tasks/runner';
import { ServiceError } from '../../../code/backend/src/foundation/errors';
import { inputDigest } from '../../../code/backend/src/foundation/idempotency';
import { startWorker } from '../../../code/backend/src/tasks/worker';

dotenv({ quiet: true });
const testUrl = process.env.TEST_DATABASE_URL;
if (!testUrl || !/^interviewlab_test[a-z0-9_]*$/.test(new URL(testUrl).pathname.slice(1)))
  throw new Error('Interview tests require a dedicated interviewlab_test* database');
const config = loadConfig({
  DATABASE_URL: testUrl,
  LOG_LEVEL: 'silent',
  NODE_ENV: 'test',
  WORKER_POLL_MS: 100,
  WORKER_HEARTBEAT_MS: 200,
  WORKER_STALE_MS: 1000,
});
const identity = { owner_id: 'synthetic-agent-student', roles: [] };
const configuration: InterviewConfig = {
  job: 'frontend',
  career_stage: 'internship',
  interview_type: 'technical_qa',
  difficulty: '基础',
  duration_minutes: 5,
  interviewer_style: '标准',
  interaction_mode: 'text_fallback',
};
let database: Database;
let runtime: ReturnType<typeof createInterviewRuntime>;
let agent: InterviewAgent;
const evidence = (t: InterviewTurn) => ({
  turn_id: t.id,
  revision: t.revision,
  quote: t.answer_text!,
});
function question(text: string, refs: InterviewQuestion['evidence_refs'] = []): InterviewQuestion {
  return {
    text,
    topic: '学习与验证',
    purpose: '检查分析过程',
    knowledge_question_id: null,
    source_refs: [],
    evidence_refs: refs,
  };
}
function fakeAgent(): InterviewAgent {
  return {
    available: true,
    model: 'controlled-test-only',
    async plan(_v, snapshot) {
      const q = snapshot.knowledge.questions[0];
      return {
        topics: [q?.topic ?? '通用经历'],
        question: q
          ? {
              text: q.text,
              topic: q.topic,
              purpose: q.intent,
              knowledge_question_id: q.id,
              source_refs: q.source_refs,
              evidence_refs: [],
            }
          : question('请介绍你的学习经历。'),
      };
    },
    async advance(v, _snapshot, clarify) {
      const last = v.turns.at(-1)!;
      if (clarify)
        return {
          action: 'clarify',
          question: null,
          clarification: '本题想了解你如何验证自己的思路。',
        };
      return {
        action: v.turns.length < 3 && last.answer_status === 'answered' ? 'follow_up' : 'finish',
        question:
          v.turns.length < 3 && last.answer_status === 'answered'
            ? {
                ...question(`你提到的做法如何验证？第 ${v.turns.length} 次`, [evidence(last)]),
                stage: 'experience',
                acknowledgement: '我们继续聊聊你提到的验证过程。',
              }
            : null,
        clarification: null,
      };
    },
    async evaluate(t) {
      return {
        turn_id: t.id,
        revision: t.revision,
        strengths: [{ text: '回答包含了可定位的个人陈述。', evidence_refs: [evidence(t)] }],
        gaps: [],
        reference_points: ['补充验证过程及适用条件，不添加未陈述事实。'],
        retry_goal: '说明本人行动和验证过程',
        dimensions: ['logical_expression'],
        limitations: ['仅依据本次文字回答。'],
      };
    },
    async summarize(evaluations) {
      return {
        overview: evaluations[0].strengths[0],
        strengths: evaluations.slice(0, 3).flatMap((e) => e.strengths.slice(0, 1)),
        improvements: [],
        limitations: ['受控测试总结，不代表真实模型质量。'],
      };
    },
    async compare(v) {
      return {
        changes: [
          {
            text: '两份指定回答中的陈述有所变化。',
            evidence_refs: [
              {
                turn_id: v.original_turn_id,
                revision: v.original_revision,
                quote: v.original_text,
              },
              { turn_id: v.retry_turn_id, revision: v.retry_revision, quote: v.retry_text },
            ],
          },
        ],
        remaining_gaps: [],
        limitations: ['未独立验证经历真实性。'],
      };
    },
  };
}
before(async () => {
  database = createDatabase(config);
  await migrateDatabase(database);
});
beforeEach(async () => {
  await database.pool.query(
    'TRUNCATE interviews,interview_reports,interview_comparisons,tasks,idempotency_records,worker_heartbeats CASCADE',
  );
  agent = fakeAgent();
  runtime = createInterviewRuntime(database, config, { agent });
});
after(async () => {
  if (database) {
    await database.pool.query(
      'TRUNCATE interviews,interview_reports,interview_comparisons,tasks,idempotency_records,worker_heartbeats CASCADE',
    );
    await database.close();
  }
});
async function drain() {
  for (let i = 0; i < 8; i++) {
    const rows = await database.pool.query<{ id: string }>(
      "SELECT id FROM tasks WHERE status='queued' OR (status='failed' AND attempts<max_attempts) ORDER BY created_at,id",
    );
    if (!rows.rows.length) {
      await runtime.maintain();
      const pending = await database.pool.query("SELECT id FROM tasks WHERE status='queued'");
      if (!pending.rows.length) break;
      continue;
    }
    for (const row of rows.rows) {
      try {
        await runTask(database, row.id, runtime.handlers);
      } catch (e) {
        if (!(e instanceof TaskDeliveryError)) throw e;
      }
    }
  }
  await runtime.maintain();
}
async function started(configInput = configuration): Promise<Interview> {
  const v = await runtime.interviews.create(identity, configInput, randomUUID());
  const s = await runtime.interviews.start(identity, v.id, { version: v.version }, randomUUID());
  await drain();
  return runtime.interviews.read(identity, s.id);
}
test('real routes run the text interview, report, fixed-question retry and evidence comparison', async () => {
  const app = await buildApp({
    config,
    database,
    logger: false,
    identity: { authenticate: async () => identity },
    interview: { agent },
  });
  try {
    const headers = { origin: config.PUBLIC_ORIGIN, 'idempotency-key': randomUUID() };
    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/interviews',
      headers,
      payload: configuration,
    });
    assert.equal(created.statusCode, 201);
    const draft: Interview = created.json();
    assert.equal(draft.started_at, null);
    const beginning = await app.inject({
      method: 'POST',
      url: `/api/v1/interviews/${draft.id}/start`,
      headers: { ...headers, 'idempotency-key': randomUUID() },
      payload: { version: draft.version },
    });
    assert.equal(beginning.statusCode, 200);
    await drain();
    let v = await runtime.interviews.read(identity, draft.id);
    assert.equal(v.turns.length, 1);
    const first = v.turns[0];
    assert.equal(first.stage, 'introduction');
    assert.match(first.text, /自我介绍/);
    assert.ok(first.acknowledgement);
    const submit = await app.inject({
      method: 'POST',
      url: `/api/v1/interviews/${v.id}/turns/${first.id}/answer`,
      headers: { ...headers, 'idempotency-key': randomUUID() },
      payload: { version: v.version, text: '  我负责定位问题，并通过测试验证实现。\n' },
    });
    assert.equal(submit.statusCode, 202);
    assert.equal((await app.inject(`/api/v1/interviews/${v.id}/report`)).statusCode, 409);
    await drain();
    v = await runtime.interviews.read(identity, v.id);
    assert.equal(v.turns[1].follow_up_index, 1);
    assert.equal(v.turns[0].answer_text, '  我负责定位问题，并通过测试验证实现。\n');
    v = await runtime.interviews.answer(
      identity,
      v.id,
      v.turns[1].id,
      { version: v.version, text: '我使用边界测试和对照实验验证。' },
      randomUUID(),
    );
    await drain();
    v = await runtime.interviews.read(identity, v.id);
    assert.equal(v.turns[1].acknowledgement, '我们继续聊聊你提到的验证过程。');
    v = await runtime.interviews.answer(
      identity,
      v.id,
      v.turns[2].id,
      { version: v.version, text: '我保留测试用例，并对照预期结果。' },
      randomUUID(),
    );
    await drain();
    v = await runtime.interviews.read(identity, v.id);
    assert.equal(v.status, 'completed');
    const report = await runtime.reports.get(identity, v.id);
    assert.equal(report.status, 'ready');
    assert.equal(report.overall_score, null);
    assert.equal(report.dimensions.coding_ability.status, 'not_observed');
    assert.equal(report.evaluations.length, 3);
    const retry = await runtime.interviews.createRetry(
      identity,
      v.id,
      { turn_id: first.id, revision: 1, goal: '补充验证过程' },
      randomUUID(),
    );
    let retryStarted = await runtime.interviews.start(
      identity,
      retry.id,
      { version: retry.version },
      randomUUID(),
    );
    assert.equal(retryStarted.turns[0].text, first.text);
    retryStarted = await runtime.interviews.answer(
      identity,
      retry.id,
      retryStarted.turns[0].id,
      { version: retryStarted.version, text: '我先建立失败用例，再验证修复及边界条件。' },
      randomUUID(),
    );
    assert.equal(retryStarted.status, 'completed');
    await drain();
    const comparison = await runtime.reports.createComparison(
      identity,
      {
        original_interview_id: v.id,
        retry_interview_id: retry.id,
        original_turn_id: first.id,
        retry_turn_id: retryStarted.turns[0].id,
        original_revision: 1,
        retry_revision: 1,
      },
      randomUUID(),
    );
    await drain();
    assert.equal((await runtime.reports.getComparison(identity, comparison.id)).status, 'ready');
    const other = { owner_id: 'other-student', roles: [] };
    await assert.rejects(
      runtime.interviews.read(other, v.id),
      (e: ServiceError) => e.statusCode === 404,
    );
    await assert.rejects(
      runtime.reports.get(other, v.id),
      (e: ServiceError) => e.statusCode === 404,
    );
    await assert.rejects(
      runtime.reports.getComparison(other, comparison.id),
      (e: ServiceError) => e.statusCode === 404,
    );
  } finally {
    await app.close();
  }
});
test('answer idempotency returns authoritative state, conflicts on changed input and cannot resurrect deleted data', async () => {
  let v = await started();
  const key = randomUUID();
  const input = { version: v.version, text: '我使用独立测试验证结果。' };
  v = await runtime.interviews.answer(identity, v.id, v.turns[0].id, input, key);
  const repeat = await runtime.interviews.answer(identity, v.id, v.turns[0].id, input, key);
  assert.equal(repeat.turns.filter((t) => t.answer_status === 'answered').length, 1);
  await assert.rejects(
    runtime.interviews.answer(identity, v.id, v.turns[0].id, { ...input, text: '不同内容' }, key),
    (e: ServiceError) => e.statusCode === 409,
  );
  await runtime.interviews.delete(identity, v.id, { version: v.version }, randomUUID());
  await assert.rejects(
    runtime.interviews.answer(identity, v.id, v.turns[0].id, input, key),
    (e: ServiceError) => e.statusCode === 404,
  );
  const records = await database.pool.query(
    'SELECT response FROM idempotency_records WHERE owner_id=$1',
    [identity.owner_id],
  );
  assert.ok(!JSON.stringify(records.rows).includes(input.text));
});
test('presentation, repeat and clarification do not consume question budget; original text survives', async () => {
  let v = await started();
  const id = v.turns[0].id;
  const version = v.version;
  v = await runtime.interviews.presented(identity, v.id, id, { version }, randomUUID());
  assert.equal(v.version, version);
  assert.ok(v.turns[0].presented_at);
  v = await runtime.interviews.action(
    identity,
    v.id,
    id,
    { version: v.version, action: 'repeat_question' },
    randomUUID(),
  );
  assert.equal(v.turns.length, 1);
  v = await runtime.interviews.action(
    identity,
    v.id,
    id,
    { version: v.version, action: 'clarify_question' },
    randomUUID(),
  );
  await drain();
  v = await runtime.interviews.read(identity, v.id);
  assert.equal(v.turns.length, 1);
  assert.equal(v.turns[0].answer_status, 'waiting');
  assert.ok(v.clarification);
});
test('pause rejects submissions and resume regenerates only when there is no waiting question', async () => {
  let v = await started();
  v = await runtime.interviews.pause(identity, v.id, { version: v.version }, randomUUID());
  await assert.rejects(
    runtime.interviews.answer(
      identity,
      v.id,
      v.turns[0].id,
      { version: v.version, text: '回答' },
      randomUUID(),
    ),
    (e: ServiceError) => e.code === 'invalid_state',
  );
  const start = v.started_at;
  v = await runtime.interviews.resume(identity, v.id, { version: v.version }, randomUUID());
  assert.equal(v.turns.length, 1);
  assert.equal(v.started_at, start);
});
test('ending while the model is working fences late output and retains the saved answer', async () => {
  let v = await started();
  let release!: () => void;
  let entered!: () => void;
  const called = new Promise<void>((resolve) => {
    entered = resolve;
  });
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const original = agent.advance;
  agent.advance = async (...args) => {
    entered();
    await gate;
    return original(...args);
  };
  v = await runtime.interviews.answer(
    identity,
    v.id,
    v.turns[0].id,
    { version: v.version, text: '我通过回归测试确认修改。' },
    randomUUID(),
  );
  const executing = runTask(database, v.task_id!, runtime.handlers);
  await called;
  const finished = await runtime.interviews.finish(
    identity,
    v.id,
    { version: v.version, reason: 'user_finished' },
    randomUUID(),
  );
  release();
  await executing;
  const current = await runtime.interviews.read(identity, v.id);
  assert.equal(current.status, 'completed');
  assert.equal(current.turns.length, 1);
  assert.equal(current.turns[0].answer_text, finished.turns[0].answer_text);
});
test('12-minute deadline seals paused sessions without a browser and zero-answer reports skip the model', async () => {
  let v = await started();
  v = await runtime.interviews.pause(identity, v.id, { version: v.version }, randomUUID());
  await database.pool.query(
    "UPDATE interviews SET started_at=now()-interval '13 minutes' WHERE id=$1",
    [v.id],
  );
  agent.evaluate = async () => {
    throw new Error('must not evaluate empty interview');
  };
  await runtime.maintain();
  v = await runtime.interviews.read(identity, v.id);
  assert.equal(v.status, 'completed');
  assert.equal(v.end_reason, 'hard_deadline');
  const report = await runtime.reports.get(identity, v.id);
  assert.equal(report.status, 'ready');
  assert.equal(report.evaluations.length, 0);
  assert.ok(
    Object.values(report.dimensions).every((d) => d.status === 'not_observed' && d.score === null),
  );
});
test('final draft is saved atomically on explicit finish, while an expired draft is excluded', async () => {
  let v = await started();
  v = await runtime.interviews.finish(
    identity,
    v.id,
    {
      version: v.version,
      reason: 'user_finished',
      final_answer: { turn_id: v.turns[0].id, text: '显式提交的草稿' },
    },
    randomUUID(),
  );
  assert.equal(v.turns[0].answer_text, '显式提交的草稿');
  let late = await started();
  await database.pool.query(
    "UPDATE interviews SET started_at=now()-interval '13 minutes' WHERE id=$1",
    [late.id],
  );
  late = await runtime.interviews.finish(
    identity,
    late.id,
    {
      version: late.version,
      reason: 'user_finished',
      final_answer: { turn_id: late.turns[0].id, text: '迟到草稿' },
    },
    randomUUID(),
  );
  assert.equal(late.turns[0].answer_text, null);
});
test('provider failure is bounded; generation fallback continues without rolling back an answer', async () => {
  let v = await started();
  agent.advance = async () => {
    throw new Error('provider failure');
  };
  v = await runtime.interviews.answer(
    identity,
    v.id,
    v.turns[0].id,
    { version: v.version, text: '应当保留的回答' },
    randomUUID(),
  );
  await drain();
  v = await runtime.interviews.read(identity, v.id);
  assert.equal(v.generation_status, 'failed');
  assert.equal(v.turns[0].answer_text, '应当保留的回答');
  const task = (await database.pool.query('SELECT attempts FROM tasks WHERE id=$1', [v.task_id]))
    .rows[0];
  assert.equal(task.attempts, 2);
  v = await runtime.interviews.retryGeneration(
    identity,
    v.id,
    { version: v.version, fallback: true },
    randomUUID(),
  );
  assert.equal(v.turns.length, 2);
  assert.equal(v.turns[1].follow_up_index, 0);
});
test('reports reject fabricated evidence, retry independently and do not score unobserved skills', async () => {
  let v = await started();
  const evaluate = agent.evaluate;
  agent.evaluate = async (...args) => {
    const result = await evaluate(...args);
    result.strengths[0].evidence_refs[0].quote = '不存在的原文';
    return result;
  };
  v = await runtime.interviews.finish(
    identity,
    v.id,
    {
      version: v.version,
      reason: 'user_finished',
      final_answer: { turn_id: v.turns[0].id, text: '我先复现问题再修改。' },
    },
    randomUUID(),
  );
  await drain();
  let report = await runtime.reports.get(identity, v.id);
  assert.equal(report.status, 'failed');
  agent.evaluate = evaluate;
  report = await runtime.reports.request(identity, v.id, { version: report.version }, randomUUID());
  assert.equal(report.status, 'pending');
  await drain();
  report = await runtime.reports.get(identity, v.id);
  assert.equal(report.status, 'ready');
  assert.equal(report.evaluations.length, 1);
  assert.ok(Object.values(report.dimensions).every((d) => d.score === null));
});
test('deleting a source removes comparisons, unlinks independent retry answers and cancels private tasks', async () => {
  let v = await started();
  v = await runtime.interviews.finish(
    identity,
    v.id,
    {
      version: v.version,
      reason: 'user_finished',
      final_answer: { turn_id: v.turns[0].id, text: '原始私有回答' },
    },
    randomUUID(),
  );
  await drain();
  let retry = await runtime.interviews.createRetry(
    identity,
    v.id,
    { turn_id: v.turns[0].id, revision: 1, goal: '补充验证' },
    randomUUID(),
  );
  retry = await runtime.interviews.start(
    identity,
    retry.id,
    { version: retry.version },
    randomUUID(),
  );
  retry = await runtime.interviews.answer(
    identity,
    retry.id,
    retry.turns[0].id,
    { version: retry.version, text: '独立重练回答' },
    randomUUID(),
  );
  await drain();
  const compare = await runtime.reports.createComparison(
    identity,
    {
      original_interview_id: v.id,
      retry_interview_id: retry.id,
      original_turn_id: v.turns[0].id,
      retry_turn_id: retry.turns[0].id,
      original_revision: 1,
      retry_revision: 1,
    },
    randomUUID(),
  );
  await runtime.interviews.delete(identity, v.id, { version: v.version }, randomUUID());
  await assert.rejects(
    runtime.reports.getComparison(identity, compare.id),
    (e: ServiceError) => e.statusCode === 404,
  );
  retry = await runtime.interviews.read(identity, retry.id);
  assert.equal(retry.parent_interview_id, null);
  assert.equal(retry.turns[0].answer_text, '独立重练回答');
  assert.equal(
    (
      await database.pool.query(
        "SELECT count(*) FROM tasks WHERE payload->>'interview_id'=$1 OR payload->>'comparison_id'=$2",
        [v.id, compare.id],
      )
    ).rows[0].count,
    '0',
  );
});
test('all interview types and empty knowledge can start without private material', async () => {
  runtime = createInterviewRuntime(database, config, {
    agent,
    knowledge: {
      read: async () => ({
        content_version: 'empty-v1',
        questions: [],
        sources: [],
        missing_reason: '知识库尚未接入',
      }),
    },
  });
  for (const interview_type of ['technical_qa', 'project_deep_dive', 'hr', 'mixed'] as const) {
    const v = await started({ ...configuration, interview_type });
    assert.equal(v.turns.length, 1);
    assert.equal(v.turns[0].stage, 'introduction');
    assert.match(v.turns[0].text, /自我介绍/);
    assert.equal(v.task_id, null);
  }
});
test('interview-only composition seals answers and hands off without generating reports', async () => {
  let handedOff = false;
  agent.evaluate = async () => {
    throw new Error('report evaluation is outside this composition');
  };
  runtime = createInterviewRuntime(database, config, {
    agent,
    onFinalize: async (_tx, state) => {
      assert.equal(state.view.status, 'completed');
      assert.ok(state.snapshot);
      handedOff = true;
    },
  });
  let v = await started();
  v = await runtime.interviews.finish(
    identity,
    v.id,
    {
      version: v.version,
      reason: 'user_finished',
      final_answer: { turn_id: v.turns[0].id, text: '合成面试联调回答' },
    },
    randomUUID(),
  );
  await drain();
  assert.equal(handedOff, true);
  const finalized = await runtime.interviews.readFinalized(identity, v.id);
  assert.equal(finalized.view.turns[0].answer_text, '合成面试联调回答');
  assert.equal(
    (
      await database.pool.query('SELECT count(*) FROM interview_reports WHERE interview_id=$1', [
        v.id,
      ])
    ).rows[0].count,
    '0',
  );
  assert.equal(
    (
      await database.pool.query(
        "SELECT count(*) FROM tasks WHERE type LIKE 'reports.%' AND payload->>'interview_id'=$1",
        [v.id],
      )
    ).rows[0].count,
    '0',
  );
});
test('server rejects a model that tries to finish before the conversation develops', async () => {
  let v = await started();
  agent.advance = async () => ({ action: 'finish', question: null, clarification: null });
  v = await runtime.interviews.answer(
    identity,
    v.id,
    v.turns[0].id,
    { version: v.version, text: '我想申请后端实习，做过课程预约项目。' },
    randomUUID(),
  );
  await drain();
  v = await runtime.interviews.read(identity, v.id);
  assert.equal(v.status, 'in_progress');
  assert.equal(v.generation_status, 'failed');
  assert.equal(v.turns[0].answer_status, 'answered');
});
test('skipping every conversational question terminates within the main-question budget without evaluating empty answers', async () => {
  let v = await started();
  agent.advance = async (view) => ({
    action: 'next',
    clarification: null,
    question: {
      ...question(`请聊聊你的第 ${view.turns.length} 段学习经历。`),
      stage: 'experience',
    },
  });
  agent.evaluate = async () => {
    throw new Error('empty answers must not be evaluated');
  };
  for (let step = 0; step < 6; step++) {
    v = await runtime.interviews.action(
      identity,
      v.id,
      v.turns.at(-1)!.id,
      { version: v.version, action: 'skip' },
      randomUUID(),
    );
    await drain();
    v = await runtime.interviews.read(identity, v.id);
  }
  assert.equal(v.status, 'completed');
  assert.equal(v.turns.length, 6);
  assert.equal((await runtime.reports.get(identity, v.id)).evaluations.length, 0);
});
test('history pagination stays isolated and malformed typed cursors return input errors', async () => {
  await runtime.interviews.create(identity, configuration, randomUUID());
  await runtime.interviews.create(identity, configuration, randomUUID());
  const first = await runtime.interviews.list(identity, { limit: 1 });
  assert.ok(first.next_cursor);
  const second = await runtime.interviews.list(identity, { limit: 1, cursor: first.next_cursor });
  assert.notEqual(first.items[0].id, second.items[0].id);
  assert.equal(
    (await runtime.interviews.list({ owner_id: 'another-student', roles: [] }, { limit: 20 })).items
      .length,
    0,
  );
  for (const malformed of [
    { at: '0', id: randomUUID() },
    { at: new Date().toISOString(), id: '-'.repeat(36) },
  ]) {
    const cursor = Buffer.from(
      JSON.stringify({ ...malformed, fingerprint: inputDigest({}) }),
    ).toString('base64url');
    await assert.rejects(
      runtime.interviews.list(identity, { limit: 1, cursor }),
      (e: ServiceError) => e.statusCode === 400,
    );
  }
});
test('durable outbox survives worker restart and advertises registered business handlers', async () => {
  let v = await runtime.interviews.create(identity, configuration, randomUUID());
  v = await runtime.interviews.start(identity, v.id, { version: v.version }, randomUUID());
  v = await runtime.interviews.answer(
    identity,
    v.id,
    v.turns[0].id,
    { version: v.version, text: '我负责过课程项目的前端页面。' },
    randomUUID(),
  );
  for (let restart = 0; restart < 2; restart++) {
    const worker = await startWorker(config, {
      database,
      handlers: runtime.handlers,
      maintain: runtime.maintain,
      isCancelled: runtime.isCancelled,
    });
    try {
      const deadline = Date.now() + 8000;
      while (
        (await runtime.interviews.read(identity, v.id)).turns.length === 1 &&
        Date.now() < deadline
      )
        await new Promise((r) => setTimeout(r, 100));
      assert.equal((await runtime.interviews.read(identity, v.id)).turns.length, 2);
    } finally {
      await worker.close();
    }
  }
});

test('report summary failure preserves per-turn evidence and summary-only retry never reevaluates answers', async () => {
  let calls = 0;
  const evaluate = agent.evaluate;
  const summarize = agent.summarize;
  agent.evaluate = async (...args) => {
    calls++;
    return evaluate(...args);
  };
  agent.summarize = async () => {
    throw new ServiceError('provider_timeout', 502, 'controlled timeout');
  };
  let v = await started();
  v = await runtime.interviews.finish(
    identity,
    v.id,
    {
      version: v.version,
      reason: 'user_finished',
      final_answer: { turn_id: v.turns[0].id, text: '我负责测试并记录边界条件。' },
    },
    randomUUID(),
  );
  await drain();
  const partial = await runtime.reports.get(identity, v.id);
  assert.equal(partial.status, 'ready');
  assert.equal(partial.summary_status, 'failed');
  assert.equal(partial.evaluations.length, 1);
  assert.equal(partial.is_partial, true);
  const evaluationsBefore = calls;
  agent.summarize = summarize;
  const key = randomUUID();
  const body = { version: partial.version, scope: 'summary' as const };
  const queued = await runtime.reports.request(identity, v.id, body, key);
  assert.equal(queued.summary_status, 'pending');
  assert.equal(queued.version, partial.version + 1);
  await runtime.reports.request(identity, v.id, body, key);
  await assert.rejects(
    runtime.reports.request(identity, v.id, body, randomUUID()),
    (e: ServiceError) => e.code === 'version_conflict',
  );
  await drain();
  const ready = await runtime.reports.get(identity, v.id);
  assert.equal(ready.summary_status, 'ready');
  assert.ok(ready.summary?.overview.evidence_refs.length);
  assert.equal(calls, evaluationsBefore);
  await assert.rejects(
    runtime.reports.request(
      { owner_id: 'other', roles: [] },
      v.id,
      { version: ready.version, scope: 'summary' },
      randomUUID(),
    ),
    (e: ServiceError) => e.statusCode === 404,
  );
});

test('report GET exposes successful results while another answer is pending; missing-only retry reuses successes', async () => {
  let v = await started();
  const firstId = v.turns[0].id;
  v = await runtime.interviews.answer(
    identity,
    v.id,
    firstId,
    { version: v.version, text: '我先记录测试结果。' },
    randomUUID(),
  );
  await drain();
  v = await runtime.interviews.read(identity, v.id);
  const secondId = v.turns[1].id;
  const evaluate = agent.evaluate;
  const calls = new Map<string, number>();
  let fail = true;
  agent.evaluate = async (...args) => {
    calls.set(args[0].id, (calls.get(args[0].id) ?? 0) + 1);
    if (fail && args[0].id === secondId)
      throw new ServiceError('provider_timeout', 502, 'controlled');
    return evaluate(...args);
  };
  v = await runtime.interviews.finish(
    identity,
    v.id,
    {
      version: v.version,
      reason: 'user_finished',
      final_answer: { turn_id: secondId, text: '我用边界用例复核结果。' },
    },
    randomUUID(),
  );
  const rows = await database.pool.query<{ id: string }>(
    "SELECT id FROM tasks WHERE type='reports.evaluate.v1' AND payload->>'turn_id'=$1",
    [firstId],
  );
  await runTask(database, rows.rows[0].id, runtime.handlers);
  const interim = await runtime.reports.get(identity, v.id);
  assert.equal(interim.evaluations.length, 1);
  assert.deepEqual(interim.analysis_progress, { total: 2, completed: 1, failed: 0, pending: 1 });
  await drain();
  const partial = await runtime.reports.get(identity, v.id);
  assert.equal(partial.summary_status, 'ready');
  assert.deepEqual(partial.missing_turn_ids, [secondId]);
  const firstCalls = calls.get(firstId);
  fail = false;
  await runtime.reports.request(identity, v.id, { version: partial.version }, randomUUID());
  await drain();
  const ready = await runtime.reports.get(identity, v.id);
  assert.equal(ready.summary_status, 'ready');
  assert.equal(ready.evaluations.length, 2);
  assert.equal(ready.missing_turn_ids.length, 0);
  assert.equal(calls.get(firstId), firstCalls);
});

test('legacy reports do not request summaries on GET; an explicit summary request upgrades them', async () => {
  let v = await started();
  v = await runtime.interviews.finish(
    identity,
    v.id,
    {
      version: v.version,
      reason: 'user_finished',
      final_answer: { turn_id: v.turns[0].id, text: '我负责测试。' },
    },
    randomUUID(),
  );
  await drain();
  await database.pool.query(
    "UPDATE interview_reports SET result=result-'summary'-'summary_status'-'analysis_metadata',summary_task_id=NULL,summary_input_digest=NULL WHERE interview_id=$1",
    [v.id],
  );
  const before = await database.pool.query(
    "SELECT count(*) FROM tasks WHERE type='reports.summarize.v1'",
  );
  const legacy = await runtime.reports.get(identity, v.id);
  assert.equal(legacy.summary_status, 'not_requested');
  assert.equal(legacy.summary, null);
  await runtime.maintain();
  assert.deepEqual(
    (await database.pool.query("SELECT count(*) FROM tasks WHERE type='reports.summarize.v1'"))
      .rows,
    before.rows,
  );
  await runtime.reports.request(
    identity,
    v.id,
    { version: legacy.version, scope: 'summary' },
    randomUUID(),
  );
  await drain();
  assert.equal((await runtime.reports.get(identity, v.id)).summary_status, 'ready');
});

test('deleting an interview during summary generation prevents publication and removes its summary task', async () => {
  const summarize = agent.summarize;
  let v = await started();
  agent.summarize = async (...args) => {
    const result = await summarize(...args);
    await runtime.interviews.delete(identity, v.id, { version: v.version }, randomUUID());
    return result;
  };
  v = await runtime.interviews.finish(
    identity,
    v.id,
    {
      version: v.version,
      reason: 'user_finished',
      final_answer: { turn_id: v.turns[0].id, text: '我负责测试。' },
    },
    randomUUID(),
  );
  await drain();
  await assert.rejects(
    runtime.reports.get(identity, v.id),
    (e: ServiceError) => e.statusCode === 404,
  );
  assert.equal(
    (
      await database.pool.query('SELECT count(*) FROM interview_reports WHERE interview_id=$1', [
        v.id,
      ])
    ).rows[0].count,
    '0',
  );
  assert.equal(
    (
      await database.pool.query(
        "SELECT count(*) FROM tasks WHERE type='reports.summarize.v1' AND payload->>'interview_id'=$1",
        [v.id],
      )
    ).rows[0].count,
    '0',
  );
});

test('a summary computed for an obsolete report version is cancelled instead of published', async () => {
  const summarize = agent.summarize;
  let v = await started();
  agent.summarize = async (...args) => {
    const value = await summarize(...args);
    // Simulate a concurrent source/version invalidation while the provider is running.
    await database.pool.query(
      "UPDATE interview_reports SET version=version+1,result=jsonb_set(result,'{version}',to_jsonb(version+1)) WHERE interview_id=$1",
      [v.id],
    );
    return value;
  };
  v = await runtime.interviews.finish(
    identity,
    v.id,
    {
      version: v.version,
      reason: 'user_finished',
      final_answer: { turn_id: v.turns[0].id, text: '我负责验证边界条件。' },
    },
    randomUUID(),
  );
  await drain();
  const report = await runtime.reports.get(identity, v.id);
  assert.equal(report.version, 2);
  assert.equal(report.summary, null);
  const task = (
    await database.pool.query(
      "SELECT status,result_ref FROM tasks WHERE type='reports.summarize.v1' AND payload->>'interview_id'=$1",
      [v.id],
    )
  ).rows[0];
  assert.equal(task.status, 'cancelled');
  assert.equal(task.result_ref, null);
});
