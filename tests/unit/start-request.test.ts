import test from 'node:test';
import assert from 'node:assert/strict';
import type { Interview } from '@interviewlab/core';
import { ApiClientError } from '../../code/frontend/lib/api/http';
import {
  startPreparedInterview,
  type StartRequest,
} from '../../code/frontend/features/live-interview/start-request';

const view = (status: Interview['status'] = 'ready') =>
  ({
    id: 'synthetic',
    version: 4,
    status,
    preparation: { status: 'ready', task_id: null, error_code: null },
  }) as Interview;
const networkError = () =>
  new ApiClientError(0, {
    code: 'network_error',
    message: '连接中断',
    retryable: true,
    request_id: 'synthetic',
  });
test('lost start responses recover the running interview without starting a second time', async () => {
  let running = false,
    starts = 0;
  const request = { current: null as StartRequest | null };
  const result = await startPreparedInterview('synthetic', {
    request,
    storageKey: 'test',
    isCurrent: () => true,
    storage: null,
    api: {
      read: async () => view(running ? 'in_progress' : 'ready'),
      command: async () => {
        starts++;
        running = true;
        throw networkError();
      },
    },
  });
  assert.equal(result.status, 'in_progress');
  assert.equal(starts, 1);
  assert.equal(request.current, null);
});
test('an uncertain start reuses its persisted key on an explicit retry and after reload', async () => {
  const saved = new Map<string, string>();
  const storage = {
    getItem: (key: string) => saved.get(key) ?? null,
    setItem: (key: string, value: string) => {
      saved.set(key, value);
    },
    removeItem: (key: string) => {
      saved.delete(key);
    },
  };
  const keys: string[] = [];
  const api = {
    read: async () => view(),
    command: async (_id: string, _action: string, _body: unknown, key: string) => {
      keys.push(key);
      throw networkError();
    },
  };
  for (let i = 0; i < 2; i++)
    await assert.rejects(
      startPreparedInterview('synthetic', {
        request: { current: null },
        storageKey: 'test',
        isCurrent: () => true,
        storage,
        api,
      }),
    );
  assert.equal(keys.length, 2);
  assert.equal(keys[0], keys[1]);
});
test('cancellation, paused sessions and unfinished preparation never send a start command', async () => {
  let starts = 0;
  for (const scenario of ['cancelled', 'paused', 'preparing'] as const) {
    const pending = view(scenario === 'paused' ? 'paused' : 'ready');
    if (scenario === 'preparing') pending.preparation!.status = 'pending';
    await assert.rejects(
      startPreparedInterview('synthetic', {
        request: { current: null },
        storageKey: 'test',
        isCurrent: () => scenario !== 'cancelled',
        storage: null,
        api: {
          read: async () => pending,
          command: async () => {
            starts++;
            return view('in_progress');
          },
        },
      }),
    );
  }
  assert.equal(starts, 0);
});
