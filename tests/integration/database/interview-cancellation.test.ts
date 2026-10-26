import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { config as dotenv } from 'dotenv';
import { loadConfig } from '../../../code/backend/src/foundation/config';
import { createDatabase } from '../../../code/backend/src/database/connection';
import { migrateDatabase } from '../../../code/backend/src/database/migrate';
import { createInterviewRuntime } from '../../../code/backend/src/modules/interview-runtime';
import { runTask } from '../../../code/backend/src/tasks/runner';
import { createInterviewAgent } from '../../../code/backend/src/modules/interviews/agent';

dotenv({ quiet: true });
test('pausing cancels a running provider HTTP request; unknown worker types surface as failed generations', async () => {
  const url = process.env.TEST_DATABASE_URL;
  assert.ok(
    url && /^interviewlab_test[a-z0-9_]*$/.test(new URL(url).pathname.slice(1)),
    'Dedicated test database required',
  );
  const config = loadConfig({ DATABASE_URL: url, LLM_API_KEY: 'synthetic-key' });
  const database = createDatabase(config);
  const identity = { owner_id: `cancellation-${randomUUID()}`, roles: [] };
  let entered!: () => void;
  let aborted = false;
  const called = new Promise<void>((resolve) => {
    entered = resolve;
  });
  const agent = createInterviewAgent(
    config,
    async (_url, input) =>
      new Promise((_resolve, reject) => {
        entered();
        input?.signal?.addEventListener(
          'abort',
          () => {
            aborted = true;
            reject(new Error('cancelled'));
          },
          { once: true },
        );
      }),
  );
  const runtime = createInterviewRuntime(database, config, { agent });
  try {
    await migrateDatabase(database);
    let v = await runtime.interviews.create(
      identity,
      {
        job: 'backend',
        career_stage: 'internship',
        interview_type: 'project_deep_dive',
        difficulty: '基础',
        duration_minutes: 5,
        interviewer_style: '标准',
        interaction_mode: 'text_fallback',
      },
      randomUUID(),
    );
    v = await runtime.interviews.start(identity, v.id, { version: v.version }, randomUUID());
    v = await runtime.interviews.answer(
      identity,
      v.id,
      v.turns[0].id,
      { version: v.version, text: '我学过后端开发，正在做课程练习。' },
      randomUUID(),
    );
    const taskId = v.task_id!;
    const running = runTask(database, taskId, runtime.handlers, 60000, runtime.isCancelled);
    await called;
    v = await runtime.interviews.pause(identity, v.id, { version: v.version }, randomUUID());
    await running;
    assert.equal(aborted, true);
    assert.equal(
      (await database.pool.query('SELECT status FROM tasks WHERE id=$1', [taskId])).rows[0].status,
      'cancelled',
    );
    v = await runtime.interviews.resume(identity, v.id, { version: v.version }, randomUUID());
    await runTask(database, v.task_id!, {});
    await runtime.maintain();
    v = await runtime.interviews.read(identity, v.id);
    assert.equal(v.generation_status, 'failed');
    await runtime.interviews.delete(identity, v.id, { version: v.version }, randomUUID());
  } finally {
    await database.pool.query('DELETE FROM idempotency_records WHERE owner_id=$1', [
      identity.owner_id,
    ]);
    await database.close();
  }
});
