import { FEEDBACK_DIMENSIONS, type FeedbackAssessment } from './feedback-template';
import type { InterviewEvaluation, InterviewTurn, InterviewReport } from './live-interview';

export const QUESTION_SCORING_VERSION = 'question-six-v1';
export const HR_SCORING_VERSION = 'question-observed-v2';
export const isQuestionScoringVersion = (version: string | undefined) =>
  version === QUESTION_SCORING_VERSION || version === HR_SCORING_VERSION;
export function validObservedScores(
  values: FeedbackAssessment[] | undefined,
): values is FeedbackAssessment[] {
  return (
    !!values &&
    values.length <= 6 &&
    new Set(values.map((a) => a.dimension)).size === values.length &&
    values.every(
      (a) =>
        FEEDBACK_DIMENSIONS.some((d) => d.key === a.dimension) &&
        Number.isFinite(a.score) &&
        a.score >= 0 &&
        a.score <= 100,
    )
  );
}
export function weightedObservedScore(values: FeedbackAssessment[]): number | null {
  if (!validObservedScores(values)) throw new Error('Invalid observed dimension scores');
  const weight = values.reduce(
    (sum, a) => sum + FEEDBACK_DIMENSIONS.find((d) => d.key === a.dimension)!.weight,
    0,
  );
  return weight
    ? values.reduce(
        (sum, a) => sum + a.score * FEEDBACK_DIMENSIONS.find((d) => d.key === a.dimension)!.weight,
        0,
      ) / weight
    : null;
}
export interface QuestionScore {
  turn_id: string;
  main_question_index: number;
  turn_ids: string[];
  score: number;
  assessments: FeedbackAssessment[];
}
export function completeSixScores(
  values: FeedbackAssessment[] | undefined,
): values is FeedbackAssessment[] {
  return (
    !!values &&
    values.length === 6 &&
    new Set(values.map((a) => a.dimension)).size === 6 &&
    FEEDBACK_DIMENSIONS.every((d) =>
      values.some(
        (a) => a.dimension === d.key && Number.isFinite(a.score) && a.score >= 0 && a.score <= 100,
      ),
    )
  );
}
/** Preserve precision until display; every dimension uses its fixed weight. */
export function weightedQuestionScore(values: FeedbackAssessment[]): number {
  if (!completeSixScores(values)) throw new Error('Six complete dimension scores are required');
  return (
    FEEDBACK_DIMENSIONS.reduce(
      (sum, d) => sum + values.find((a) => a.dimension === d.key)!.score * d.weight,
      0,
    ) / 100
  );
}
export function questionScores(
  turns: InterviewTurn[],
  evaluations: InterviewEvaluation[],
): QuestionScore[] {
  const groups = new Map<number, InterviewTurn[]>();
  for (const turn of turns) {
    if (turn.answer_status === 'answered')
      groups.set(turn.main_question_index, [...(groups.get(turn.main_question_index) ?? []), turn]);
  }
  return [...groups]
    .sort(([a], [b]) => a - b)
    .flatMap(([index, group]) => {
      group.sort((a, b) => a.follow_up_index - b.follow_up_index);
      // The last cumulative evaluation includes earlier answers; a failed last answer must not use an earlier score.
      const last = group.at(-1)!;
      const e = evaluations.find(
        (v) =>
          v.turn_id === last.id &&
          v.revision === last.revision &&
          isQuestionScoringVersion(v.question_scoring_version),
      );
      if (
        !e ||
        !e.feedback_assessments ||
        !(e.question_scoring_version === HR_SCORING_VERSION
          ? validObservedScores(e.feedback_assessments)
          : completeSixScores(e.feedback_assessments)) ||
        !e.feedback_assessments.length
      )
        return [];
      return [
        {
          turn_id: group[0].id,
          main_question_index: index,
          turn_ids: group.map((t) => t.id),
          score: weightedObservedScore(e.feedback_assessments)!,
          assessments: e.feedback_assessments,
        },
      ];
    });
}
export function aggregateQuestionAssessments(questions: QuestionScore[]): FeedbackAssessment[] {
  if (!questions.length) return [];
  return FEEDBACK_DIMENSIONS.flatMap((d) => {
    const values = questions.flatMap((q) => q.assessments.filter((a) => a.dimension === d.key));
    if (!values.length) return [];
    return [
      {
        dimension: d.key,
        score: values.reduce((sum, a) => sum + a.score, 0) / values.length,
        text: `按 ${values.length} 道已考察本维度的主问题等权平均；${d.short}评价本场回答展示。`,
        evidence_refs: [
          ...new Map(
            values.flatMap((a) => a.evidence_refs).map((r) => [JSON.stringify(r), r]),
          ).values(),
        ].slice(0, 2),
      },
    ];
  });
}
export function reportFeedback(report: InterviewReport) {
  const existing = report.summary?.feedback_template;
  if (!validObservedScores(report.feedback_assessments)) return existing;
  return {
    version: existing?.version ?? ('interview-feedback-v2' as const),
    assessments: report.feedback_assessments,
    action_plan: existing?.action_plan ?? [],
    next_expectation: existing?.next_expectation ?? '',
  };
}
