import { PgBoss } from 'pg-boss';
import type { BackendConfig } from '../foundation/config';
/** One durable queue; the application registry chooses the versioned task handler. */
export const TASK_QUEUE = 'interviewlab-tasks-v1';
export function createQueue(config: BackendConfig) {
  if (!config.DATABASE_URL) throw new Error('DATABASE_URL is required for the worker');
  return new PgBoss({
    connectionString: config.DATABASE_URL,
    application_name: 'interviewlab-worker',
    connectionTimeoutMillis: config.DATABASE_CONNECT_TIMEOUT_MS,
    max: config.DATABASE_POOL_SIZE,
  });
}
