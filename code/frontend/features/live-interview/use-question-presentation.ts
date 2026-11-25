import { useEffect, useRef, useState } from 'react';
import type { Interview } from '@interviewlab/core';
import { confirmQuestionPresentation } from './presentation-request';

export function useQuestionPresentation(view: Interview | null) {
  const confirmed = useRef(new Set<string>());
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const turn = view?.turns.at(-1);
  useEffect(() => {
    setError('');
    if (
      !view ||
      view.status !== 'in_progress' ||
      !turn ||
      turn.answer_status !== 'waiting' ||
      turn.presented_at ||
      confirmed.current.has(turn.id)
    )
      return;
    let current = true;
    void confirmQuestionPresentation(view, turn.id, () => current).then(
      (received) => {
        if (current && received) confirmed.current.add(turn.id);
      },
      () => {
        if (current) setError('题目展示状态暂未确认，请重试。当前回答仍保留在页面中。');
      },
    );
    return () => {
      current = false;
    };
  }, [view?.id, view?.status, turn?.id, turn?.answer_status, turn?.presented_at, attempt]);
  return { error, retry: () => setAttempt((value) => value + 1) };
}
