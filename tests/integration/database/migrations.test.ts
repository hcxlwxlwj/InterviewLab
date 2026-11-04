import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { config as dotenv } from 'dotenv';
import { readMigrationFiles } from 'drizzle-orm/migrator';
import { loadConfig } from '../../../code/backend/src/foundation/config';
import { createDatabase } from '../../../code/backend/src/database/connection';
import { migrateDatabase } from '../../../code/backend/src/database/migrate';
import { testDatabaseUrl } from '../../support/test-database';

dotenv({ quiet: true });
const url = testDatabaseUrl();
const migrations = readMigrationFiles({
  migrationsFolder: fileURLToPath(new URL('../../../code/backend/drizzle', import.meta.url)),
});

for (const branch of ['fresh', 'agent', 'main'] as const) {
  test(`merged migrations converge from ${branch} and remain repeatable`, async () => {
    const admin = createDatabase(loadConfig({ DATABASE_URL: url, NODE_ENV: 'test' }));
    const name = `interviewlab_test_merge_${randomUUID().replaceAll('-', '')}`;
    const target = new URL(url);
    target.pathname = `/${name}`;
    const database = createDatabase(
      loadConfig({ DATABASE_URL: target.toString(), NODE_ENV: 'test' }),
    );
    try {
      await admin.pool.query(`CREATE DATABASE "${name}"`);
      if (branch !== 'fresh') {
        // Reproduce the exact ledger of either published branch before merging.
        await database.pool.query('CREATE SCHEMA drizzle');
        await database.pool.query(
          'CREATE TABLE drizzle.__drizzle_migrations (id serial PRIMARY KEY, hash text NOT NULL, created_at bigint)',
        );
        const prior = migrations.filter(
          (m) =>
            m.folderMillis <= 1793740000000 ||
            m.folderMillis === (branch === 'agent' ? 1793800000000 : 1793836800000),
        );
        for (const migration of prior) {
          await database.transaction(async (tx) => {
            for (const sql of migration.sql) await tx.client.query(sql);
            await tx.client.query(
              'INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ($1,$2)',
              [migration.hash, migration.folderMillis],
            );
          });
        }
      }
      await migrateDatabase(database);
      await database.pool.query('SELECT preparation FROM interviews LIMIT 0');
      await database.pool.query(
        'SELECT material_version, input_digest FROM resume_analyses LIMIT 0',
      );
      assert.equal(
        (
          await database.pool.query(
            "SELECT count(*) FROM pg_indexes WHERE indexname='resume_analysis_source'",
          )
        ).rows[0].count,
        '1',
      );
      const before = (
        await database.pool.query('SELECT * FROM drizzle.__drizzle_migrations ORDER BY id')
      ).rows;
      await migrateDatabase(database);
      assert.deepEqual(
        (await database.pool.query('SELECT * FROM drizzle.__drizzle_migrations ORDER BY id')).rows,
        before,
      );
    } finally {
      await database.close();
      // The generated database name is always inside the dedicated test namespace.
      assert.match(name, /^interviewlab_test_merge_[a-f0-9]+$/);
      try {
        await admin.pool.query(`DROP DATABASE IF EXISTS "${name}"`);
      } finally {
        await admin.close();
      }
    }
  });
}
