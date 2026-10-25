import { fileURLToPath } from 'node:url';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import type { Database } from './connection';
/** Explicit command/test entry only; API startup never runs schema migrations. */
export async function migrateDatabase(
  database: Database,
  migrationsFolder = fileURLToPath(new URL('../../drizzle', import.meta.url)),
) {
  // Serialize migration commands across processes.
  const client = await database.pool.connect();
  try {
    await client.query("SELECT pg_advisory_lock(hashtext('interviewlab:migrations'))");
    // Use the locked connection for the actual migration, not another pool connection.
    const { drizzle } = await import('drizzle-orm/node-postgres');
    await migrate(drizzle(client), { migrationsFolder });
  } finally {
    await client
      .query("SELECT pg_advisory_unlock(hashtext('interviewlab:migrations'))")
      .catch(() => {});
    client.release();
  }
}
