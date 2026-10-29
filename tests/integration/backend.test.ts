import test from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../../code/backend/src/server/app';
import { loadConfig } from '../../code/backend/src/foundation/config';
import { requireIdentity, requireSameOrigin } from '../../code/backend/src/foundation/auth';
import { inputDigest } from '../../code/backend/src/foundation/idempotency';

const config = loadConfig({ NODE_ENV: 'development', LOG_LEVEL: 'silent' });
test('real backend starts without a database and separates liveness/readiness/capabilities', async (t) => {
  const app = await buildApp({ config, logger: false });
  t.after(() => app.close());
  const response = await app.inject('/api/v1/health');
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { status: 'ok' });
  assert.equal(response.headers['x-interviewlab-mode'], 'backend-foundation');
  assert.ok(response.headers['x-request-id']);
  const ready = await app.inject('/api/v1/health/ready');
  assert.equal(ready.statusCode, 503);
  assert.deepEqual(ready.json(), { status: 'not_ready', database: false, worker: false });
  assert.deepEqual((await app.inject('/api/v1/capabilities')).json(), {
    database: false,
    worker: false,
    authentication: false,
    llm: false,
    private_storage: false,
  });
});

test('published catalog has stable opaque cursors, filters and embedded sources', async (t) => {
  const app = await buildApp({ config, logger: false });
  t.after(() => app.close());
  const first = (await app.inject('/api/v1/job-templates?limit=30')).json();
  assert.equal(first.items.length, 30);
  assert.ok(first.next_cursor && !/^\d+$/.test(first.next_cursor));
  const pages = [first];
  for (let cursor = first.next_cursor; cursor; ) {
    const page = (
      await app.inject({
        url: '/api/v1/job-templates',
        query: { cursor, limit: '30' },
      })
    ).json();
    pages.push(page);
    cursor = page.next_cursor;
  }
  assert.equal(pages.length, 34);
  assert.deepEqual(
    pages.map((page) => page.items.length),
    [...Array(33).fill(30), 10],
  );
  assert.equal(pages[pages.length - 1].next_cursor, null);
  assert.equal(
    new Set(
      pages.flatMap((page) => page.items.map((item: { id: string }) => item.id)),
    ).size,
    1000,
  );
  const filtered = await app.inject(
    '/api/v1/job-templates?category=product&stage=internship&limit=50',
  );
  assert.equal(filtered.json().items.length, 4);
  const detail = (await app.inject('/api/v1/job-templates/ai-product')).json();
  assert.ok(detail.sources.length > 0);
  assert.ok(
    detail.sources.every((source: { id: string }) => detail.source_refs.includes(source.id)),
  );
  assert.ok((await app.inject('/api/v1/job-categories')).json().items.length > 0);
  assert.equal((await app.inject('/api/v1/job-templates/not-published')).statusCode, 404);
  assert.equal(
    (
      await app.inject({
        url: '/api/v1/job-templates',
        query: { cursor: first.next_cursor, category: 'product' },
      })
    ).statusCode,
    400,
  );
});

test('validation, not-found and private capability errors share a safe error envelope', async (t) => {
  const app = await buildApp({ config, logger: false });
  t.after(() => app.close());
  for (const url of [
    '/api/v1/job-templates?limit=0',
    '/api/v1/job-templates?stage=other',
    '/api/v1/job-templates?cursor=garbage',
  ]) {
    const response = await app.inject(url);
    assert.equal(response.statusCode, 400);
    assert.equal(response.json().code, 'unsupported_input');
    assert.equal(response.json().request_id, response.headers['x-request-id']);
  }
  const missing = await app.inject('/api/v1/resumes');
  assert.equal(missing.statusCode, 404);
  const privateTask = await app.inject('/api/v1/tasks/00000000-0000-4000-8000-000000000001');
  assert.equal(privateTask.statusCode, 501);
  assert.equal(privateTask.json().code, 'capability_unavailable');
  assert.equal(privateTask.json().retryable, false);
  const unauthenticated = await buildApp({
    config,
    logger: false,
    identity: { authenticate: async () => null },
  });
  t.after(() => unauthenticated.close());
  assert.equal(
    (await unauthenticated.inject('/api/v1/tasks/00000000-0000-4000-8000-000000000001')).statusCode,
    401,
  );
});

test('custom modules use injected identity, response validation and centralized error handling', async (t) => {
  const { z } = await import('zod');
  const app = await buildApp({
    config: { ...config, BODY_LIMIT_BYTES: 1024, PUBLIC_ORIGIN: 'http://localhost:3000' },
    logger: false,
    modules: [
      {
        name: 'accounts',
        async register(instance) {
          instance.addHook('onRequest', async (_request, reply) => {
            reply.header('X-Test-Module', 'accounts');
          });
          instance.get('/identity', async (request) =>
            requireIdentity(request, {
              authenticate: async () => ({ owner_id: 'server-owner', roles: ['student'] }),
            }),
          );
          instance.post('/guarded', async (request) => {
            requireSameOrigin(request, 'http://localhost:3000');
            return { ok: true };
          });
          instance.get('/unexpected', async () => {
            throw new Error('secret-connection-string');
          });
          instance.get(
            '/invalid-response',
            { schema: { response: { 200: z.object({ count: z.number() }) } } },
            async () => ({ count: 'not-a-number' }),
          );
        },
      },
    ],
  });
  t.after(() => app.close());
  assert.equal((await app.inject('/api/v1/identity')).headers['x-test-module'], 'accounts');
  assert.equal((await app.inject('/api/v1/job-templates')).headers['x-test-module'], undefined);
  assert.equal(
    (await app.inject({ url: '/api/v1/identity', headers: { 'x-owner-id': 'attacker' } })).json()
      .owner_id,
    'server-owner',
  );
  assert.equal((await app.inject({ method: 'POST', url: '/api/v1/guarded' })).statusCode, 403);
  assert.equal(
    (
      await app.inject({
        method: 'POST',
        url: '/api/v1/guarded',
        headers: { origin: 'http://localhost:3000' },
      })
    ).statusCode,
    200,
  );
  const unexpected = await app.inject('/api/v1/unexpected');
  assert.equal(unexpected.statusCode, 500);
  assert.ok(!unexpected.body.includes('secret'));
  assert.equal((await app.inject('/api/v1/invalid-response')).statusCode, 500);
  const tooLarge = await app.inject({
    method: 'POST',
    url: '/api/v1/guarded',
    headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' },
    payload: JSON.stringify({ text: 'x'.repeat(2000) }),
  });
  assert.equal(tooLarge.statusCode, 413);
});

test('OpenAPI describes registered routes and is hidden outside development', async (t) => {
  const app = await buildApp({ config, logger: false });
  t.after(() => app.close());
  const specification = (await app.inject('/api/v1/openapi.json')).json();
  assert.equal(specification.openapi, '3.0.3');
  assert.ok(specification.paths['/api/v1/job-templates']);
  assert.ok(specification.paths['/api/v1/auth/session']);
  assert.ok(specification.paths['/api/v1/auth/sign-in/email']);
  assert.ok(!specification.paths['/api/v1/auth/sign-up/email']);
  assert.ok(specification.paths['/api/v1/interviews']);
  assert.ok(specification.paths['/api/v1/interviews/{id}/turns/{turn_id}/answer']);
  assert.ok(specification.paths['/api/v1/comparisons']);
  const production = await buildApp({
    config: { ...config, NODE_ENV: 'production' },
    logger: false,
  });
  t.after(() => production.close());
  assert.equal((await production.inject('/api/v1/openapi.json')).statusCode, 404);
  await assert.rejects(
    buildApp({ config, logger: false, modules: [{ name: 'jobs', register: async () => {} }] }),
    /Duplicate module/,
  );
});

test('unconfigured authentication is explicit and every module write shares the origin policy', async (t) => {
  const app = await buildApp({
    config,
    logger: false,
    modules: [
      {
        name: 'accounts',
        async register(instance) {
          instance.post('/write-example', async () => ({ ok: true }));
        },
      },
    ],
  });
  t.after(() => app.close());
  const unavailable = await app.inject('/api/v1/auth/session');
  assert.equal(unavailable.statusCode, 501);
  assert.equal(unavailable.json().code, 'capability_unavailable');
  for (const origin of [undefined, 'https://attacker.test']) {
    assert.equal(
      (
        await app.inject({
          method: 'POST',
          url: '/api/v1/write-example',
          headers: origin ? { origin } : {},
        })
      ).statusCode,
      403,
    );
  }
  assert.equal(
    (
      await app.inject({
        method: 'POST',
        url: '/api/v1/write-example',
        headers: { origin: config.PUBLIC_ORIGIN },
      })
    ).statusCode,
    200,
  );
  assert.throws(() => loadConfig({ AUTH_ENABLED: 'true' }), /authentication requires/);
  assert.throws(() => loadConfig({ PUBLIC_ORIGIN: 'http://example.test/path' }), /PUBLIC_ORIGIN/);
  assert.throws(
    () =>
      loadConfig({
        AUTH_ENABLED: 'true',
        DATABASE_URL: 'postgresql://local/db',
        BETTER_AUTH_SECRET: 'x'.repeat(40),
        NODE_ENV: 'production',
      }),
    /HTTPS/,
  );
});

test('configuration rejects invalid values without disclosing secrets; digest canonicalizes JSON', () => {
  assert.throws(() => loadConfig({ API_PORT: 0 }), /API_PORT/);
  assert.throws(
    () => loadConfig({ DATABASE_URL: 'mysql://user:secret@host/database' }),
    /must use PostgreSQL/,
  );
  assert.throws(
    () => loadConfig({ WORKER_HEARTBEAT_MS: 5000, WORKER_STALE_MS: 1000 }),
    /two heartbeat/,
  );
  assert.equal(inputDigest({ a: 1, b: { c: 2, d: 3 } }), inputDigest({ b: { d: 3, c: 2 }, a: 1 }));
  assert.notEqual(inputDigest([1, 2]), inputDigest([2, 1]));
});
