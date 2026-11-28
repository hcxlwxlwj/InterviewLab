import type {
  DimensionKey,
  Interview,
  InterviewReport,
  InterviewSnapshot,
  InterviewEvaluation,
} from '@interviewlab/core';
import {
  FRONTEND_RUBRIC_VERSION,
  aggregateIndicatorScores,
  feedbackScore,
  QUESTION_SCORING_VERSION,
  HR_SCORING_VERSION,
  EVIDENCE_SCORING_VERSION,
  completeSixScores,
  aggregateFeedbackObservations,
  isQuestionScoringVersion,
  questionScores,
  aggregateQuestionAssessments,
  weightedQuestionScore,
  weightedObservedScore,
  completeInterviewAssessments,
  WHOLE_INTERVIEW_SCORING_VERSION,
} from '@interviewlab/core';
import { inputDigest } from '../../foundation/idempotency';
import {
  REPORT_PROMPT_VERSION,
  REPORT_SCHEMA_VERSION,
  SCORING_RUBRIC_VERSION,
} from './agent/core/guardrails';
export interface EvaluationTask {
  turn_id: string;
  task_id: string | null;
  result: InterviewEvaluation | null;
  task_status: string | null;
  attempts: number | null;
  max_attempts: number | null;
  error_code: string | null;
}
export function taskSettled(task: {
  task_status: string | null;
  attempts: number | null;
  max_attempts: number | null;
  error_code: string | null;
}) {
  return (
    task.task_status === null ||
    task.task_status === 'cancelled' ||
    task.task_status === 'succeeded' ||
    (task.task_status === 'failed' &&
      ((task.attempts ?? 0) >= (task.max_attempts ?? 0) ||
        task.error_code === 'unsupported_task_type'))
  );
}
export const evaluationDigest = (values: InterviewEvaluation[]) =>
  inputDigest([...values].sort((a, b) => a.turn_id.localeCompare(b.turn_id)));
const keys: DimensionKey[] = [
  'technical_knowledge',
  'project_communication',
  'coding_ability',
  'logical_expression',
];
export function emptyReport(
  state: {
    view: Interview;
    snapshot?: InterviewSnapshot | null;
    answerSources?: InterviewReport['answer_sources'];
  },
  id: string,
): InterviewReport {
  const answered = state.view.turns.some((t) => t.answer_status === 'answered');
  const dimension = (explanation: string): InterviewReport['dimensions']['coding_ability'] => ({
    status: 'not_observed',
    score: null,
    evidence_refs: [],
    explanation,
  });
  return {
    id,
    answer_sources: state.answerSources ?? [],
    interview_id: state.view.id,
    version: 1,
    task_ids: [],
    status: answered ? 'pending' : 'ready',
    summary_status: answered ? 'pending' : 'not_applicable',
    summary: null,
    analysis_metadata: {
      model: state.snapshot?.model ?? 'unknown',
      prompt_version: REPORT_PROMPT_VERSION,
      rubric_version: state.snapshot?.rubric_version ?? 'unknown',
      schema_version: REPORT_SCHEMA_VERSION,
      input_mode: 'text_fallback',
    },
    scoring_status: 'uncalibrated',
    overall_score: null,
    dimensions: {
      technical_knowledge: dimension('本维度尚无可用观察证据。'),
      project_communication: dimension('本维度尚无可用观察证据。'),
      logical_expression: dimension('本维度尚无可用观察证据。'),
      coding_ability: dimension('本场未进行代码考核。'),
    },
    evaluations: [],
    missing_turn_ids: [],
    is_partial:
      state.view.status === 'failed' ||
      ['user_finished', 'hard_deadline'].includes(state.view.end_reason ?? ''),
    coverage: answered
      ? '文字作答；未校准数值评分。经历内容来自用户当场陈述。'
      : '没有有效回答，仅保存面试记录，不进行能力评估。',
  };
}

type ReportState = Parameters<typeof emptyReport>[0];
type AnsweredTurn = Interview['turns'][number];

function collectEvaluations(answered: AnsweredTurn[], tasks: EvaluationTask[]) {
  let failed = 0;
  let pending = 0;
  const values: InterviewEvaluation[] = [];
  const missing: string[] = [];
  for (const turn of answered) {
    const task = tasks.find((item) => item.turn_id === turn.id);
    if (task?.result?.revision === turn.revision) values.push(task.result);
    else if (!task || taskSettled(task)) {
      failed++;
      missing.push(turn.id);
    } else pending++;
  }
  return { values, missing, failed, pending };
}

function applyDimensionEvidence(report: InterviewReport, values: InterviewEvaluation[]) {
  for (const key of keys.filter((item) => item !== 'coding_ability')) {
    const observed = values.filter((value) => value.dimensions.includes(key));
    const refs = observed.flatMap((value) =>
      [...value.strengths, ...value.gaps].flatMap((finding) => finding.evidence_refs),
    );
    const unique = [...new Map(refs.map((ref) => [JSON.stringify(ref), ref])).values()];
    if (unique.length)
      report.dimensions[key] = {
        status: 'observed',
        score: null,
        evidence_refs: unique,
        explanation: `已从 ${observed.length} 个回答回合获得本维度的文字证据；评分将在整场总结完成后生成；仅评价已作答内容。`,
      };
  }
}

function applySummaryDimensionScores(report: InterviewReport) {
  for (const assessment of report.summary?.dimension_assessments ?? []) {
    const dimension = report.dimensions[assessment.dimension];
    // Historical summaries remain unscored; never turn an unobserved dimension into a zero.
    if (dimension.status !== 'observed') continue;
    const valid =
      assessment.evidence_refs.length &&
      assessment.evidence_refs.every((ref) =>
        dimension.evidence_refs.some(
          (value) =>
            value.turn_id === ref.turn_id &&
            value.revision === ref.revision &&
            value.quote === ref.quote,
        ),
      );
    if (
      !valid ||
      !Number.isInteger(assessment.level) ||
      assessment.level < 0 ||
      assessment.level > 4
    )
      continue;
    dimension.score = assessment.level * 25;
    dimension.explanation = assessment.text;
    dimension.evidence_refs = assessment.evidence_refs;
  }
}

function applyIndicatorScores(
  report: InterviewReport,
  state: ReportState,
  barsValues: InterviewEvaluation[],
  answeredCount: number,
) {
  if (
    !barsValues.length ||
    state.view.configuration.job !== 'frontend' ||
    state.view.configuration.career_stage !== 'internship'
  )
    return;
  const indicators = aggregateIndicatorScores(barsValues);
  // Never mix a historical holistic score with the new per-indicator standard.
  for (const key of keys.filter((item) => item !== 'coding_ability')) {
    const selected = indicators.filter((indicator) => indicator.dimension === key);
    report.dimensions[key] = selected.length
      ? {
          status: 'observed',
          score: Math.round(selected.reduce((sum, item) => sum + item.score, 0) / selected.length),
          evidence_refs: [
            ...new Map(
              selected
                .flatMap((item) => item.evidence_refs)
                .map((ref) => [JSON.stringify(ref), ref]),
            ).values(),
          ],
          explanation:
            selected
              .map(
                (item) =>
                  `${item.title} ${Math.round(item.score)} 分（${item.observations} 次观察）`,
              )
              .join('；') + '。先按指标聚合，再对本维度已观察指标等权平均。',
        }
      : {
          status: 'not_observed',
          score: null,
          evidence_refs: [],
          explanation: '本标准下尚无可评分指标；未问到或证据不足不计为零分。',
        };
  }
  report.analysis_metadata = {
    ...(report.analysis_metadata ?? emptyReport(state, report.id).analysis_metadata!),
    scoring_rubric_version: FRONTEND_RUBRIC_VERSION,
  };
  report.coverage += ` 行为锚定标准覆盖 ${barsValues.length}/${answeredCount} 个有效回答；标准为草案，尚未人工校准。`;
}

function applyLegacyOverallScore(report: InterviewReport, hasIndicatorScores: boolean) {
  const scored = Object.values(report.dimensions).flatMap((dimension) =>
    dimension.score === null ? [] : [dimension.score],
  );
  if (scored.length) {
    report.overall_score = Math.round(
      scored.reduce((sum, score) => sum + score, 0) / scored.length,
    );
    report.scoring_status = 'experimental';
    if (report.analysis_metadata)
      report.analysis_metadata = {
        ...report.analysis_metadata,
        scoring_rubric_version: hasIndicatorScores
          ? FRONTEND_RUBRIC_VERSION
          : SCORING_RUBRIC_VERSION,
      };
  }
  if (report.summary?.feedback_template) {
    report.overall_score = feedbackScore(report.summary.feedback_template).score;
    report.scoring_status = 'experimental';
  }
}

function questionScoringVersion(values: InterviewEvaluation[]) {
  if (values.some((value) => value.question_scoring_version === EVIDENCE_SCORING_VERSION))
    return EVIDENCE_SCORING_VERSION;
  if (values.some((value) => value.question_scoring_version === HR_SCORING_VERSION))
    return HR_SCORING_VERSION;
  return QUESTION_SCORING_VERSION;
}

function completedQuestionGroups(answered: AnsweredTurn[], values: InterviewEvaluation[]) {
  return new Set(
    answered
      .filter(
        (turn) =>
          !answered.some(
            (other) =>
              other.main_question_index === turn.main_question_index &&
              other.follow_up_index > turn.follow_up_index,
          ),
      )
      .filter((turn) =>
        values.some(
          (value) =>
            value.turn_id === turn.id &&
            value.revision === turn.revision &&
            isQuestionScoringVersion(value.question_scoring_version),
        ),
      )
      .map((turn) => turn.main_question_index),
  ).size;
}

function questionOverallScore(
  report: InterviewReport,
  scope: { wholeSession: boolean; complete: boolean; practice: boolean; hr: boolean },
) {
  const assessments = report.feedback_assessments!;
  if (scope.wholeSession) return Math.round(weightedQuestionScore(assessments));
  if (!scope.complete || !report.question_scores?.length) return null;
  if (scope.practice) return Math.round(report.question_scores[0].score);
  if (scope.hr) return Math.round(weightedObservedScore(assessments)!);
  if (completeSixScores(assessments)) return Math.round(weightedQuestionScore(assessments));
  return null;
}

function isWholeInterview(
  scope: { scoped: boolean; hr: boolean; practice: boolean; complete: boolean },
  progress: { answered: AnsweredTurn[]; failed: number; pending: number },
) {
  return (
    scope.scoped &&
    !scope.hr &&
    !scope.practice &&
    scope.complete &&
    progress.answered.length > 0 &&
    !progress.pending &&
    !progress.failed
  );
}

function applyQuestionScoring(
  report: InterviewReport,
  state: ReportState,
  values: InterviewEvaluation[],
  progress: { answered: AnsweredTurn[]; failed: number; pending: number },
) {
  if (!values.some((value) => isQuestionScoringVersion(value.question_scoring_version))) return;
  report.question_scoring_version = questionScoringVersion(values);
  const scoringValues = values.filter(
    (value) => value.question_scoring_version === report.question_scoring_version,
  );
  report.question_scores = questionScores(state.view.turns, scoringValues);
  const assessments = aggregateQuestionAssessments(report.question_scores);
  const scoped = report.question_scoring_version === EVIDENCE_SCORING_VERSION;
  const hr = scoped
    ? state.view.configuration.interview_type === 'hr'
    : report.question_scoring_version === HR_SCORING_VERSION;
  const practice = Boolean(state.view.parent_interview_id);
  if (scoped)
    report.feedback_observations = aggregateFeedbackObservations(scoringValues, assessments);
  const groupCount = new Set(progress.answered.map((turn) => turn.main_question_index)).size;
  const complete = completedQuestionGroups(progress.answered, scoringValues) === groupCount;
  const wholeSession = isWholeInterview({ scoped, hr, practice, complete }, progress);
  const sessionAssessments = wholeSession ? completeInterviewAssessments(assessments) : assessments;
  report.feedback_assessments = sessionAssessments;
  if (wholeSession && report.analysis_metadata) {
    report.analysis_metadata = {
      ...report.analysis_metadata,
      scoring_rubric_version: WHOLE_INTERVIEW_SCORING_VERSION,
    };
    report.coverage += ' 整场按固定六维评价本场展示，未体现维度计0分；不据此推断未展示的真实能力。';
  }
  report.overall_score = questionOverallScore(report, { wholeSession, complete, practice, hr });
  report.scoring_status = sessionAssessments.length ? 'experimental' : 'uncalibrated';
  if (report.summary && sessionAssessments.length)
    report.summary = {
      ...report.summary,
      feedback_template: { ...report.summary.feedback_template, assessments: sessionAssessments },
    };
}

/** Read-only projection, also used by GET so successful turns are visible before the whole job settles. */
export function aggregateReport(
  state: ReportState,
  base: InterviewReport,
  tasks: EvaluationTask[],
): InterviewReport {
  const report = emptyReport(state, base.id);
  const answered = state.view.turns.filter((turn) => turn.answer_status === 'answered');
  const { values, missing, failed, pending } = collectEvaluations(answered, tasks);
  report.version = base.version;
  report.status = base.status;
  report.analysis_metadata = base.analysis_metadata;
  report.summary_status = base.summary_status ?? 'not_requested';
  report.summary = base.summary ?? null;
  report.advice_task_id = base.advice_task_id;
  report.advice_status = base.advice_status;
  report.next_steps = base.next_steps;
  report.evaluations = values;
  report.task_ids = tasks.flatMap((task) => (task.task_id ? [task.task_id] : []));
  report.analysis_progress = { total: answered.length, completed: values.length, failed, pending };
  report.missing_turn_ids = missing;
  report.is_partial ||= failed > 0 || report.summary_status === 'failed';
  report.coverage += ` 已分析 ${values.length} 题，待处理 ${pending} 题，失败 ${failed} 题。`;
  applyDimensionEvidence(report, values);
  applySummaryDimensionScores(report);
  const barsValues = values.filter(
    (value) => value.scoring_rubric_version === FRONTEND_RUBRIC_VERSION,
  );
  applyIndicatorScores(report, state, barsValues, answered.length);
  applyLegacyOverallScore(report, barsValues.length > 0);
  applyQuestionScoring(report, state, values, { answered, failed, pending });
  return report;
}
