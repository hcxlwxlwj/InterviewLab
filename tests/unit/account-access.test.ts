import assert from 'node:assert/strict';
import test from 'node:test';
import { businessTarget, requiresLogin } from '../../code/frontend/lib/access';
import { signUpSchema } from '../../code/backend/src/modules/accounts/auth-routes';
test('authentication restores only local business destinations and preserves filters', () => {
  assert.equal(
    businessTarget('/jobs?category=engineering#job-jd'),
    '/jobs?category=engineering#job-jd',
  );
  for (const value of [
    'https://attacker.test/me',
    '//attacker.test/me',
    '/me/../../api/v1/auth/sign-out',
    '/%2f%2fattacker.test',
    '/api/v1/auth/session',
    '/login',
    '/#faq',
    '/me\\evil',
    '/me\n',
  ])
    assert.equal(businessTarget(value), null);
  assert.equal(requiresLogin('/'), false);
  assert.equal(requiresLogin('/login'), false);
  assert.equal(requiresLogin('/me/interviews'), true);
});
test('signup contract normalizes names and emails while rejecting unexpected identity fields', () => {
  assert.deepEqual(
    signUpSchema.parse({
      name: ' Student ',
      email: 'STUDENT@example.test',
      password: 'long-test-password',
    }),
    { name: 'Student', email: 'student@example.test', password: 'long-test-password' },
  );
  assert.equal(
    signUpSchema.safeParse({
      name: 'Student',
      email: 'student@example.test',
      password: 'long-test-password',
      role: 'operator',
    }).success,
    false,
  );
});
