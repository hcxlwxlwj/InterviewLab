import { randomUUID } from 'node:crypto';
import type { VersionRef } from '@interviewlab/core';
import type { Database, Transaction } from '../database/connection';
import { ServiceError } from '../foundation/errors';
import { versionRefSchema } from '../foundation/schemas';
import type { TaskRow } from './service';
export interface TaskOutcome {
  result_ref: VersionRef | null;
  /** Acquire module locks before the task lock, matching command lock order. False discards stale output. */
  lock?: (tx: Transaction) => Promise<boolean | void>;
  /** Database-only publication. Runs atomically with succeeded, after checking the active claim. */
  commit?: (tx: Transaction) => Promise<boolean | void>;
}
export type TaskHandler = (task: Readonly<TaskRow>, signal: AbortSignal) => Promise<TaskOutcome>;
export type TaskHandlers = Readonly<Record<string, TaskHandler>>;
export class TaskDeliveryError extends Error {}

export async function runTask(
  database: Database,
  id: string,
  handlers: TaskHandlers,
  leaseMs = 60000,
  isCancelled?: (task: Readonly<TaskRow>) => Promise<boolean>,
) {
  const token = randomUUID();
  const claimed = await database.transaction(async (tx) => {
    const result = await tx.client.query<TaskRow>(
      'SELECT *, lease_until > clock_timestamp() AS lease_active FROM tasks WHERE id=$1 FOR UPDATE',
      [id],
    );
    const task = result.rows[0];
    if (!task || task.status === 'succeeded' || task.status === 'cancelled') return null;
    if (task.status === 'running' && task.lease_active)
      throw new TaskDeliveryError('Task is already running');
    if (!Object.hasOwn(handlers, task.type) || typeof handlers[task.type] !== 'function') {
      await tx.client.query(
        "UPDATE tasks SET status='failed',error_code='unsupported_task_type',updated_at=now() WHERE id=$1",
        [id],
      );
      return null;
    }
    if (task.attempts >= task.max_attempts) {
      await tx.client.query(
        "UPDATE tasks SET status='failed',error_code=COALESCE(error_code,'attempts_exhausted'),updated_at=now(),execution_token=NULL,lease_until=NULL WHERE id=$1",
        [id],
      );
      return null;
    }
    const update = await tx.client.query<TaskRow>(
      "UPDATE tasks SET status='running',attempts=attempts+1,execution_token=$2,lease_until=now()+$3*interval '1 millisecond',error_code=NULL,updated_at=now() WHERE id=$1 RETURNING *",
      [id, token, leaseMs],
    );
    return update.rows[0];
  });
  if (!claimed) return;
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let cancellationTimer: ReturnType<typeof setInterval> | undefined;
  let checking = false;
  try {
    const outcome = await Promise.race([
      handlers[claimed.type](claimed, controller.signal),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new TaskDeliveryError('Task timed out'));
        }, leaseMs);
      }),
      new Promise<never>((_, reject) => {
        cancellationTimer = setInterval(() => {
          if (checking) return;
          checking = true;
          void (async () => {
            const result = await database.pool.query(
              'SELECT status,execution_token FROM tasks WHERE id=$1',
              [id],
            );
            const row = result.rows[0];
            if (
              !row ||
              row.status !== 'running' ||
              row.execution_token !== token ||
              (await isCancelled?.(claimed))
            ) {
              controller.abort();
              reject(new ServiceError('task_cancelled', 409, 'Task cancelled'));
            }
          })()
            .catch(() => {
              controller.abort();
              reject(new TaskDeliveryError('Cancellation check failed'));
            })
            .finally(() => {
              checking = false;
            });
        }, 500);
      }),
    ]);
    if (outcome.result_ref !== null) versionRefSchema.parse(outcome.result_ref);
    await database.transaction(async (tx) => {
      const validSource = await outcome.lock?.(tx);
      const current = await tx.client.query<TaskRow>(
        'SELECT *, lease_until > clock_timestamp() AS lease_active FROM tasks WHERE id=$1 FOR UPDATE',
        [id],
      );
      const row = current.rows[0];
      if (!row || row.status !== 'running' || row.execution_token !== token || !row.lease_active)
        throw new TaskDeliveryError('Task claim expired');
      const published = validSource === false ? false : await outcome.commit?.(tx);
      await tx.client.query(
        'UPDATE tasks SET status=$3,result_ref=$2::jsonb,execution_token=NULL,lease_until=NULL,error_code=NULL,updated_at=now() WHERE id=$1',
        [
          id,
          published === false ? null : JSON.stringify(outcome.result_ref),
          published === false ? 'cancelled' : 'succeeded',
        ],
      );
    });
  } catch (error) {
    const code =
      error instanceof ServiceError
        ? error.code
        : error instanceof TaskDeliveryError
          ? 'task_timeout'
          : 'task_failed';
    const result = await database.pool.query(
      "UPDATE tasks SET status=CASE WHEN $3='task_cancelled' THEN 'cancelled' ELSE 'failed' END,error_code=$3,execution_token=NULL,lease_until=NULL,updated_at=now() WHERE id=$1 AND execution_token=$2 AND status='running' RETURNING attempts,max_attempts",
      [id, token, code],
    );
    const row = result.rows[0];
    if (row && code !== 'task_cancelled' && row.attempts < row.max_attempts)
      throw new TaskDeliveryError('Task failed; retry pending');
  } finally {
    controller.abort();
    if (timer) clearTimeout(timer);
    if (cancellationTimer) clearInterval(cancellationTimer);
  }
}
