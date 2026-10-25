import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import { existsSync } from 'node:fs';
import { config as dotenv } from 'dotenv';
dotenv({ quiet: true });
async function freePort() {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const port = address.port;
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  return port;
}
async function gracefulClose(child: ChildProcess) {
  if (child.exitCode !== null) return;
  const exit = once(child, 'exit');
  if (child.connected) child.send('shutdown');
  else child.kill();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const [code] = await Promise.race([
      exit,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          child.kill();
          reject(new Error('Process did not gracefully exit'));
        }, 10000);
      }),
    ]);
    assert.equal(code, 0);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
async function eventually(check: () => Promise<boolean>) {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (await check().catch(() => false)) return;
    await delay(100);
  }
  assert.fail('Process did not become available');
}

test('built API starts without database, serves public data and releases resources on graceful shutdown', async () => {
  assert.ok(existsSync('code/backend/dist/api.js'), 'Run npm run build:backend first');
  const port = await freePort();
  const child = spawn(process.execPath, ['code/backend/dist/api.js'], {
    env: {
      ...process.env,
      DATABASE_URL: '',
      NODE_ENV: 'test',
      LOG_LEVEL: 'silent',
      API_PORT: String(port),
    },
    stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
  });
  let output = '';
  child.stdout?.on('data', (chunk) => {
    output += chunk;
  });
  child.stderr?.on('data', (chunk) => {
    output += chunk;
  });
  try {
    const base = 'http://127.0.0.1:' + port + '/api/v1';
    await eventually(async () => (await fetch(base + '/health')).status === 200);
    assert.equal((await fetch(base + '/health/ready')).status, 503);
    assert.equal((await (await fetch(base + '/job-templates?limit=50')).json()).items.length, 36);
  } catch (error) {
    throw new Error(String(error) + '\n' + output);
  } finally {
    await gracefulClose(child);
  }
});

test('built worker fails explicitly without database configuration', async () => {
  assert.ok(existsSync('code/backend/dist/worker.js'), 'Run npm run build:backend first');
  const child = spawn(process.execPath, ['code/backend/dist/worker.js'], {
    env: { ...process.env, DATABASE_URL: '', NODE_ENV: 'test' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stderr?.on('data', (chunk) => {
    output += chunk;
  });
  const [code] = await once(child, 'exit');
  assert.equal(code, 1);
  assert.match(output, /worker_start_failed/);
});

test('built API readiness tracks a real worker process, which can gracefully stop and restart', async () => {
  const url = process.env.TEST_DATABASE_URL;
  assert.ok(url, 'test:process requires TEST_DATABASE_URL for real process verification');
  assert.match(new URL(url).pathname.slice(1), /^interviewlab_test[a-z0-9_]*$/);
  const port = await freePort();
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    DATABASE_URL: url,
    NODE_ENV: 'test',
    LOG_LEVEL: 'silent',
    API_PORT: String(port),
    WORKER_HEARTBEAT_MS: '200',
    WORKER_STALE_MS: '1000',
    WORKER_POLL_MS: '100',
  };
  const children: ChildProcess[] = [];
  const launch = (entry: string) => {
    const child = spawn(process.execPath, ['code/backend/dist/' + entry + '.js'], {
      env,
      stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
    });
    child.stdout?.on('data', () => {});
    child.stderr?.on('data', () => {});
    children.push(child);
    return child;
  };
  const api = launch('api');
  const base = 'http://127.0.0.1:' + port + '/api/v1';
  try {
    await eventually(async () => (await fetch(base + '/health')).status === 200);
    const worker = launch('worker');
    await eventually(async () => (await fetch(base + '/health/ready')).status === 200);
    await gracefulClose(worker);
    await eventually(async () => (await fetch(base + '/health/ready')).status === 503);
    launch('worker');
    await eventually(async () => (await fetch(base + '/health/ready')).status === 200);
    assert.equal(api.exitCode, null);
  } finally {
    for (const child of children.reverse()) await gracefulClose(child);
  }
});
