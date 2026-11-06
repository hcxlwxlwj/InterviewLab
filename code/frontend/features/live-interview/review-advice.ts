import type { InterviewEvaluation } from '@interviewlab/core';

/** Use one source for the next action instead of repeating gaps, goals and references. */
export function reviewAdvice(
  evaluation: Pick<InterviewEvaluation, 'retry_goal' | 'gaps' | 'reference_points'>,
): string[] {
  const goal = evaluation.retry_goal.trim();
  if (goal) return [goal];
  const gaps = evaluation.gaps.map((item) => item.text.trim()).filter(Boolean);
  return [
    ...new Set(
      gaps.length ? gaps : evaluation.reference_points.map((text) => text.trim()).filter(Boolean),
    ),
  ];
}
