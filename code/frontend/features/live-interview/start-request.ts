import type { Interview } from '@interviewlab/core';
import { ApiClientError } from '../../lib/api/http';
import { interviewsApi } from '../../lib/api/interviews';

export interface StartRequest {
  id: string;
  version: number;
  key: string;
}
/** Recovery confirms server state before retrying the same start operation. */
export async function startPreparedInterview(
  id: string,
  options: {
    request: { current: StartRequest | null };
    storageKey: string;
    isCurrent: () => boolean;
    api?: Pick<typeof interviewsApi, 'read' | 'command'>;
    storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null;
  },
): Promise<Interview> {
  const api = options.api ?? interviewsApi;
  let storage = options.storage ?? null;
  if (options.storage === undefined) {
    try {
      storage = typeof sessionStorage === 'undefined' ? null : sessionStorage;
    } catch {}
  }
  const assertCurrent = () => {
    if (!options.isCurrent()) throw new Error('本次准备已取消。');
  };
  const clear = () => {
    options.request.current = null;
    try {
      storage?.removeItem(options.storageKey);
    } catch {}
  };
  const fresh = await api.read(id);
  assertCurrent();
  if (fresh.status === 'in_progress') {
    clear();
    return fresh;
  }
  if (fresh.status !== 'ready')
    throw new Error(
      fresh.status === 'paused' ? '本场已暂停，请从面试间继续。' : '本场面试已结束。',
    );
  if (fresh.preparation && !['ready', 'fallback'].includes(fresh.preparation.status))
    throw new Error('面试仍在准备，请稍候。');
  if (options.request.current?.id !== id) {
    try {
      const saved = JSON.parse(
        storage?.getItem(options.storageKey) ?? 'null',
      ) as StartRequest | null;
      if (saved?.id === id && typeof saved.key === 'string' && Number.isInteger(saved.version))
        options.request.current = saved;
    } catch {}
  }
  if (options.request.current?.id !== id || options.request.current.version !== fresh.version)
    options.request.current = { id, version: fresh.version, key: crypto.randomUUID() };
  const request = options.request.current;
  try {
    storage?.setItem(options.storageKey, JSON.stringify(request));
  } catch {}
  assertCurrent();
  try {
    const next = await api.command(id, 'start', { version: request.version }, request.key);
    assertCurrent();
    clear();
    return next;
  } catch (error) {
    assertCurrent();
    if (
      error instanceof ApiClientError &&
      (error.status === 0 || error.status >= 500 || error.status === 409)
    ) {
      const recovered = await api.read(id);
      assertCurrent();
      if (recovered.status === 'in_progress') {
        clear();
        return recovered;
      }
    }
    throw error;
  }
}
