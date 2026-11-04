import { dirname, join } from 'node:path';
import { config as dotenv } from 'dotenv';
import { spawn } from 'node:child_process';
import { testDatabaseUrl } from './test-database';
async function main() {
  dotenv({ quiet: true });
  const env = { ...process.env, TEST_DATABASE_URL: testDatabaseUrl() };
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
