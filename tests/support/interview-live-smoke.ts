/** Explicit opt-in real-provider check. Only synthetic fixture text is transmitted. */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { config as dotenv } from 'dotenv';
import { loadConfig } from '../../code/backend/src/foundation/config';
import { createDatabase } from '../../code/backend/src/database/connection';
import { migrateDatabase } from '../../code/backend/src/database/migrate';
import { createInterviewRuntime } from '../../code/backend/src/modules/interview-runtime';
import { runTask, TaskDeliveryError } from '../../code/backend/src/tasks/runner';
import { interviewCases } from '../fixtures/interview-cases';
async function main() {
  dotenv({ quiet: true });
  const url = process.env.TEST_DATABASE_URL;
  if (!url || !/^interviewlab_test[a-z0-9_]*$/.test(new URL(url).pathname.slice(1)))
    throw new Error('Dedicated TEST_DATABASE_URL is required');
  const config = loadConfig({ ...process.env, DATABASE_URL: url });
  if (!config.LLM_API_KEY) throw new Error('Configure LLM_API_KEY in the local environment first');
  const database = createDatabase(config);
  const owner = `llm-smoke-${randomUUID()}`;
  const identity = { owner_id: owner, roles: [] };
  let calls = 0;
  const runtime = createInterviewRuntime(database, config, {
    log: () => {
      calls++;
    },
  });
  async function drain() {
    for (let round = 0; round < 8; round++) {
      const pending = await database.pool.query<{ id: string }>(
        "SELECT id FROM tasks WHERE owner_id=$1 AND (status='queued' OR (status='failed' AND attempts<max_attempts)) ORDER BY created_at,id",
        [owner],
      );
      if (!pending.rows.length) break;
      for (const task of pending.rows)
        try {
          await runTask(database, task.id, runtime.handlers);
        } catch (e) {
          if (!(e instanceof TaskDeliveryError)) throw e;
        }
    }
    await runtime.maintain();
    const failed = await database.pool.query<{ type: string; error_code: string | null }>(
      "SELECT type,error_code FROM tasks WHERE owner_id=$1 AND status='failed' AND attempts>=max_attempts",
      [owner],
    );
    if (failed.rows.length) console.error(JSON.stringify({ failed_tasks: failed.rows }));
  }
  try {
    await migrateDatabase(database);
    const fixture = interviewCases[0];
    let v = await runtime.interviews.create(
      identity,
      {
        job: fixture.job,
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
    await drain();
    v = await runtime.interviews.read(identity, v.id);
    assert.equal(v.turns.length, 1);
    const originalTurn = v.turns[0];
    v = await runtime.interviews.answer(
      identity,
      v.id,
      originalTurn.id,
      { version: v.version, text: fixture.original },
      randomUUID(),
    );
    await drain();
    v = await runtime.interviews.read(identity, v.id);
    assert.notEqual(v.generation_status, 'failed');
    if (v.status !== 'completed')
      v = await runtime.interviews.finish(
        identity,
        v.id,
        { version: v.version, reason: 'user_finished' },
        randomUUID(),
      );
    await drain();
    const report = await runtime.reports.get(identity, v.id);
    assert.equal(report.status, 'ready');
    assert.equal(report.overall_score, null);
    let retry = await runtime.interviews.createRetry(
      identity,
      v.id,
      {
        turn_id: originalTurn.id,
        revision: 1,
        goal: report.evaluations[0]?.retry_goal ?? '补充本人行动和验证过程',
      },
      randomUUID(),
    );
    retry = await runtime.interviews.start(
      identity,
      retry.id,
      { version: retry.version },
      randomUUID(),
    );
    assert.equal(retry.turns[0].text, originalTurn.text);
    retry = await runtime.interviews.answer(
      identity,
      retry.id,
      retry.turns[0].id,
      { version: retry.version, text: fixture.retry },
      randomUUID(),
    );
    await drain();
    assert.equal((await runtime.reports.get(identity, retry.id)).status, 'ready');
    const comparison = await runtime.reports.createComparison(
      identity,
      {
        original_interview_id: v.id,
        retry_interview_id: retry.id,
        original_turn_id: originalTurn.id,
        retry_turn_id: retry.turns[0].id,
        original_revision: 1,
        retry_revision: 1,
      },
      randomUUID(),
    );
    await drain();
    assert.equal((await runtime.reports.getComparison(identity, comparison.id)).status, 'ready');
    console.info(
      JSON.stringify({
        model: config.LLM_MODEL,
        result: 'real_provider_closed_loop_passed',
        invocations: calls,
        synthetic_case: fixture.id,
      }),
    );
  } finally {
    try {
      const rows = await database.pool.query<{ id: string }>(
        'SELECT id FROM interviews WHERE owner_id=$1',
        [owner],
      );
      for (const row of rows.rows) {
        const v = await runtime.interviews.read(identity, row.id);
        await runtime.interviews.delete(identity, row.id, { version: v.version }, randomUUID());
      }
      await database.pool.query('DELETE FROM idempotency_records WHERE owner_id=$1', [owner]);
    } finally {
      await database.close();
    }
  }
}
void main().catch((error) => {
  console.error(
    error instanceof assert.AssertionError
      ? 'Real provider output failed closed-loop assertions; synthetic records were cleaned up. Re-run with safe invocation metadata to investigate.'
      : 'Real provider smoke could not run; check LLM_API_KEY, TEST_DATABASE_URL and provider availability.',
  );
  process.exitCode = 1;
});
