import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { config as dotenv } from 'dotenv';
import { loadConfig } from '../../../code/backend/src/foundation/config';
import { createDatabase, type Database } from '../../../code/backend/src/database/connection';
import { migrateDatabase } from '../../../code/backend/src/database/migrate';
import { withIdempotency } from '../../../code/backend/src/foundation/idempotency';
import { createTaskService, enqueueTask } from '../../../code/backend/src/tasks/service';
import { dispatchOutbox } from '../../../code/backend/src/tasks/outbox';
import { runTask, TaskDeliveryError } from '../../../code/backend/src/tasks/runner';
import { startWorker } from '../../../code/backend/src/tasks/worker';
import { buildApp } from '../../../code/backend/src/server/app';

dotenv({ quiet: true });
const testUrl = process.env.TEST_DATABASE_URL;
if (!testUrl || !/^interviewlab_test[a-z0-9_]*$/.test(new URL(testUrl).pathname.slice(1)))
  throw new Error(
    'test:db requires TEST_DATABASE_URL with a dedicated interviewlab_test* database; no tests were skipped',
  );
const config = loadConfig({
  NODE_ENV: 'test',
  DATABASE_URL: testUrl,
  LOG_LEVEL: 'silent',
  WORKER_POLL_MS: 100,
  WORKER_HEARTBEAT_MS: 200,
  WORKER_STALE_MS: 1000,
});
let database: Database;
before(async () => {
  database = createDatabase(config);
  await migrateDatabase(database);
});
after(async () => {
  if (database) await database.close();
});
async function reset() {
  await database.pool.query(
    'TRUNCATE outbox_events, tasks, idempotency_records, audit_events, worker_heartbeats CASCADE',
  );
}
const taskInput = (key: string, type = 'test.echo') => ({
  owner_id: 'student-a',
  type,
  key,
  input: { value: key },
});
async function until(check: () => Promise<boolean>, timeout = 12000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await check()) return;
    await delay(100);
  }
  assert.fail('Condition did not become true before deadline');
}

test('empty database migrations are repeatable and transactions roll back all task/outbox writes', async () => {
  await reset();
  await migrateDatabase(database);
  const tables = await database.pool.query(
    "SELECT tablename FROM pg_tables WHERE schemaname='public'",
  );
  for (const name of [
    'tasks',
    'outbox_events',
    'idempotency_records',
    'audit_events',
    'worker_heartbeats',
  ])
    assert.ok(tables.rows.some((row) => row.tablename === name));
  await assert.rejects(
    database.transaction(async (tx) => {
      await enqueueTask(tx, taskInput('rolled-back'));
      throw new Error('rollback');
    }),
    /rollback/,
  );
  assert.equal((await database.pool.query('SELECT count(*) FROM tasks')).rows[0].count, '0');
  assert.equal(
    (await database.pool.query('SELECT count(*) FROM outbox_events')).rows[0].count,
    '0',
  );
});

test('concurrent idempotency has one committed response; different input conflicts and failed work is retryable', async () => {
  await reset();
  let calls = 0;
  const scope = {
    owner_id: 'student-a',
    operation: 'example.create',
    key: 'create-1',
    input: { x: 1 },
  };
  const work = async () => {
    calls++;
    await delay(30);
    return { id: randomUUID() };
  };
  const results = await Promise.all([
    withIdempotency(database, scope, work),
    withIdempotency(database, scope, work),
  ]);
  assert.equal(calls, 1);
  assert.deepEqual(results[0], results[1]);
  await assert.rejects(withIdempotency(database, { ...scope, input: { x: 2 } }, work), {
    code: 'version_conflict',
  });
  await assert.rejects(
    withIdempotency(database, { ...scope, key: 'failed' }, async () => {
      throw new Error('rollback');
    }),
  );
  assert.deepEqual(
    await withIdempotency(database, { ...scope, key: 'failed' }, async () => ({ recovered: true })),
    { recovered: true },
  );
});

test('task enqueue is atomic and idempotent, task reads isolate users and do not expose payloads', async () => {
  await reset();
  const service = createTaskService(database);
  const tasks = await Promise.all([
    service.enqueue(taskInput('same')),
    service.enqueue(taskInput('same')),
  ]);
  assert.equal(tasks[0].id, tasks[1].id);
  assert.equal(
    (await database.pool.query('SELECT count(*) FROM outbox_events')).rows[0].count,
    '1',
  );
  await assert.rejects(service.enqueue({ ...taskInput('same'), input: { different: true } }), {
    code: 'version_conflict',
  });
  await assert.rejects(service.get({ owner_id: 'student-b', roles: ['student'] }, tasks[0].id), {
    code: 'not_found',
  });
  const app = await buildApp({
    config,
    database,
    logger: false,
    identity: {
      authenticate: async () => ({ owner_id: 'student-a', roles: ['student'] }),
    },
  });
  try {
    const response = await app.inject('/api/v1/tasks/' + tasks[0].id);
    assert.equal(response.statusCode, 200);
    assert.equal(response.json().payload, undefined);
    assert.equal(response.json().owner_id, undefined);
    assert.equal(response.json().execution_token, undefined);
  } finally {
    await app.close();
  }
});

test('outbox survives queue failure and concurrent dispatch without losing committed tasks', async () => {
  await reset();
  const task = await createTaskService(database).enqueue(taskInput('outbox'));
  assert.equal(
    await dispatchOutbox(database, {
      send: async () => {
        throw new Error('queue down');
      },
    }),
    0,
  );
  assert.equal(
    (await database.pool.query('SELECT status FROM tasks WHERE id=$1', [task.id])).rows[0].status,
    'queued',
  );
  await database.pool.query("UPDATE outbox_events SET next_attempt_at=now()-interval '1 second'");
  const sent: string[] = [];
  const publisher = {
    send: async (_name: string, data: { task_id: string }) => {
      sent.push(data.task_id);
      await delay(20);
      return randomUUID();
    },
  };
  await Promise.all([dispatchOutbox(database, publisher), dispatchOutbox(database, publisher)]);
  assert.deepEqual(sent, [task.id]);
});

test('runner fences duplicate execution and atomically publishes result and domain writes', async () => {
  await reset();
  const task = await createTaskService(database).enqueue(taskInput('runner'));
  let calls = 0;
  const handlers = {
    'test.echo': async () => {
      calls++;
      await delay(80);
      return {
        result_ref: { id: 'result', version: 1 },
        commit: async (tx: Parameters<Parameters<Database['transaction']>[0]>[0]) => {
          await tx.client.query(
            'INSERT INTO audit_events (id,owner_id,action,resource_id,request_id,outcome) VALUES ($1,$2,$3,$4,$5,$6)',
            [randomUUID(), 'student-a', 'test.publish', task.id, randomUUID(), 'succeeded'],
          );
        },
      };
    },
  };
  await Promise.allSettled([
    runTask(database, task.id, handlers),
    runTask(database, task.id, handlers),
  ]);
  await runTask(database, task.id, handlers);
  assert.equal(calls, 1);
  assert.equal((await database.pool.query('SELECT count(*) FROM audit_events')).rows[0].count, '1');
  assert.equal(
    (await database.pool.query('SELECT status FROM tasks WHERE id=$1', [task.id])).rows[0].status,
    'succeeded',
  );
});

test('bounded retries, expired claims, unknown handlers and late results are explicit', async () => {
  await reset();
  const service = createTaskService(database);
  const unknown = await service.enqueue(taskInput('unknown', 'future.module'));
  await runTask(database, unknown.id, {});
  assert.equal(
    (await service.get({ owner_id: 'student-a', roles: [] }, unknown.id)).error_code,
    'unsupported_task_type',
  );
  const inherited = await service.enqueue(taskInput('inherited', 'constructor'));
  await runTask(database, inherited.id, {});
  assert.equal(
    (await service.get({ owner_id: 'student-a', roles: [] }, inherited.id)).error_code,
    'unsupported_task_type',
  );
  const failed = await service.enqueue(taskInput('fails'));
  const failures = {
    'test.echo': async () => {
      throw new Error('private provider failure');
    },
  };
  await assert.rejects(runTask(database, failed.id, failures), TaskDeliveryError);
  await runTask(database, failed.id, failures);
  await runTask(database, failed.id, failures);
  const view = await service.get({ owner_id: 'student-a', roles: [] }, failed.id);
  assert.equal(view.attempts, 2);
  assert.equal(view.status, 'failed');
  assert.equal(view.error_code, 'task_failed');
  const expired = await service.enqueue(taskInput('crashed'));
  await database.pool.query(
    "UPDATE tasks SET status='running',attempts=1,execution_token=$2,lease_until=now()-interval '1 second' WHERE id=$1",
    [expired.id, randomUUID()],
  );
  await runTask(database, expired.id, { 'test.echo': async () => ({ result_ref: null }) });
  assert.equal((await service.get({ owner_id: 'student-a', roles: [] }, expired.id)).attempts, 2);
  const late = await service.enqueue(taskInput('late'));
  let lateCommit = false;
  await assert.rejects(
    runTask(
      database,
      late.id,
      {
        'test.echo': async () => {
          await delay(100);
          return {
            result_ref: null,
            commit: async () => {
              lateCommit = true;
            },
          };
        },
      },
      20,
    ),
    TaskDeliveryError,
  );
  await delay(130);
  assert.equal(lateCommit, false);
});

test('real pg-boss worker delivers tasks and readiness follows stop/restart and database loss', async () => {
  await reset();
  const service = createTaskService(database);
  const app = await buildApp({ config, database, logger: false });
  let worker: Awaited<ReturnType<typeof startWorker>> | undefined;
  let restarted: typeof worker;
  const handler = { 'test.echo': async () => ({ result_ref: { id: 'real-result', version: 1 } }) };
  try {
    assert.equal((await app.inject('/api/v1/health/ready')).statusCode, 503);
    worker = await startWorker(config, { database, handlers: handler });
    assert.equal((await app.inject('/api/v1/health/ready')).statusCode, 200);
    const task = await service.enqueue(taskInput('real-queue'));
    await until(
      async () =>
        (await service.get({ owner_id: 'student-a', roles: [] }, task.id)).status === 'succeeded',
    );
    await worker.close();
    worker = undefined;
    assert.equal((await app.inject('/api/v1/health/ready')).statusCode, 503);
    const queued = await service.enqueue(taskInput('after-restart'));
    restarted = await startWorker(config, { database, handlers: handler });
    await until(
      async () =>
        (await service.get({ owner_id: 'student-a', roles: [] }, queued.id)).status === 'succeeded',
    );
  } finally {
    await worker?.close();
    await restarted?.close();
    await app.close();
  }
  const disconnected = createDatabase(config);
  await disconnected.close();
  assert.deepEqual(await disconnected.ready(1000), { database: false, worker: false });
});
