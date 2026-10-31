import assert from 'node:assert/strict';
import test from 'node:test';
import { signUpSchema, signInSchema } from '../../code/backend/src/modules/accounts/auth-routes';
test('registration passwords accept 9–20 characters and reject values outside the range', () => {
  for (const length of [8, 9, 20, 21]) {
    assert.equal(
      signUpSchema.safeParse({
        name: 'Student',
        email: 'student@example.com',
        password: 'x'.repeat(length),
      }).success,
      length >= 9 && length <= 20,
    );
  }
});
test('existing users can still sign in with older longer passwords', () => {
  assert.equal(
    signInSchema.safeParse({ email: 'student@example.com', password: 'x'.repeat(32) }).success,
    true,
  );
});
