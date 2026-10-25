import { randomUUID } from 'node:crypto';
import type { RequestIdentity, TaskView } from '@interviewlab/core';
import type { Database, Transaction } from '../database/connection';
import { ServiceError } from '../foundation/errors';
import { assertIdempotencyKey, inputDigest } from '../foundation/idempotency';

export interface TaskInput {
  owner_id: string;
  type: string;
  key: string;
  input: unknown;
  max_attempts?: number;
}
export interface TaskRow extends Omit<TaskView, 'created_at' | 'updated_at'> {
  key: string;
  owner_id: string;
  payload: unknown;
  execution_token: string | null;
  lease_until: Date | null;
  lease_active?: boolean;
  created_at: Date;
  updated_at: Date;
}
export async function enqueueTask(tx: Transaction, input: TaskInput): Promise<TaskView> {
  assertIdempotencyKey(input.key);
  if (
    !/^[a-z][a-z0-9_.-]{0,99}$/.test(input.type) ||
    !input.owner_id ||
    !Number.isInteger(input.max_attempts ?? 2) ||
    (input.max_attempts ?? 2) < 1 ||
    (input.max_attempts ?? 2) > 5
  )
    throw new ServiceError('unsupported_input', 400, 'Invalid task configuration');
  const digest = inputDigest(input.input);
  const id = randomUUID();
  await tx.client.query(
    'INSERT INTO tasks (id,owner_id,type,key,input_digest,payload,max_attempts) VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7) ON CONFLICT (owner_id,type,key) DO NOTHING',
    [
      id,
      input.owner_id,
      input.type,
      input.key,
      digest,
      JSON.stringify(input.input),
      input.max_attempts ?? 2,
    ],
  );
  const result = await tx.client.query<TaskRow>(
    'SELECT * FROM tasks WHERE owner_id=$1 AND type=$2 AND key=$3',
    [input.owner_id, input.type, input.key],
  );
  const row = result.rows[0];
  if (row.input_digest !== digest)
    throw new ServiceError('version_conflict', 409, 'Task key has different input');
  await tx.client.query(
    'INSERT INTO outbox_events (id,task_id) VALUES ($1,$2) ON CONFLICT (task_id) DO NOTHING',
    [randomUUID(), row.id],
  );
  return taskView(row);
}
export function taskView(row: TaskRow): TaskView {
  return {
    id: row.id,
    type: row.type,
    status: row.status,
    input_digest: row.input_digest,
    attempts: row.attempts,
    max_attempts: row.max_attempts,
    result_ref: row.result_ref,
    error_code: row.error_code,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  };
}
export function createTaskService(database: Database) {
  return {
    async get(identity: RequestIdentity, id: string): Promise<TaskView> {
      const result = await database.pool.query<TaskRow>(
        'SELECT * FROM tasks WHERE id=$1 AND owner_id=$2',
        [id, identity.owner_id],
      );
      if (!result.rowCount) throw new ServiceError('not_found', 404, 'Task not found');
      return taskView(result.rows[0]);
    },
    enqueue: (input: TaskInput) => database.transaction((tx) => enqueueTask(tx, input)),
  };
}
