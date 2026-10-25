import assert from 'node:assert/strict';
import test from 'node:test';
import { ApiClientError, createApiClient } from '../../code/frontend/lib/api/http';

test('HTTP client uses the same origin, preserves idempotency and handles JSON and empty responses', async () => {
  const calls: { path: string; options?: RequestInit }[] = [];
  const request = createApiClient(async (path, options) => {
    calls.push({ path: String(path), options });
    return calls.length === 1
      ? Response.json({ task_id: 'task' }, { status: 202 })
      : new Response(null, { status: 204 });
  });
  assert.deepEqual(
    await request('/interviews', {
      method: 'POST',
      body: { job: 'frontend' },
      idempotencyKey: 'stable-key',
    }),
    { task_id: 'task' },
  );
  assert.equal(calls[0].path, '/api/v1/interviews');
  assert.equal(calls[0].options?.credentials, 'same-origin');
  assert.equal(calls[0].options?.redirect, 'error');
  assert.equal(new Headers(calls[0].options?.headers).get('idempotency-key'), 'stable-key');
  assert.equal(await request('/interviews/one', { method: 'DELETE' }), undefined);
  for (const path of [
    'https://other.test',
    '//other.test',
    '/../demo/v1/health',
    '/%2e%2e/health',
    '/auth\\session',
  ])
    await assert.rejects(request(path));
  assert.equal(calls.length, 2);
});

test('HTTP client retains structured errors and request IDs; proxy failures do not become successful demo data', async () => {
  const detail = {
    code: 'version_conflict',
    message: 'Version changed',
    retryable: false,
    request_id: 'request-one',
  };
  const request = createApiClient(async () => Response.json(detail, { status: 409 }));
  await assert.rejects(
    request('/interviews/one'),
    (error) =>
      error instanceof ApiClientError &&
      error.status === 409 &&
      error.detail.request_id === detail.request_id,
  );
  const broken = createApiClient(
    async () =>
      new Response('<html>private upstream error</html>', {
        status: 502,
        headers: { 'x-request-id': 'proxy-request' },
      }),
  );
  await assert.rejects(
    broken('/health'),
    (error) =>
      error instanceof ApiClientError &&
      error.detail.retryable &&
      error.detail.request_id === 'proxy-request' &&
      !error.message.includes('private'),
  );
});

test('HTTP client never retries writes and distinguishes cancellation from timeout', async () => {
  let count = 0;
  const unavailable = createApiClient(async () => {
    count++;
    throw new Error('private socket details');
  });
  await assert.rejects(
    unavailable('/interviews', { method: 'POST', body: {} }),
    (error) =>
      error instanceof ApiClientError &&
      error.detail.code === 'backend_unavailable' &&
      !error.message.includes('private'),
  );
  assert.equal(count, 1);
  const waiting = createApiClient(
    async (_path, options) =>
      new Promise((_resolve, reject) => {
        if (options?.signal?.aborted) reject(options.signal.reason);
        options?.signal?.addEventListener('abort', () => reject(options.signal?.reason), {
          once: true,
        });
      }),
  );
  const controller = new AbortController();
  const cancelled = waiting('/health', { signal: controller.signal });
  controller.abort();
  await assert.rejects(
    cancelled,
    (error) => error instanceof DOMException && error.name === 'AbortError',
  );
  // Keep the loop alive while AbortSignal.timeout's unref'ed timer is pending.
  const keepAlive = setTimeout(() => {}, 100);
  try {
    await assert.rejects(
      waiting('/health', { timeoutMs: 5 }),
      (error) => error instanceof ApiClientError && error.detail.code === 'request_timeout',
    );
  } finally {
    clearTimeout(keepAlive);
  }
});

test('malformed JSON retains the HTTP status and request ID', async () => {
  for (const status of [200, 401]) {
    const request = createApiClient(
      async () =>
        new Response('{broken', {
          status,
          headers: { 'content-type': 'application/json', 'x-request-id': 'broken-json-request' },
        }),
    );
    await assert.rejects(
      request('/auth/session'),
      (error) =>
        error instanceof ApiClientError &&
        error.status === status &&
        error.detail.request_id === 'broken-json-request',
    );
  }
});
