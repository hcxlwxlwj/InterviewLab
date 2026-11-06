import {
  FEEDBACK_DIMENSIONS,
  type FeedbackAssessment,
  type FeedbackObservation,
} from './feedback-template';
import type { InterviewResponseAssessment } from './interview-response';
import { evidenceMatches } from './live-interview';
import type { InterviewEvaluation, InterviewTurn, InterviewReport } from './live-interview';

export const QUESTION_SCORING_VERSION = 'question-six-v1';
export const HR_SCORING_VERSION = 'question-observed-v2';
export const EVIDENCE_SCORING_VERSION = 'question-evidence-v3';
export const WHOLE_INTERVIEW_SCORING_VERSION = 'whole-interview-six-v1';
export const isQuestionScoringVersion = (version: string | undefined) =>
  version === QUESTION_SCORING_VERSION ||
  version === HR_SCORING_VERSION ||
  version === EVIDENCE_SCORING_VERSION;
export interface AssessedResponse extends InterviewResponseAssessment {
  turn_id: string;
  revision: number;
  question_scope: ScoringQuestionScope;
  knowledge_evidence?: 'demonstrated' | 'claim_only' | 'not_present' | 'unclear';
}
export const QUESTION_SCOPE_KINDS = [
  'closed_fact',
  'explanation',
  'experience_detail',
  'decision_process',
  'reflection',
  'motivation',
  'administrative',
  'protocol',
] as const;
export interface ScoringQuestionScope {
  kind: (typeof QUESTION_SCOPE_KINDS)[number];
  dimensions: import('./feedback-template').FeedbackDimensionKey[];
  expectation: string;
}
export function validQuestionScope(scope: ScoringQuestionScope): boolean {
  if (new Set(scope.dimensions).size !== scope.dimensions.length) return false;
  if (['administrative', 'protocol'].includes(scope.kind)) return scope.dimensions.length === 0;
  if (scope.kind === 'closed_fact')
    return (
      scope.dimensions.length <= 1 &&
      scope.dimensions.every((d) => ['professional_foundation', 'project_reflection'].includes(d))
    );
  return true;
}
export function responseCanSupportScore(response: InterviewResponseAssessment): boolean {
  return (
    response.response_eligibility === 'answer' &&
    response.relevance !== 'nonresponsive' &&
    response.sufficiency !== 'not_applicable' &&
    ['answer', 'dont_know'].includes(response.act)
  );
}
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
        !([HR_SCORING_VERSION, EVIDENCE_SCORING_VERSION].includes(e.question_scoring_version ?? '')
          ? validObservedScores(e.feedback_assessments)
          : completeSixScores(e.feedback_assessments)) ||
        !e.feedback_assessments.length
      )
        return [];
      if (
        e.question_scoring_version === EVIDENCE_SCORING_VERSION &&
        e.feedback_assessments.some(
          (a) =>
            !a.evidence_refs.length ||
            a.evidence_refs.some(
              (ref) =>
                !evidenceMatches(ref, group) ||
                !e.response_assessments?.some(
                  (r) =>
                    r.turn_id === ref.turn_id &&
                    r.revision === ref.revision &&
                    responseCanSupportScore(r),
                ),
            ),
        )
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
    if (values.length === 1) return values;
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
/** Whole-session display scores: absent demonstrations earn zero, never invented evidence. */
export function completeInterviewAssessments(values: FeedbackAssessment[]): FeedbackAssessment[] {
  if (!validObservedScores(values)) throw new Error('Invalid dimension scores');
  return FEEDBACK_DIMENSIONS.map(
    (d) =>
      values.find((a) => a.dimension === d.key) ?? {
        dimension: d.key,
        score: 0,
        text: `本场回答未体现${d.short}，按本场展示计0分。`,
        evidence_refs: [],
      },
  );
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

export function aggregateFeedbackObservations(
  evaluations: InterviewEvaluation[],
  assessments: FeedbackAssessment[],
): FeedbackObservation[] {
  return FEEDBACK_DIMENSIONS.map((d) => {
    const score = assessments.find((a) => a.dimension === d.key);
    if (score)
      return {
        dimension: d.key,
        status: 'observed',
        text: score.text,
        evidence_refs: score.evidence_refs,
      };
    const related = evaluations.flatMap(
      (e) => e.feedback_observations?.filter((o) => o.dimension === d.key) ?? [],
    );
    const insufficient = related.some((o) => o.status === 'insufficient_evidence');
    return {
      dimension: d.key,
      status: insufficient ? 'insufficient_evidence' : 'not_observed',
      text: insufficient
        ? '本场回答未提供足够的可评分依据。'
        : '本场没有形成此维度的实际考察证据。',
      evidence_refs: [],
    };
  });
}
