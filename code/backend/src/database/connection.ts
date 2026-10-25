import { Pool, type PoolClient } from 'pg';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { BackendConfig } from '../foundation/config';
import * as schema from './schema';
export interface Transaction {
  client: PoolClient;
  db: NodePgDatabase<typeof schema>;
}
export function createDatabase(config: BackendConfig) {
  if (!config.DATABASE_URL) throw new Error('DATABASE_URL is required');
  const pool = new Pool({
    connectionString: config.DATABASE_URL,
    max: config.DATABASE_POOL_SIZE,
    connectionTimeoutMillis: config.DATABASE_CONNECT_TIMEOUT_MS,
    idleTimeoutMillis: 10000,
    statement_timeout: 10000,
  });
  // Idle clients can fail independently; prevent an unhandled EventEmitter error.
  pool.on('error', () => {
    /* Readiness probes and subsequent operations report failure. */
  });
  const db = drizzle(pool, { schema });
  return {
    pool,
    db,
    async transaction<T>(work: (tx: Transaction) => Promise<T>): Promise<T> {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await work({ client, db: drizzle(client, { schema }) });
        await client.query('COMMIT');
        return result;
      } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        throw error;
      } finally {
        client.release();
      }
    },
    async ready(workerStaleMs: number) {
      try {
        // Missing migrations are not considered ready.
        await pool.query('SELECT id FROM tasks LIMIT 0');
        const result = await pool.query(
          "SELECT EXISTS (SELECT 1 FROM worker_heartbeats WHERE last_seen_at > now() - $1 * interval '1 millisecond') AS worker",
          [workerStaleMs],
        );
        return { database: true, worker: Boolean(result.rows[0].worker) };
      } catch {
        return { database: false, worker: false };
      }
    },
    close: () => pool.end(),
  };
}
export type Database = ReturnType<typeof createDatabase>;
