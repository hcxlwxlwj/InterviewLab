import test from 'node:test';
import assert from 'node:assert/strict';
import { interviewDevelopmentSession } from '../../code/frontend/lib/development-session';
import { buildApp } from '../../code/backend/src/server/app';
import { loadConfig } from '../../code/backend/src/foundation/config';

test('development identity is explicit, has no token, and is unavailable in production', () => {
  assert.equal(interviewDevelopmentSession({ NODE_ENV: 'development' }), undefined);
  assert.equal(
    interviewDevelopmentSession({
      NODE_ENV: 'production',
      INTERVIEW_DEV_OWNER_ID: 'interview-dev-local',
    }),
    undefined,
  );
  assert.equal(
    interviewDevelopmentSession({
      NODE_ENV: 'test',
      INTERVIEW_DEV_OWNER_ID: 'interview-dev-local',
    }),
    undefined,
  );
  const session = interviewDevelopmentSession({
    NODE_ENV: 'development',
    INTERVIEW_DEV_OWNER_ID: 'interview-dev-local',
  });
  assert.equal(session?.user.id, 'interview-dev-local');
  assert.deepEqual(session?.roles, ['student']);
  assert.ok(!JSON.stringify(session).includes('token'));
  assert.ok(!JSON.stringify(session).includes('password'));
});

test('local composition injects identity without accounts and ignores client-supplied owners', async (t) => {
  const app = await buildApp({
    config: loadConfig({ NODE_ENV: 'test', LOG_LEVEL: 'silent' }),
    logger: false,
    identity: {
      authenticate: async () => ({ owner_id: 'interview-dev-local', roles: ['student'] }),
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
  assert.deepEqual(result.json(), { owner_id: 'interview-dev-local', roles: ['student'] });
  assert.equal((await app.inject('/api/v1/auth/session')).statusCode, 501);
});
