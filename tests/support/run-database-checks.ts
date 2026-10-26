import { dirname, join } from 'node:path';
import { config as dotenv } from 'dotenv';
import { Pool } from 'pg';
import { spawn } from 'node:child_process';
async function main() {
  dotenv({ quiet: true });
  const source = process.env.INTERVIEW_DEV_DATABASE_URL;
  if (!source) throw new Error('Local development PostgreSQL is required');
  const url = new URL(source);
  url.pathname = '/interviewlab_test_validation';
  const adminUrl = new URL(source);
  adminUrl.pathname = '/postgres';
  const admin = new Pool({ connectionString: adminUrl.toString() });
  try {
    if (
      !(await admin.query("SELECT 1 FROM pg_database WHERE datname='interviewlab_test_validation'"))
        .rowCount
    )
      await admin.query('CREATE DATABASE interviewlab_test_validation');
  } finally {
    await admin.end();
  }
  const env = { ...process.env, TEST_DATABASE_URL: url.toString() };
  const script = process.argv[2] ?? 'test:db';
  if (!['test:db', 'test:process', 'test:web'].includes(script))
    throw new Error('Unsupported check');
  const child = spawn(
    process.execPath,
    [
      process.env.npm_execpath ??
        join(dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js'),
      'run',
      script,
    ],
    { env, stdio: 'inherit', windowsHide: true },
  );
  child.on('exit', (code) => {
    process.exitCode = code ?? 1;
  });
}
main().catch(() => {
  console.error('Dedicated database check setup failed');
  process.exitCode = 1;
});
