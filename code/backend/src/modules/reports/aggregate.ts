import type {
  DimensionKey,
  Interview,
  InterviewReport,
  InterviewSnapshot,
  InterviewEvaluation,
} from '@interviewlab/core';
import { inputDigest } from '../../foundation/idempotency';
import { REPORT_PROMPT_VERSION, REPORT_SCHEMA_VERSION, SCORING_RUBRIC_VERSION } from './analysis';
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
  state: { view: Interview; snapshot?: InterviewSnapshot | null },
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

/** Read-only projection, also used by GET so successful turns are visible before the whole job settles. */
export function aggregateReport(
  state: { view: Interview; snapshot?: InterviewSnapshot | null },
  base: InterviewReport,
  tasks: EvaluationTask[],
): InterviewReport {
  const report = emptyReport(state, base.id);
  const answered = state.view.turns.filter((t) => t.answer_status === 'answered');
  let failed = 0,
    pending = 0;
  const values: InterviewEvaluation[] = [];
  const missing: string[] = [];
  for (const turn of answered) {
    const task = tasks.find((t) => t.turn_id === turn.id);
    if (task?.result?.revision === turn.revision) values.push(task.result);
    else if (!task || taskSettled(task)) {
      failed++;
      missing.push(turn.id);
    } else pending++;
  }
  report.version = base.version;
  report.status = base.status;
  report.analysis_metadata = base.analysis_metadata;
  report.summary_status = base.summary_status ?? 'not_requested';
  report.summary = base.summary ?? null;
  report.evaluations = values;
  report.task_ids = tasks.flatMap((t) => (t.task_id ? [t.task_id] : []));
  report.analysis_progress = { total: answered.length, completed: values.length, failed, pending };
  report.missing_turn_ids = missing;
  report.is_partial ||= failed > 0 || report.summary_status === 'failed';
  report.coverage += ` 已分析 ${values.length} 题，待处理 ${pending} 题，失败 ${failed} 题。`;
  for (const key of keys.filter((k) => k !== 'coding_ability')) {
    const observed = values.filter((v) => v.dimensions.includes(key));
    const refs = observed.flatMap((v) =>
      [...v.strengths, ...v.gaps].flatMap((f) => f.evidence_refs),
    );
    const unique = [...new Map(refs.map((r) => [JSON.stringify(r), r])).values()];
    if (unique.length)
      report.dimensions[key] = {
        status: 'observed',
        score: null,
        evidence_refs: unique,
        explanation: `已从 ${observed.length} 个回答回合获得本维度的文字证据；仅分析已作答内容，暂不评分。`,
      };
  }
  const assessments = report.summary?.dimension_assessments ?? [];
  for (const assessment of assessments) {
    const dimension = report.dimensions[assessment.dimension];
    // Historical summaries remain unscored; never turn an unobserved dimension into a zero.
    if (dimension.status !== 'observed') continue;
    const valid =
      assessment.evidence_refs.length &&
      assessment.evidence_refs.every((r) =>
        dimension.evidence_refs.some(
          (v) => v.turn_id === r.turn_id && v.revision === r.revision && v.quote === r.quote,
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
  const scored = Object.values(report.dimensions).flatMap((d) =>
    d.score === null ? [] : [d.score],
  );
  if (scored.length) {
    report.overall_score = Math.round(
      scored.reduce((sum, score) => sum + score, 0) / scored.length,
    );
    report.scoring_status = 'experimental';
    if (report.analysis_metadata)
      report.analysis_metadata = {
        ...report.analysis_metadata,
        scoring_rubric_version: SCORING_RUBRIC_VERSION,
      };
  }
  return report;
}
