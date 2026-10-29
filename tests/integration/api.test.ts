import test from 'node:test';
import assert from 'node:assert/strict';
import { handleApi } from '@interviewlab/backend';
import { defaultConfiguration } from '@interviewlab/core';
const base = 'http://localhost:3000/api/v1';
test('fixture API exposes capability status and cursor envelope', async () => {
  const health = await handleApi(new Request(`${base}/health`), ['health']);
  const body = await health.json();
  assert.equal(body.capabilities.authentication, false);
  assert.equal(body.capabilities.database, false);
  const jobs = await handleApi(new Request(`${base}/job-templates`), ['job-templates']);
  const page = await jobs.json();
  assert.equal(page.items.length, 20);
  assert.equal(page.next_cursor, '20');
  assert.equal(jobs.headers.get('X-InterviewLab-Mode'), 'curated-public-content');
  assert.equal(jobs.headers.get('cache-control'), 'no-store');
});
test('only the explicit public sample is readable', async () => {
  const sample = await handleApi(new Request(`${base}/sessions/sample-interview`), [
    'sessions',
    'sample-interview',
  ]);
  assert.equal(sample.status, 200);
  assert.equal((await sample.json()).is_sample, true);
  const privateSession = await handleApi(new Request(`${base}/sessions/other-user-id`), [
    'sessions',
    'other-user-id',
  ]);
  assert.equal(privateSession.status, 404);
  assert.equal((await privateSession.json()).code, 'not_found');
});
test('cross-origin and missing-origin writes are rejected', async () => {
  for (const origin of [undefined, 'https://other.example']) {
    const response = await handleApi(
      new Request(`${base}/sessions`, { method: 'POST', headers: origin ? { origin } : {} }),
      ['sessions'],
    );
    assert.equal(response.status, 403);
    assert.equal((await response.json()).code, 'forbidden');
  }
});
test('invalid JSON and invalid configuration return structured errors', async () => {
  for (const body of ['{bad', '{}']) {
    const response = await handleApi(
      new Request(`${base}/sessions`, {
        method: 'POST',
        headers: { origin: 'http://localhost:3000' },
        body,
      }),
      ['sessions'],
    );
    assert.equal(response.status, 400);
    const err = await response.json();
    assert.equal(err.code, 'unsupported_input');
    assert.equal(err.retryable, false);
    assert.ok(err.request_id);
  }
});
test('valid writes and external services explicitly remain unavailable', async () => {
  const response = await handleApi(
    new Request(`${base}/sessions`, {
      method: 'POST',
      headers: { origin: 'http://localhost:3000' },
      body: JSON.stringify({
        mode: 'mock',
        configuration: defaultConfiguration(),
        idempotency_key: 'key1',
      }),
    }),
    ['sessions'],
  );
  assert.equal(response.status, 501);
  assert.equal((await response.json()).code, 'capability_unavailable');
  const execution = await handleApi(
    new Request(`${base}/code-submissions/a/runs`, {
      method: 'POST',
      headers: { origin: 'http://localhost:3000' },
    }),
    ['code-submissions', 'a', 'runs'],
  );
  assert.equal(execution.status, 501);
});

test('catalog pagination, filters, detail, source routes and invalid cursors are explicit', async () => {
  const a = await (
    await handleApi(new Request(`${base}/job-templates?limit=30`), ['job-templates'])
  ).json();
  const pages = [a];
  for (let cursor = a.next_cursor; cursor; ) {
    const page = await (
      await handleApi(new Request(`${base}/job-templates?limit=30&cursor=${cursor}`), [
        'job-templates',
      ])
    ).json();
    pages.push(page);
    cursor = page.next_cursor;
  }
  assert.equal(pages.length, 34);
  assert.deepEqual(
    pages.map((page) => page.items.length),
    [...Array(33).fill(30), 10],
  );
  assert.equal(
    new Set(pages.flatMap((page) => page.items.map((j: { id: string }) => j.id))).size,
    1000,
  );
  assert.equal(pages[pages.length - 1].next_cursor, null);
  const products = await (
    await handleApi(new Request(`${base}/job-templates?category=product&stage=internship`), [
      'job-templates',
    ])
  ).json();
  assert.equal(products.items.length, 4);
  const detail = await (
    await handleApi(new Request(`${base}/job-templates/ai-product`), [
      'job-templates',
      'ai-product',
    ])
  ).json();
  assert.equal(detail.questions.length, 8);
  assert.equal(
    (await handleApi(new Request(`${base}/job-templates/unknown`), ['job-templates', 'unknown']))
      .status,
    404,
  );
  assert.equal(
    (await handleApi(new Request(`${base}/job-templates?cursor=NaN`), ['job-templates'])).status,
    400,
  );
  const sources = await (
    await handleApi(new Request(`${base}/job-templates/ai-product/sources`), [
      'job-templates',
      'ai-product',
      'sources',
    ])
  ).json();
  assert.ok(sources.items.length > 0);
  assert.deepEqual(
    sources.items.map((source: { id: string }) => source.id).sort(),
    [...detail.source_refs].sort(),
  );
});
test('new write skeletons validate input and never claim persistence', async () => {
  for (const route of ['job-targets', 'me/bookmarks', 'resume-documents']) {
    const response = await handleApi(
      new Request(`${base}/${route}`, {
        method: 'POST',
        headers: { origin: 'http://localhost:3000', 'content-type': 'application/json' },
        body: '{}',
      }),
      route.split('/'),
    );
    assert.equal(response.status, 400);
  }
  const valid = await handleApi(
    new Request(`${base}/me/bookmarks`, {
      method: 'POST',
      headers: { origin: 'http://localhost:3000', 'content-type': 'application/json' },
      body: JSON.stringify({ template_id: 'ai-product', version: 0 }),
    }),
    ['me', 'bookmarks'],
  );
  assert.equal(valid.status, 501);
});
