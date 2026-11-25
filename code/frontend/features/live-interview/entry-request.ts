export interface EntryRequest<T> {
  id: string;
  work: Promise<T>;
}

/** Share work for one interview, and invalidate the old entry before switching interviews. */
export function runInterviewEntry<T>(
  id: string,
  pending: { current: EntryRequest<T> | null },
  start: () => Promise<T>,
  lifecycle: { activeId?: string | null; cancel: () => void },
): Promise<T> {
  if (pending.current?.id === id) return pending.current.work;
  if (pending.current || (lifecycle.activeId && lifecycle.activeId !== id)) lifecycle.cancel();
  const work = start().finally(() => {
    if (pending.current?.work === work) pending.current = null;
  });
  pending.current = { id, work };
  return work;
}
