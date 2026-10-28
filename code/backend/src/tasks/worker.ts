import { Client } from 'pg';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import type { BackendConfig } from '../foundation/config';
import { createDatabase, type Database } from '../database/connection';
import { createQueue, TASK_QUEUE } from './queue';
import { dispatchOutbox } from './outbox';
import { runTask, type TaskHandlers } from './runner';
import type { TaskRow } from './service';

export interface WorkerOptions {
  database?: Database;
  handlers?: TaskHandlers;
  onError?: (code: string) => void;
  maintain?: () => Promise<void>;
  isCancelled?: (task: Readonly<TaskRow>) => Promise<boolean>;
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
  let wakeClient: Client | undefined;
  let wakePending: Promise<unknown> | undefined;
  const wake = () => {
    wakePending ??= dispatchOutbox(database, boss)
      .catch(() => reportError('outbox_error'))
      .finally(() => {
        wakePending = undefined;
      });
  };
  let outboxLoop: Promise<void> | undefined;
  let heartbeatLoop: Promise<void> | undefined;
  let maintenanceLoop: Promise<void> | undefined;
  try {
    await database.pool.query('SELECT id FROM tasks LIMIT 0');
    await boss.start();
    await boss.createQueue(TASK_QUEUE);
    await boss.work<{ task_id: string }>(
      TASK_QUEUE,
      { batchSize: 1, pollingIntervalSeconds: 0.5, localConcurrency: 3 },
      async (jobs) => {
        for (const job of jobs)
          await runTask(database, job.data.task_id, handlers, 60000, options.isCancelled);
      },
    );
    wakeClient = new Client(database.pool.options);
    await wakeClient.connect();
    wakeClient.on('notification', wake);
    wakeClient.on('error', () => reportError('outbox_listener_error'));
    await wakeClient.query('LISTEN interview_outbox');
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
    if (options.maintain) maintenanceLoop = loop(1000, options.maintain, 'maintenance_error');
  } catch (error) {
    controller.abort();
    await wakeClient?.end().catch(() => {});
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
        if (wakeClient) {
          await wakeClient.query('UNLISTEN interview_outbox').catch(() => {});
          await wakeClient.end();
          wakeClient = undefined;
        }
        await wakePending;
        await Promise.all([outboxLoop, heartbeatLoop, maintenanceLoop]);
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
