import { after, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { config as dotenv } from 'dotenv';
import { loadConfig } from '../../../code/backend/src/foundation/config';
import { createDatabase, type Database } from '../../../code/backend/src/database/connection';
import { migrateDatabase } from '../../../code/backend/src/database/migrate';
import { createInterviewRuntime } from '../../../code/backend/src/modules/interview-runtime';
import type { InterviewAgent } from '../../../code/backend/src/modules/interviews/model-analysis';
import { runTask } from '../../../code/backend/src/tasks/runner';
import { interviewInputDigest } from '../../../code/backend/src/modules/interviews/service';
import { loadInterview } from '../../../code/backend/src/modules/interviews/repository';
import { testDatabaseUrl } from '../../support/test-database';

dotenv({ quiet: true });
const config = loadConfig({
  NODE_ENV: 'test',
  DATABASE_URL: testDatabaseUrl(),
  LOG_LEVEL: 'silent',
});
const owner = { owner_id: 'synthetic-voice-publication', roles: [] };
let database: Database;
let rt: ReturnType<typeof createInterviewRuntime>;
let modelCalls = 0;
const agent: InterviewAgent = {
  available: true,
  model: 'controlled-publication-test',
  async advance(interview) {
    modelCalls++;
    const previous = interview.turns.at(-1)!;
    return {
      action: 'next',
      clarification: null,
      question: {
        stage: 'experience',
        acknowledgement: '',
        text: '当时你如何验证结果？',
        topic: '验证',
        purpose: '了解实际验证过程',
        knowledge_question_id: null,
        source_refs: [],
        evidence_refs: [
          { turn_id: previous.id, revision: previous.revision, quote: previous.answer_text! },
        ],
      },
    };
  },
  async evaluate() {
    throw new Error('This publication test must not call scoring');
  },
  async summarize() {
    throw new Error('This publication test must not call summary');
  },
  async compare() {
    throw new Error('This publication test must not call comparison');
  },
};
before(async () => {
  database = createDatabase(config);
  await migrateDatabase(database);
});
after(async () => {
  await rt?.close();
  await database?.close();
});
beforeEach(async () => {
  await rt?.close();
  await database.pool.query('TRUNCATE interviews,tasks,idempotency_records CASCADE');
  modelCalls = 0;
  rt = createInterviewRuntime(database, config, { agent });
});
async function answered() {
  let view = await rt.interviews.create(
    owner,
    {
      job: 'frontend',
      career_stage: 'internship',
      interview_type: 'technical_qa',
      duration_minutes: 10,
      difficulty: '基础',
      interviewer_style: '标准',
      interaction_mode: 'realtime_voice',
    },
    randomUUID(),
  );
  view = await rt.interviews.prepare(
    owner,
    view.id,
    { version: view.version, mode: 'fallback' },
    randomUUID(),
  );
  view = await rt.interviews.start(owner, view.id, { version: view.version }, randomUUID());
  return rt.interviews.answer(
    owner,
    view.id,
    view.turns[0].id,
    { version: view.version, text: '我负责表单校验，做过空输入测试。', input_mode: 'voice' },
    randomUUID(),
  );
}
async function until(check: () => Promise<boolean>) {
  const end = Date.now() + 5000;
  while (Date.now() < end) {
    if (await check()) return;
    await delay(20);
  }
  assert.fail('publication did not reach the expected state');
}

test('unconfirmed speech holds the same model result while the committed answer is already queued for analysis', async () => {
  const v = await answered();
  const lease = {
    session_id: randomUUID(),
    turn_id: v.turns[0].id,
    generation_id: v.generation_id!,
    active: true,
  };
  const before = interviewInputDigest(await loadInterview(database.pool, owner.owner_id, v.id));
  assert.equal(await rt.interviews.setVoiceInputActivity(owner, v.id, lease), true);
  assert.equal(
    interviewInputDigest(await loadInterview(database.pool, owner.owner_id, v.id)),
    before,
  );
  assert.equal('voice_activity' in (await rt.interviews.read(owner, v.id)), false);
  const publication = runTask(database, v.task_id!, rt.handlers);
  await until(async () => modelCalls === 1);
  await delay(100);
  assert.equal((await rt.interviews.read(owner, v.id)).turns.length, 1);
  assert.equal(
    (await database.pool.query("SELECT count(*) FROM tasks WHERE type='reports.evaluate.v1'"))
      .rows[0].count,
    '1',
  );
  await rt.interviews.setVoiceInputActivity(owner, v.id, { ...lease, active: false });
  await publication;
  assert.equal((await rt.interviews.read(owner, v.id)).turns.length, 2);
  assert.equal(modelCalls, 1);
  assert.deepEqual(
    (await database.pool.query('SELECT status,attempts FROM tasks WHERE id=$1', [v.task_id]))
      .rows[0],
    { status: 'succeeded', attempts: 1 },
  );
  assert.equal(
    (await database.pool.query("SELECT count(*) FROM tasks WHERE type='reports.evaluate.v1'"))
      .rows[0].count,
    '1',
  );
});

test('activity is scoped to its owner, source generation and session, and a disconnected session expires', async () => {
  const v = await answered();
  const lease = {
    session_id: randomUUID(),
    turn_id: v.turns[0].id,
    generation_id: v.generation_id!,
    active: true,
  };
  await assert.rejects(
    rt.interviews.setVoiceInputActivity({ owner_id: 'another', roles: [] }, v.id, lease),
  );
  assert.equal(
    await rt.interviews.setVoiceInputActivity(owner, v.id, {
      ...lease,
      generation_id: randomUUID(),
    }),
    false,
  );
  await rt.interviews.setVoiceInputActivity(owner, v.id, lease);
  const second = { ...lease, session_id: randomUUID() };
  await rt.interviews.setVoiceInputActivity(owner, v.id, second);
  const publication = runTask(database, v.task_id!, rt.handlers);
  await until(async () => modelCalls === 1);
  await rt.interviews.setVoiceInputActivity(owner, v.id, { ...lease, active: false });
  await delay(80);
  assert.equal((await rt.interviews.read(owner, v.id)).turns.length, 1);
  await database.pool.query(
    "UPDATE interviews SET voice_activity=jsonb_set(voice_activity,ARRAY[$2,'expires_at'],to_jsonb('2000-01-01T00:00:00.000Z'::text)) WHERE id=$1",
    [v.id, second.session_id],
  );
  await publication;
  assert.equal(modelCalls, 1);
  assert.equal((await rt.interviews.read(owner, v.id)).turns.length, 2);
});

test('confirmed supplementary words cancel the held generation and only the new revision can publish', async () => {
  let v = await answered();
  const oldTask = v.task_id!;
  const lease = {
    session_id: randomUUID(),
    turn_id: v.turns[0].id,
    generation_id: v.generation_id!,
    active: true,
  };
  await rt.interviews.setVoiceInputActivity(owner, v.id, lease);
  const publication = runTask(database, oldTask, rt.handlers);
  await until(async () => modelCalls === 1);
  await assert.rejects(
    rt.interviews.continueVoice(
      owner,
      v.id,
      v.turns[0].id,
      { version: v.version, text: '' },
      randomUUID(),
    ),
  );
  v = await rt.interviews.continueVoice(
    owner,
    v.id,
    v.turns[0].id,
    { version: v.version, text: '我还检查了格式错误。' },
    randomUUID(),
  );
  await rt.interviews.setVoiceInputActivity(owner, v.id, { ...lease, active: false });
  await publication;
  await runTask(database, v.task_id!, rt.handlers);
  const final = await rt.interviews.read(owner, v.id);
  assert.equal(final.turns.length, 2);
  assert.equal(final.turns[0].revision, 2);
  assert.match(final.turns[0].answer_text!, /我还检查了格式错误/);
  assert.equal(
    (await database.pool.query('SELECT status FROM tasks WHERE id=$1', [oldTask])).rows[0].status,
    'cancelled',
  );
  assert.equal(modelCalls, 2);
});
