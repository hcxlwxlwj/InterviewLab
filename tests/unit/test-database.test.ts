import test from 'node:test';
import assert from 'node:assert/strict';
import { testDatabaseUrl } from '../support/test-database';

test('test tools preserve the explicitly selected database and connection options', () => {
  const value =
    'postgresql://tester:secret@localhost:5544/interviewlab_test_realtime?sslmode=require';
  assert.equal(testDatabaseUrl({ TEST_DATABASE_URL: value }), value);
  assert.equal(
    testDatabaseUrl({ TEST_DATABASE_URL: 'postgres://localhost/interviewlab_test' }),
    'postgres://localhost/interviewlab_test',
  );
});

test('test tools reject application databases, development databases and non-PostgreSQL URLs', () => {
  for (const value of [
    'postgresql://localhost/interviewlab',
    'postgresql://localhost/interviewlab_dev_interviews',
    'postgresql://localhost/interviewlab_test%2Fother',
    'https://localhost/interviewlab_test',
    '',
  ])
    assert.throws(() => testDatabaseUrl({ TEST_DATABASE_URL: value }), /TEST_DATABASE_URL/);
  assert.throws(
    () => testDatabaseUrl({ DATABASE_URL: 'postgresql://localhost/interviewlab' }),
    /TEST_DATABASE_URL/,
  );
});

test('invalid database configuration reports no credentials or raw parser error', () => {
  assert.throws(
    () => testDatabaseUrl({ TEST_DATABASE_URL: 'postgresql://tester:private-secret@[' }),
    (error: Error) =>
      error.message.includes('TEST_DATABASE_URL') && !error.message.includes('private-secret'),
  );
});
