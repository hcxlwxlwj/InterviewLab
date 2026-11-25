import test from 'node:test';
import assert from 'node:assert/strict';
import {
  runInterviewEntry,
  type EntryRequest,
} from '../../code/frontend/features/live-interview/entry-request';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const work = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { work, resolve, reject };
}

test('the same interview shares one in-flight entry and releases it on completion', async () => {
  const pending = { current: null as EntryRequest<string> | null };
  const task = deferred<string>();
  let starts = 0;
  const first = runInterviewEntry(
    'a',
    pending,
    () => {
      starts++;
      return task.work;
    },
    { cancel: () => {} },
  );
  const repeated = runInterviewEntry(
    'a',
    pending,
    () => {
      starts++;
      return task.work;
    },
    { cancel: () => {} },
  );
  assert.equal(first, repeated);
  assert.equal(starts, 1);
  task.resolve('a');
  assert.equal(await first, 'a');
  assert.equal(pending.current, null);
});

test('a different interview cancels the old generation before starting its own entry', async () => {
  const pending = { current: null as EntryRequest<string> | null };
  const old = deferred<string>();
  const next = deferred<string>();
  const events: string[] = [];
  const first = runInterviewEntry('a', pending, () => old.work, { cancel: () => {} });
  const second = runInterviewEntry(
    'b',
    pending,
    () => {
      events.push('start-b');
      return next.work;
    },
    {
      cancel: () => {
        events.push('cancel-a');
        pending.current = null;
      },
    },
  );
  assert.notEqual(first, second);
  assert.deepEqual(events, ['cancel-a', 'start-b']);
  old.resolve('a');
  assert.equal(await first, 'a');
  assert.equal(pending.current?.id, 'b');
  next.resolve('b');
  assert.equal(await second, 'b');
  assert.equal(pending.current, null);
});

test('a failed old entry cannot clear a newer entry or prevent retry', async () => {
  const pending = { current: null as EntryRequest<string> | null };
  const old = deferred<string>();
  const next = deferred<string>();
  const first = runInterviewEntry('a', pending, () => old.work, { cancel: () => {} });
  const second = runInterviewEntry('b', pending, () => next.work, { cancel: () => {} });
  const rejected = assert.rejects(first, /cancelled/);
  old.reject(new Error('cancelled'));
  await rejected;
  assert.equal(pending.current?.id, 'b');
  next.resolve('b');
  await second;
  assert.equal(
    await runInterviewEntry('b', pending, async () => 'retry-b', { cancel: () => {} }),
    'retry-b',
  );
});

test('switching from a running interview releases its devices before preparing a new one', async () => {
  const pending = { current: null as EntryRequest<string> | null };
  let released = false;
  let textMode = true;
  const result = await runInterviewEntry(
    'b',
    pending,
    async () => {
      assert.equal(released, true);
      assert.equal(textMode, false);
      return 'b';
    },
    {
      activeId: 'a',
      cancel: () => {
        released = true;
        textMode = false;
      },
    },
  );
  assert.equal(result, 'b');
});
