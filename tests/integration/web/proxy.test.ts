import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID, randomBytes } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { config as dotenv } from 'dotenv';
import type { AuthSession, PageResult, JobTemplate } from '@interviewlab/core';
import { loadConfig } from '../../../code/backend/src/foundation/config';
import { createDatabase } from '../../../code/backend/src/database/connection';
import { migrateDatabase } from '../../../code/backend/src/database/migrate';
import { createInvitedUser } from '../../../code/backend/src/modules/accounts/provision';
import { buildApp } from '../../../code/backend/src/server/app';
import { createApiClient, ApiClientError } from '../../../code/frontend/lib/api/http';

dotenv({ quiet: true });
async function freePort() {
  const server = createServer();
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  await new Promise<void>((done, reject) =>
    server.close((error) => (error ? reject(error) : done())),
  );
  return address.port;
}

test(
  'built Next proxy preserves real API errors, query strings, cookies and origin policy without demo fallback',
  { timeout: 60000 },
  async () => {
    const testUrl = process.env.TEST_DATABASE_URL;
    assert.ok(
      testUrl && /^interviewlab_test[a-z0-9_]*$/.test(new URL(testUrl).pathname.slice(1)),
      'test:web requires a dedicated interviewlab_test* database',
    );
    const manifest = JSON.parse(readFileSync('code/frontend/.next/routes-manifest.json', 'utf8'));
    const rewrite = manifest.rewrites.beforeFiles.find(
      (item: { source: string }) => item.source === '/api/v1/:path*',
    );
    assert.ok(rewrite, 'Build the frontend before test:web');
    const apiOrigin = new URL(rewrite.destination.replace('/api/v1/:path*', ''));
    assert.equal(apiOrigin.hostname, '127.0.0.1', 'Proxy tests must target a local API');
    assert.equal(apiOrigin.protocol, 'http:');
    const port = await freePort();
    const origin = `http://127.0.0.1:${port}`;
    const config = loadConfig({
      NODE_ENV: 'test',
      DATABASE_URL: testUrl,
      PUBLIC_ORIGIN: origin,
      AUTH_ENABLED: 'true',
      BETTER_AUTH_SECRET: randomBytes(32).toString('base64url'),
      LOG_LEVEL: 'silent',
    });
    const database = createDatabase(config);
    let api: Awaited<ReturnType<typeof buildApp>> | undefined;
    let next: ReturnType<typeof spawn> | undefined;
    let userId: string | undefined;
    let output = '';
    try {
      await migrateDatabase(database);
      const email = `${randomUUID()}@example.test`;
      const password = randomBytes(24).toString('base64url');
      userId = (
        await createInvitedUser(database, { email, password, name: 'Synthetic proxy student' })
      ).id;
      api = await buildApp({
        config,
        database,
        logger: false,
        modules: [
          {
            name: 'knowledge',
            async register(app, access) {
              app.get('/test-stream', async (request, reply) => {
                await access.requireIdentity(request);
                reply.hijack();
                reply.raw.writeHead(200, {
                  'Content-Type': 'text/event-stream',
                  'Cache-Control': 'no-store, no-transform',
                  'X-Accel-Buffering': 'no',
                });
                reply.raw.write('event: status\ndata: {"state":"pending"}\n\n');
                await delay(1500);
                reply.raw.end('event: committed\ndata: {"complete":true}\n\n');
              });
              app.post('/test-identity', async (request) => ({
                ...(await access.requireIdentity(request)),
                key: request.headers['idempotency-key'],
              }));
            },
          },
        ],
      });
      await api.listen({ host: '127.0.0.1', port: Number(apiOrigin.port) });
      next = spawn(
        process.execPath,
        [
          resolve('node_modules/next/dist/bin/next'),
          'start',
          '--hostname',
          '127.0.0.1',
          '--port',
          String(port),
        ],
        {
          cwd: resolve('code/frontend'),
          env: { ...process.env, NODE_ENV: 'production', NEXT_TELEMETRY_DISABLED: '1' },
          stdio: ['ignore', 'pipe', 'pipe'],
        },
      );
      next.stdout?.on('data', (chunk) => {
        output += chunk;
      });
      next.stderr?.on('data', (chunk) => {
        output += chunk;
      });
      let ready = false;
      for (let attempt = 0; attempt < 100; attempt++) {
        if (
          await fetch(origin + '/api/v1/health')
            .then((response) => response.ok)
            .catch(() => false)
        ) {
          ready = true;
          break;
        }
        if (next.exitCode !== null) break;
        await delay(100);
      }
      assert.ok(ready, 'Next did not start: ' + output);
      assert.match(await (await fetch(origin + '/login')).text(), /账号登录/);
      assert.match(await (await fetch(origin + '/')).text(), /面试/);
      const live = await fetch(origin + '/api/v1/health');
      assert.equal(live.headers.get('x-interviewlab-mode'), 'backend-foundation');
      assert.equal(
        (await (await fetch(origin + '/api/demo/v1/health')).json()).mode,
        'interface-skeleton',
      );
      const cookies = new Map<string, string>();
      const observedCookies: string[] = [];
      const request = createApiClient(async (path, init) => {
        const headers = new Headers(init?.headers);
        headers.set('cookie', [...cookies].map(([name, value]) => `${name}=${value}`).join('; '));
        if (init?.method !== 'GET') headers.set('origin', origin);
        const response = await fetch(origin + String(path), { ...init, headers });
        for (const cookie of response.headers.getSetCookie()) {
          observedCookies.push(cookie);
          const [name, ...value] = cookie.split(';')[0].split('=');
          cookies.set(name, value.join('='));
        }
        return response;
      });
      const first = await request<PageResult<JobTemplate>>(
        '/job-templates?limit=1&category=software',
      );
      assert.equal(first.items.length, 1);
      assert.ok(first.next_cursor);
      const second = await request<PageResult<JobTemplate>>(
        `/job-templates?limit=1&category=software&cursor=${encodeURIComponent(first.next_cursor)}`,
      );
      assert.notEqual(first.items[0].id, second.items[0].id);
      await assert.rejects(
        request('/test-identity', { method: 'POST', body: {} }),
        (error) =>
          error instanceof ApiClientError &&
          error.status === 401 &&
          Boolean(error.detail.request_id),
      );
      assert.deepEqual(
        await request('/auth/sign-in/email', { method: 'POST', body: { email, password } }),
        { success: true },
      );
      assert.ok(
        observedCookies.some(
          (cookie) =>
            /HttpOnly/.test(cookie) && /SameSite=Lax/.test(cookie) && !/Domain=/i.test(cookie),
        ),
      );
      const session = await request<AuthSession>('/auth/session');
      assert.equal(session.user.id, userId);
      const streamStarted = performance.now();
      const streamResponse = await fetch(origin + '/api/v1/test-stream', {
        headers: { cookie: [...cookies].map(([name, value]) => `${name}=${value}`).join('; ') },
      });
      assert.match(streamResponse.headers.get('content-type') ?? '', /text\/event-stream/);
      const reader = streamResponse.body!.getReader();
      const firstChunk = await reader.read();
      assert.ok(performance.now() - streamStarted < 1200, 'Proxy buffered the initial SSE event');
      let eventText = new TextDecoder().decode(firstChunk.value);
      assert.match(eventText, /event: status/);
      while (true) {
        const part = await reader.read();
        if (part.done) break;
        eventText += new TextDecoder().decode(part.value);
      }
      assert.match(eventText, /event: committed/);
      const who = await request<{ owner_id: string; key: string }>('/test-identity', {
        method: 'POST',
        body: {},
        idempotencyKey: 'one-operation',
      });
      assert.equal(who.owner_id, userId);
      assert.equal(who.key, 'one-operation');
      const forbidden = await fetch(origin + '/api/v1/auth/sign-out', {
        method: 'POST',
        headers: { origin: 'https://other.test', 'content-type': 'application/json' },
        body: '{}',
      });
      assert.equal(forbidden.status, 403);
      await request('/auth/sign-out', { method: 'POST', body: {} });
      assert.equal(await request('/auth/session'), null);
      await api.close();
      api = undefined;
      await assert.rejects(
        request('/health'),
        (error) => error instanceof ApiClientError && error.status >= 500,
      );
      assert.equal((await fetch(origin + '/api/demo/v1/health')).status, 200);
    } finally {
      if (next && next.exitCode === null) {
        const stopped = once(next, 'exit');
        next.kill();
        await stopped;
      }
      await api?.close();
      if (userId) {
        await database.pool.query('DELETE FROM audit_events WHERE resource_id=$1', [userId]);
        await database.pool.query('DELETE FROM auth_users WHERE id=$1', [userId]);
      }
      await database.close();
    }
  },
);
