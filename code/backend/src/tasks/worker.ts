import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import type { BackendConfig } from '../foundation/config';
import { createDatabase, type Database } from '../database/connection';
import { createQueue, TASK_QUEUE } from './queue';
import { dispatchOutbox } from './outbox';
import { runTask, type TaskHandlers } from './runner';

export interface WorkerOptions {
  database?: Database;
  handlers?: TaskHandlers;
  onError?: (code: string) => void;
}
export async function startWorker(config: BackendConfig, options: WorkerOptions = {}) {
  const database = options.database ?? createDatabase(config);
  const boss = createQueue(config);
  const handlers = options.handlers ?? {};
  const id = randomUUID();
  const controller = new AbortController();
  const reportError = options.onError ?? (() => {});
  const heartbeat = async () => {
    await database.pool.query(
      'INSERT INTO worker_heartbeats (id,supported_types) VALUES ($1,$2::jsonb) ON CONFLICT (id) DO UPDATE SET last_seen_at=now(),supported_types=EXCLUDED.supported_types',
      [id, JSON.stringify(Object.keys(handlers))],
    );
    await database.pool.query(
      "DELETE FROM worker_heartbeats WHERE last_seen_at < now()-interval '1 day'",
    );
  };
  boss.on('error', () => reportError('queue_error'));
  let outboxLoop: Promise<void> | undefined;
  let heartbeatLoop: Promise<void> | undefined;
  try {
    await database.pool.query('SELECT id FROM tasks LIMIT 0');
    await boss.start();
    await boss.createQueue(TASK_QUEUE);
    await boss.work<{ task_id: string }>(
      TASK_QUEUE,
      { batchSize: 1, pollingIntervalSeconds: 0.5 },
      async (jobs) => {
        for (const job of jobs) await runTask(database, job.data.task_id, handlers);
      },
    );
    await heartbeat();
    const loop = async (interval: number, work: () => Promise<unknown>, code: string) => {
      while (!controller.signal.aborted) {
        try {
          await work();
        } catch {
          reportError(code);
        }
        await delay(interval, undefined, { signal: controller.signal }).catch(() => {});
      }
    };
    outboxLoop = loop(config.WORKER_POLL_MS, () => dispatchOutbox(database, boss), 'outbox_error');
    heartbeatLoop = loop(config.WORKER_HEARTBEAT_MS, heartbeat, 'heartbeat_error');
  } catch (error) {
    controller.abort();
    await boss.stop().catch(() => {});
    await database.pool.query('DELETE FROM worker_heartbeats WHERE id=$1', [id]).catch(() => {});
    if (!options.database) await database.close();
    throw error;
  }
  let closing: Promise<void> | undefined;
  return {
    id,
    close() {
      closing ??= (async () => {
        controller.abort();
        await Promise.all([outboxLoop, heartbeatLoop]);
        try {
          await boss.stop({ graceful: true, timeout: 65000 });
        } finally {
          try {
            await database.pool.query('DELETE FROM worker_heartbeats WHERE id=$1', [id]);
          } finally {
            if (!options.database) await database.close();
          }
        }
      })();
      return closing;
    },
  };
}
