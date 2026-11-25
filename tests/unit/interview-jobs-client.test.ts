import assert from 'node:assert/strict';
import test from 'node:test';
import { publicCatalogRepository } from '../../code/backend/src/modules/jobs/repository';
import { createJobsService } from '../../code/backend/src/modules/jobs/service';
import { interviewsApi } from '../../code/frontend/lib/api/interviews';
import { ApiClientError } from '../../code/frontend/lib/api/http';

test('interview job selectors include the complete published catalog across pages', async (t) => {
  const service = createJobsService(publicCatalogRepository);
  const expected = publicCatalogRepository
    .search({})
    .map((job) => job.id)
    .sort();
  const requests: string[] = [];
  t.mock.method(globalThis, 'fetch', async (input: RequestInfo | URL) => {
    const url = new URL(String(input), 'https://interviewlab.invalid');
    assert.equal(url.pathname, '/api/v1/job-templates');
    assert.equal(url.searchParams.get('limit'), '50');
    requests.push(url.search);
    return Response.json(
      service.list({ limit: 50, cursor: url.searchParams.get('cursor') ?? undefined }),
    );
  });

  const result = await interviewsApi.jobs();

  assert.equal(result.next_cursor, null);
  assert.deepEqual(result.items.map((job) => job.id).sort(), expected);
  assert.equal(new Set(result.items.map((job) => job.id)).size, expected.length);
  assert.equal(requests.length, Math.ceil(expected.length / 50));
  assert.ok(requests.length > 1);
});

test('a later job page failure does not return an incomplete selector as success', async (t) => {
  let requests = 0;
  t.mock.method(globalThis, 'fetch', async () => {
    requests++;
    return requests === 1
      ? Response.json({ items: [{ id: 'first-page-job' }], next_cursor: 'next/page+cursor=' })
      : Response.json(
          {
            code: 'backend_unavailable',
            message: 'Unavailable',
            retryable: true,
            request_id: 'two',
          },
          { status: 503 },
        );
  });

  await assert.rejects(
    interviewsApi.jobs(),
    (error) => error instanceof ApiClientError && error.status === 503,
  );
  assert.equal(requests, 2);
});

test('cancelling job loading aborts a later page and stops pagination', async (t) => {
  const controller = new AbortController();
  const reason = new Error('Page left');
  let requests = 0;
  let reachedSecondPage!: () => void;
  const secondPage = new Promise<void>((resolve) => {
    reachedSecondPage = resolve;
  });
  t.mock.method(globalThis, 'fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    requests++;
    if (requests === 1)
      return Response.json({ items: [{ id: 'first-page-job' }], next_cursor: 'next/page+cursor=' });
    const url = new URL(String(input), 'https://interviewlab.invalid');
    assert.equal(url.searchParams.get('cursor'), 'next/page+cursor=');
    return new Promise<Response>((_resolve, reject) => {
      init!.signal!.addEventListener('abort', () => reject(init!.signal!.reason), { once: true });
      reachedSecondPage();
    });
  });

  const loading = interviewsApi.jobs(controller.signal);
  await secondPage;
  controller.abort(reason);

  await assert.rejects(loading, (error) => error === reason);
  assert.equal(requests, 2);
});
