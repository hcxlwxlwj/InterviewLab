import test from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../../code/backend/src/server/app';
import { loadConfig } from '../../code/backend/src/foundation/config';

test('client-supplied identity cannot authenticate a signed-out request', async (t) => {
  const app = await buildApp({
    config: loadConfig({ NODE_ENV: 'test', LOG_LEVEL: 'silent' }),
    logger: false,
    identity: { authenticate: async () => null },
  });
  t.after(() => app.close());
  const response = await app.inject({
    url: '/api/v1/tasks/00000000-0000-4000-8000-000000000001',
    headers: { 'x-owner-id': 'other-user', cookie: 'owner_id=other-user' },
  });
  assert.equal(response.statusCode, 401);
});

test('module identity comes from the server provider rather than request owner fields', async (t) => {
  const app = await buildApp({
    config: loadConfig({ NODE_ENV: 'test', LOG_LEVEL: 'silent' }),
    logger: false,
    identity: {
      authenticate: async () => ({ owner_id: 'verified-test-user', roles: ['student'] }),
    },
    modules: [
      {
        name: 'resumes',
        async register(instance, context) {
          instance.get('/identity-contract-test', (request) => context.requireIdentity(request));
        },
      },
    ],
  });
  t.after(() => app.close());
  const result = await app.inject({
    url: '/api/v1/identity-contract-test',
    headers: { 'x-owner-id': 'other-user', cookie: 'owner_id=other-user' },
  });
  assert.equal(result.statusCode, 200);
  assert.deepEqual(result.json(), { owner_id: 'verified-test-user', roles: ['student'] });
  assert.equal((await app.inject('/api/v1/auth/session')).statusCode, 501);
});
