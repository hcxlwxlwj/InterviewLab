import type { Interview } from '@interviewlab/core';
import { ApiClientError } from '../../lib/api/http';
import { interviewsApi } from '../../lib/api/interviews';

function canRecoverPresentation(error: unknown): boolean {
  return (
    error instanceof ApiClientError &&
    (error.status === 0 ||
      error.status === 409 ||
      error.status >= 500 ||
      error.detail.code === 'invalid_response')
  );
}

function waitingForPresentation(view: Interview, turnId: string): boolean {
  const turn = view.turns.at(-1);
  return view.status === 'in_progress' && turn?.id === turnId && turn.answer_status === 'waiting';
}

/** An uncertain receipt is recovered before one bounded retry with the current version. */
export async function confirmQuestionPresentation(
  view: Interview,
  turnId: string,
  isCurrent: () => boolean,
  api: Pick<typeof interviewsApi, 'read' | 'command'> = interviewsApi,
): Promise<boolean> {
  const action = `turns/${turnId}/presented`;
  let key = crypto.randomUUID();
  try {
    await api.command(view.id, action, { version: view.version }, key);
    return true;
  } catch (error) {
    if (!canRecoverPresentation(error)) throw error;
  }
  if (!isCurrent()) return false;
  const fresh = await api.read(view.id);
  if (!isCurrent()) return false;
  const turn = fresh.turns.at(-1);
  if (turn?.id === turnId && turn.presented_at) return true;
  if (!waitingForPresentation(fresh, turnId)) return false;
  if (fresh.version !== view.version) key = crypto.randomUUID();
  await api.command(view.id, action, { version: fresh.version }, key);
  return true;
}
