import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import { existsSync } from 'node:fs';
import { randomBytes, randomUUID } from 'node:crypto';
import { config as dotenv } from 'dotenv';
dotenv({ quiet: true });
test('built API authenticates invited users using the configured persistent database', async () => {
  const testUrl = process.env.TEST_DATABASE_URL;
  assert.ok(
    testUrl && /^interviewlab_test[a-z0-9_]*$/.test(new URL(testUrl).pathname.slice(1)),
    'A dedicated test database is required',
  );
  const { loadConfig } = await import('../../../code/backend/src/foundation/config');
  const { createDatabase } = await import('../../../code/backend/src/database/connection');
  const { createInvitedUser } = await import(
    '../../../code/backend/src/modules/accounts/provision'
  );
  const database = createDatabase(loadConfig({ DATABASE_URL: testUrl }));
  const email = `${randomUUID()}@example.test`;
  const password = randomBytes(24).toString('base64url');
  const port = await freePort();
  const origin = `http://127.0.0.1:${port}`;
  const user = await createInvitedUser(database, {
    email,
    password,
    name: 'Synthetic built API student',
  });
  const api = spawn(process.execPath, ['code/backend/dist/api.js'], {
    env: {
      ...process.env,
      NODE_ENV: 'test',
      DATABASE_URL: testUrl,
      AUTH_ENABLED: 'true',
      BETTER_AUTH_SECRET: randomBytes(32).toString('base64url'),
      PUBLIC_ORIGIN: origin,
      API_PORT: String(port),
      LOG_LEVEL: 'silent',
    },
    stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
  });
  api.stdout?.on('data', () => {});
  api.stderr?.on('data', () => {});
  try {
    await eventually(async () => (await fetch(origin + '/api/v1/health')).ok);
    const response = await fetch(origin + '/api/v1/auth/sign-in/email', {
      method: 'POST',
      headers: { origin, 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { success: true });
    const cookie = response.headers
      .getSetCookie()
      .map((value) => value.split(';')[0])
      .join('; ');
    const session = await fetch(origin + '/api/v1/auth/session', { headers: { cookie } });
    assert.equal((await session.json()).user.id, user.id);
  } finally {
    await gracefulClose(api);
    await database.pool.query('DELETE FROM audit_events WHERE resource_id=$1', [user.id]);
    await database.pool.query('DELETE FROM auth_users WHERE id=$1', [user.id]);
    await database.close();
  }
});
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
      AUTH_ENABLED: 'false',
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
    const items: { id: string }[] = [];
    let cursor: string | null = null;
    for (let page = 0; page < 20; page += 1) {
      const suffix = cursor ? '&cursor=' + encodeURIComponent(cursor) : '';
      const payload = (await (await fetch(base + '/job-templates?limit=50' + suffix)).json()) as {
        items: { id: string }[];
        next_cursor: string | null;
      };
      assert.equal(payload.items.length, 50);
      items.push(...payload.items);
      cursor = payload.next_cursor;
      if (page < 19) assert.ok(cursor);
    }
    assert.equal(cursor, null);
    assert.equal(new Set(items.map((item) => item.id)).size, 1000);
  } catch (error) {
    throw new Error(String(error) + '\n' + output);
  } finally {
    await gracefulClose(child);
  }
});

test('built worker fails explicitly without database configuration', async () => {
  assert.ok(existsSync('code/backend/dist/worker.js'), 'Run npm run build:backend first');
  const child = spawn(process.execPath, ['code/backend/dist/worker.js'], {
    env: { ...process.env, DATABASE_URL: '', AUTH_ENABLED: 'false', NODE_ENV: 'test' },
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
    AUTH_ENABLED: 'false',
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
