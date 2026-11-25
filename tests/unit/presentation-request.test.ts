import test from 'node:test';
import assert from 'node:assert/strict';
import type { Interview } from '@interviewlab/core';
import { ApiClientError } from '../../code/frontend/lib/api/http';
import { confirmQuestionPresentation } from '../../code/frontend/features/live-interview/presentation-request';

const view = (version = 1) =>
  ({
    id: 'session',
    version,
    status: 'in_progress',
    turns: [{ id: 'question', answer_status: 'waiting', presented_at: null }],
  }) as Interview;
const networkError = () =>
  new ApiClientError(0, {
    code: 'backend_unavailable',
    message: 'offline',
    retryable: true,
    request_id: 'synthetic',
  });

test('a lost presentation receipt is recovered without a duplicate write', async () => {
  let calls = 0;
  const fresh = view();
  fresh.turns[0].presented_at = '2026-11-25T00:00:00Z';
  assert.equal(
    await confirmQuestionPresentation(view(), 'question', () => true, {
      read: async () => fresh,
      command: async () => {
        calls++;
        throw networkError();
      },
    }),
    true,
  );
  assert.equal(calls, 1);
});

test('an unconfirmed receipt retries once and preserves the key for the same input', async () => {
  const keys: string[] = [];
  assert.equal(
    await confirmQuestionPresentation(view(), 'question', () => true, {
      read: async () => view(),
      command: async (_id, _action, _body, key) => {
        keys.push(key);
        if (keys.length === 1) throw networkError();
        return view();
      },
    }),
    true,
  );
  assert.equal(keys.length, 2);
  assert.equal(keys[0], keys[1]);
});

test('a newer session version receives a new idempotency key and current version', async () => {
  const calls: { key: string; body: unknown }[] = [];
  await confirmQuestionPresentation(view(), 'question', () => true, {
    read: async () => view(2),
    command: async (_id, _action, body, key) => {
      calls.push({ key, body });
      if (calls.length === 1) throw networkError();
      return view(2);
    },
  });
  assert.notEqual(calls[0].key, calls[1].key);
  assert.deepEqual(calls[1].body, { version: 2 });
});

test('persistent failure stays visible and the bounded retry stops', async () => {
  let calls = 0;
  await assert.rejects(
    confirmQuestionPresentation(view(), 'question', () => true, {
      read: async () => view(),
      command: async () => {
        calls++;
        throw networkError();
      },
    }),
    ApiClientError,
  );
  assert.equal(calls, 2);
});

test('cancelled, paused and replaced questions never receive a retry', async () => {
  for (const scenario of ['cancelled', 'paused', 'replaced']) {
    let calls = 0;
    const fresh = view();
    if (scenario === 'paused') fresh.status = 'paused';
    if (scenario === 'replaced') fresh.turns[0].id = 'next-question';
    assert.equal(
      await confirmQuestionPresentation(view(), 'question', () => scenario !== 'cancelled', {
        read: async () => fresh,
        command: async () => {
          calls++;
          throw networkError();
        },
      }),
      false,
    );
    assert.equal(calls, 1);
  }
});
