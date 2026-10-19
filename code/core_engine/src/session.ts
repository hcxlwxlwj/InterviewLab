import type { Session, Turn } from './domain/interview';
export function elapsedSeconds(session: Session, now = Date.now()): number {
  return Math.max(
    0,
    Math.floor(
      ((session.ended_at ? Date.parse(session.ended_at) : now) - Date.parse(session.started_at)) /
        1000,
    ),
  );
}
export function hasExpired(session: Session, now = Date.now()) {
  return elapsedSeconds(session, now) >= 720;
}
export function finishSession(session: Session, now = Date.now()): Session {
  if (session.status === 'completed' || session.status === 'failed') return session;
  return {
    ...session,
    status: 'completed',
    ended_at: new Date(now).toISOString(),
    report_ready_at: now + 1400,
    version: session.version + 1,
  };
}
export function transitionSession(
  session: Session,
  status: 'paused' | 'in_progress',
  now = Date.now(),
): Session {
  if (hasExpired(session, now) && (session.status === 'paused' || session.status === 'in_progress'))
    return finishSession(session, now);
  if (
    (session.status === 'in_progress' && status === 'paused') ||
    (session.status === 'paused' && status === 'in_progress')
  )
    return { ...session, status, version: session.version + 1 };
  throw new Error('当前状态不支持此操作');
}
export function commitAnswer(
  session: Session,
  text: string,
  action: 'answer' | 'skip',
  submissionId: string,
  now = Date.now(),
): Session {
  if (session.turns.some((t) => t.submission_id === submissionId)) return session;
  if (session.status !== 'in_progress') throw new Error('请先恢复面试再提交');
  if (hasExpired(session, now)) return finishSession(session, now);
  if (action === 'answer' && !text.trim()) throw new Error('请输入回答，或选择跳过');
  const question = session.questions[session.turns.length];
  if (!question) return finishSession(session, now);
  const stamp = new Date(now).toISOString();
  const turn: Turn = {
    ...question,
    input_mode: 'text_fallback',
    answer_text: action === 'answer' ? text.trim() : '',
    revision: 1,
    submission_id: submissionId,
    action,
    answer_segments:
      action === 'answer'
        ? [
            {
              id: `${submissionId}-segment`,
              source: 'text',
              text: text.trim(),
              seq: 1,
              started_at: stamp,
              ended_at: stamp,
              capture_status: 'complete',
            },
          ]
        : [],
  };
  const next: Session = {
    ...session,
    turns: [...session.turns, turn],
    version: session.version + 1,
  };
  return next.turns.length >= next.questions.length ? finishSession(next, now) : next;
}
