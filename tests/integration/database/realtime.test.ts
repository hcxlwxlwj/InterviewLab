import { before, after, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { config as dotenv } from 'dotenv';
import { loadConfig } from '../../../code/backend/src/foundation/config';
import { createDatabase, type Database } from '../../../code/backend/src/database/connection';
import { migrateDatabase } from '../../../code/backend/src/database/migrate';
import { createInterviewRuntime } from '../../../code/backend/src/modules/interview-runtime';
import { createModelAnalysis } from '../../../code/backend/src/modules/interviews/model-analysis';
import { createStreamingAgent } from '../../../code/backend/src/modules/interviews/streaming-agent';
import { currentKnowledgeFixture } from '../../support/knowledge-fixture';
import { buildApp } from '../../../code/backend/src/server/app';
import { runTask } from '../../../code/backend/src/tasks/runner';
import { loadInterview } from '../../../code/backend/src/modules/interviews/repository';
import type { InterviewRuntimeOptions } from '../../../code/backend/src/modules/interview-runtime';
import type { InterviewKnowledgeRuntime } from '@interviewlab/core';
import { InterviewVoiceSession } from '../../../code/backend/src/modules/interviews/voice/session';
import { voiceFixture, waitFor } from '../../support/voice-fixture';
import type { InterviewConfig, InterviewKnowledge } from '@interviewlab/core';
dotenv({ quiet: true });
const url = process.env.TEST_DATABASE_URL;
if (!url || !/^interviewlab_test[a-z0-9_]*$/.test(new URL(url).pathname.slice(1)))
  throw new Error('Dedicated test database required');
const config = loadConfig({
  DATABASE_URL: url,
  DATABASE_POOL_SIZE: 1,
  NODE_ENV: 'test',
  LLM_API_KEY: 'controlled',
  LOG_LEVEL: 'silent',
});
const owner = { owner_id: 'realtime-owner', roles: [] };
let database: Database;
let knowledge: InterviewKnowledge;
const configuration: InterviewConfig = {
  job: 'frontend',
  career_stage: 'internship',
  interview_type: 'technical_qa',
  difficulty: '基础',
  duration_minutes: 5,
  interviewer_style: '标准',
  interaction_mode: 'text_fallback',
};
before(async () => {
  database = createDatabase(config);
  await migrateDatabase(database);
  const seed = await currentKnowledgeFixture();
  knowledge = {
    content_version: seed.id,
    questions: [],
    sources: [],
    missing_reason: 'Controlled test',
    agent_release: {
      id: seed.id,
      embedding_model: 'ecnu-embedding-small',
      dimensions: 1024,
      profile: seed.profiles[0],
      competencies: seed.competencies,
    },
  };
});
after(async () => database?.close());
beforeEach(async () => {
  await database.pool.query('TRUNCATE interviews,tasks,idempotency_records CASCADE');
});
function runtime(blocked = false, extra: InterviewRuntimeOptions = {}) {
  const modelInputs: unknown[] = [];
  let release = () => {};
  const gate = new Promise<void>((r) => (release = r));
  let reached = () => {};
  const previewReady = new Promise<void>((r) => (reached = r));
  const agent = createStreamingAgent(
    createModelAnalysis(config),
    config,
    () => {},
    async (_url, init) => {
      const body = JSON.parse(init!.body as string);
      modelInputs.push(body);
      assert.equal(body.stream, true);
      const raw = JSON.stringify({
        a: 'f',
        g: 1,
        e: 0,
        o: 0,
        q: '你提到缓存，如何验证数据仍然正确？',
        s: [],
        r: [],
      });
      let cancelled = false;
      const response = new Response(
        new ReadableStream({
          async start(c) {
            const cut = raw.indexOf(',"s"');
            c.enqueue(
              new TextEncoder().encode(
                'data: ' +
                  JSON.stringify({ choices: [{ delta: { content: raw.slice(0, cut) } }] }) +
                  '\n\n',
              ),
            );
            reached();
            if (blocked) await gate;
            if (cancelled) return;
            c.enqueue(
              new TextEncoder().encode(
                'data: ' +
                  JSON.stringify({ choices: [{ delta: { content: raw.slice(cut) } }] }) +
                  '\n\ndata: [DONE]\n\n',
              ),
            );
            c.close();
          },
          cancel() {
            cancelled = true;
          },
        }),
      );
      return response;
    },
  );
  const options = {
    agent,
    knowledge: { read: async () => knowledge },
    onFinalize: async () => {},
    ...extra,
  };
  return {
    value: createInterviewRuntime(database, config, options),
    options,
    release,
    previewReady,
    modelInputs,
  };
}
async function ready(r: ReturnType<typeof runtime>) {
  let v = await r.value.interviews.create(owner, configuration, crypto.randomUUID());
  v = await r.value.interviews.prepare(owner, v.id, { version: v.version, mode: 'fallback' }, crypto.randomUUID());
  v = await r.value.interviews.start(owner, v.id, { version: v.version }, crypto.randomUUID());
  v = await r.value.interviews.answer(
    owner,
    v.id,
    v.turns[0].id,
    { version: v.version, text: '我负责课程页面缓存，没有测过加载时间。' },
    crypto.randomUUID(),
  );
  return v;
}
test('v3 publication atomically saves memory and private retrieval while public DTOs remain clean', async () => {
  const r = runtime();
  try {
    let v = await ready(r);
    await runTask(database, v.task_id!, r.value.handlers);
    v = await r.value.interviews.read(owner, v.id);
    assert.equal(v.generation_status, 'ready');
    const state = await loadInterview(database.pool, owner.owner_id, v.id);
    assert.equal(state.memory?.version, 1);
    assert.equal(state.memory?.claims[0].text, '我负责课程页面缓存，没有测过加载时间。');
    assert.ok(state.retrievals?.[v.turns.at(-1)!.id]);
    assert.ok(!('agent_memory' in v));
    assert.equal(
      (await database.pool.query('SELECT * FROM interview_generation_streams')).rowCount,
      0,
    );
  } finally {
    await r.value.close();
  }
});
for (const operation of ['pause', 'delete'] as const)
  test(`${operation} cancels a live stream and prevents late private publication`, async () => {
    const r = runtime(true);
    let app: Awaited<ReturnType<typeof buildApp>> | undefined;
    try {
      const v = await ready(r);
      app = await buildApp({
        config,
        database,
        logger: false,
        identity: { authenticate: async () => owner },
        interview: r.options,
      });
      await app.listen({ host: '127.0.0.1', port: 0 });
      const address = app.server.address();
      assert.ok(address && typeof address === 'object');
      const stream = await fetch(
        `http://127.0.0.1:${address.port}/api/v1/interviews/${v.id}/events?generation_id=${v.generation_id}`,
      );
      assert.equal(stream.status, 200);
      const reader = stream.body!.getReader();
      await reader.read();
      const running = runTask(database, v.task_id!, r.value.handlers, 60000, r.value.isCancelled);
      await r.previewReady;
      for (let i = 0; i < 100; i++) {
        if ((await database.pool.query('SELECT * FROM interview_generation_streams')).rowCount)
          break;
        await new Promise((x) => setTimeout(x, 10));
      }
      assert.equal(
        (await database.pool.query('SELECT * FROM interview_generation_streams')).rowCount,
        1,
      );
      if (operation === 'pause')
        await r.value.interviews.pause(owner, v.id, { version: v.version }, crypto.randomUUID());
      else
        await r.value.interviews.delete(owner, v.id, { version: v.version }, crypto.randomUUID());
      r.release();
      await running;
      let frames = '';
      const decoder = new TextDecoder();
      while (true) {
        const part = await reader.read();
        if (part.done) break;
        frames += decoder.decode(part.value);
      }
      assert.ok(frames.includes('invalidated'));
      assert.equal(
        (await database.pool.query('SELECT * FROM interview_generation_streams')).rowCount,
        0,
      );
      if (operation === 'pause') {
        const state = await loadInterview(database.pool, owner.owner_id, v.id);
        assert.equal(state.memory?.version, 0);
        assert.equal(state.view.turns.length, 1);
      } else {
        await assert.rejects(r.value.interviews.read(owner, v.id));
      }
    } finally {
      r.release();
      await app?.close();
      await r.value.close();
    }
  });
test('event endpoint verifies ownership before opening a connection', async () => {
  const r = runtime();
  const v = await ready(r);
  const app = await buildApp({
    config,
    database,
    logger: false,
    identity: { authenticate: async () => ({ owner_id: 'other', roles: [] }) },
    interview: r.options,
  });
  try {
    const result = await app.inject({
      url: `/api/v1/interviews/${v.id}/events?generation_id=${v.generation_id}`,
    });
    assert.equal(result.statusCode, 404);
  } finally {
    await app.close();
    await r.value.close();
  }
});

test('participation reminders, confirmation and sealing are atomic, durable and idempotent without model tasks', async () => {
  const r = runtime();
  try {
    let v = await r.value.interviews.create(owner, configuration, crypto.randomUUID());
    v = await r.value.interviews.prepare(owner, v.id, { version: v.version, mode: 'fallback' }, crypto.randomUUID());
    v = await r.value.interviews.start(owner, v.id, { version: v.version }, crypto.randomUUID());
    const firstTurn = v.turns.at(-1)!;
    const firstBody = { version: v.version, text: '我不配合' };
    const firstKey = crypto.randomUUID();
    v = await r.value.interviews.answer(owner, v.id, firstTurn.id, firstBody, firstKey);
    assert.equal(v.participation?.level, 'reminder');
    assert.equal(v.generation_status, 'ready');
    assert.equal(v.task_id, null);
    assert.equal(v.turns.length, 2);
    assert.equal(v.turns[0].answer_text, '我不配合');
    const replay = await r.value.interviews.answer(owner, v.id, firstTurn.id, firstBody, firstKey);
    assert.equal(replay.turns.length, 2);
    assert.deepEqual(replay.participation, v.participation);
    v = await r.value.interviews.pause(owner, v.id, { version: v.version }, crypto.randomUUID());
    v = await r.value.interviews.resume(owner, v.id, { version: v.version }, crypto.randomUUID());
    assert.equal(v.participation?.level, 'reminder');
    assert.equal(v.task_id, null);
    v = await r.value.interviews.answer(
      owner,
      v.id,
      v.turns.at(-1)!.id,
      { version: v.version, text: '我不配合' },
      crypto.randomUUID(),
    );
    assert.equal(v.participation?.level, 'confirmation');
    const finalTurn = v.turns.at(-1)!;
    const finalBody = { version: v.version, text: '我不配合' };
    const finalKey = crypto.randomUUID();
    v = await r.value.interviews.answer(owner, v.id, finalTurn.id, finalBody, finalKey);
    assert.equal(v.status, 'completed');
    assert.equal(v.end_reason, 'participation:explicit_non_participation');
    assert.equal(v.participation?.level, 'ended');
    assert.equal(v.generation_id, null);
    assert.equal(v.turns.length, 3);
    assert.ok(v.turns.every((t) => t.answer_status === 'answered' && t.answer_text === '我不配合'));
    assert.equal(
      (await database.pool.query("SELECT id FROM tasks WHERE type LIKE 'interviews.%'")).rowCount,
      0,
    );
    const sealed = await r.value.interviews.answer(owner, v.id, finalTurn.id, finalBody, finalKey);
    assert.deepEqual(sealed.participation, v.participation);
    await assert.rejects(
      r.value.interviews.resume(owner, v.id, { version: v.version }, crypto.randomUUID()),
    );
    await assert.rejects(r.value.interviews.read({ owner_id: 'other', roles: [] }, v.id));
    await r.value.interviews.delete(owner, v.id, { version: v.version }, crypto.randomUUID());
    await assert.rejects(r.value.interviews.answer(owner, v.id, finalTurn.id, finalBody, finalKey));
  } finally {
    await r.value.close();
  }
});

test('a substantive answer clears the warning and returns to the existing model path', async () => {
  const r = runtime();
  try {
    let v = await r.value.interviews.create(owner, configuration, crypto.randomUUID());
    v = await r.value.interviews.prepare(owner, v.id, { version: v.version, mode: 'fallback' }, crypto.randomUUID());
    v = await r.value.interviews.start(owner, v.id, { version: v.version }, crypto.randomUUID());
    v = await r.value.interviews.answer(
      owner,
      v.id,
      v.turns.at(-1)!.id,
      { version: v.version, text: '我不配合' },
      crypto.randomUUID(),
    );
    v = await r.value.interviews.answer(
      owner,
      v.id,
      v.turns.at(-1)!.id,
      { version: v.version, text: '我负责课程页面缓存，没有测过加载时间。' },
      crypto.randomUUID(),
    );
    assert.equal(v.participation, null);
    assert.equal(v.generation_status, 'pending');
    await runTask(database, v.task_id!, r.value.handlers);
    v = await r.value.interviews.read(owner, v.id);
    assert.equal(v.generation_status, 'ready');
    assert.equal(v.participation, null);
    assert.equal(v.status, 'in_progress');
  } finally {
    await r.value.close();
  }
});

test('voice answers use our existing knowledge runtime and pass its retrieved content to the original Agent', async () => {
  const marker = 'controlled-private-course-cache-reference';
  const answer =
    '我在课程中做了一个校园二手交易网站，用于让同学发布和购买二手物品。我负责前端商品列表页面，使用 React 实现分页和缓存，并通过测试验证缓存命中率。';
  const retrievedFor: string[] = [];
  const chunk = {
    id: marker,
    card_id: marker,
    release: knowledge.content_version,
    text: '本项目知识库：缓存验证需比较命中率、正确性与失效条件。',
    source_refs: ['course-owned-source'],
    goals: ['verification'],
    types: ['technical_qa' as const],
  };
  const ownKnowledge: InterviewKnowledgeRuntime = {
    enabled: true,
    read: async () => knowledge,
    profiles: async () => ({
      version: knowledge.content_version,
      default_type: 'technical_qa',
      profiles: [knowledge.agent_release!.profile],
    }),
    prefetch() {},
    async context(_configuration, snapshot, _memory, text) {
      assert.equal(snapshot.content_version, knowledge.content_version);
      retrievedFor.push(text);
      return {
        release: knowledge.content_version,
        chunks: [chunk],
        mode: 'supplemental',
        missing_reason: null,
      };
    },
  };
  const r = runtime(false, { realtimeKnowledge: ownKnowledge });
  const f = voiceFixture();
  let session: InterviewVoiceSession | undefined;
  try {
    let v = await r.value.interviews.create(owner, configuration, crypto.randomUUID());
    v = await r.value.interviews.prepare(owner, v.id, { version: v.version, mode: 'fallback' }, crypto.randomUUID());
    v = await r.value.interviews.start(owner, v.id, { version: v.version }, crypto.randomUUID());
    session = new InterviewVoiceSession(
      v.id,
      async () => owner,
      r.value.interviews,
      f.provider,
      30,
      (event) => f.events.push(event),
      () => {},
    );
    await session.start();
    const speech = f.events.find((event) => event.type === 'speech_start');
    assert.ok(speech?.type === 'speech_start');
    session.control({ type: 'speech_start' });
    f.recognize({ text: '这段背景声不能成为回答。', final: true });
    session.control({ type: 'speech_end' });
    await new Promise((resolve) => setTimeout(resolve, 50));
    assert.equal(f.speeches[0].signal.aborted, false);
    assert.ok(!f.events.some((event) => event.type === 'transcript'));
    assert.equal((await r.value.interviews.read(owner, v.id)).turns[0].answer_text, null);
    const recognitionCloses = f.metrics().closes;
    session.control({
      type: 'playback',
      speech_id: speech.speech_id,
      played_ms: 0,
      interrupted: false,
    });
    await waitFor(() => f.metrics().closes > recognitionCloses);
    session.control({ type: 'speech_start' });
    f.recognize({ text: answer, final: true });
    session.control({ type: 'speech_end' });
    await waitFor(() =>
      f.events.some((e) => e.type === 'interview' && e.interview.generation_status === 'pending'),
    );
    session.close();
    v = await r.value.interviews.read(owner, v.id);
    assert.equal(v.turns[0].input_mode, 'voice');
    assert.equal(v.turns[0].answer_text, answer);
    await runTask(database, v.task_id!, r.value.handlers);
    assert.deepEqual(retrievedFor, [answer]);
    assert.ok(
      JSON.stringify(r.modelInputs).includes(marker),
      'our knowledge must reach the original LLM request',
    );
    v = await r.value.interviews.read(owner, v.id);
    assert.equal(v.generation_status, 'ready');
    const state = await loadInterview(database.pool, owner.owner_id, v.id);
    assert.equal(state.retrievals?.[v.turns.at(-1)!.id].chunks[0].id, marker);
  } finally {
    session?.close();
    await r.value.close();
  }
});
