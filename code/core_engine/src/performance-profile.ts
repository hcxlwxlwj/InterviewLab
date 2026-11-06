import type { InterviewReport } from './live-interview';
export function summarizePerformance(reports: InterviewReport[]) {
  const ready = reports.filter((r) => r.status === 'ready' && !r.needs_refresh);
  const rubric =
    ready[0]?.question_scoring_version ??
    ready[0]?.analysis_metadata?.scoring_rubric_version ??
    ready[0]?.analysis_metadata?.rubric_version;
  const comparable = ready.filter(
    (r) =>
      (r.question_scoring_version ??
        r.analysis_metadata?.scoring_rubric_version ??
        r.analysis_metadata?.rubric_version) === rubric,
  );
  const keys = [
    'technical_knowledge',
    'project_communication',
    'logical_expression',
    'coding_ability',
  ] as const;
  const dimensions = keys.map((key) => {
    const values = comparable.flatMap((r) => {
      const d = r.dimensions[key];
      return d?.status === 'observed' &&
        d.score !== null &&
        Number.isFinite(d.score) &&
        d.evidence_refs.length
        ? [{ score: d.score, interview_id: r.interview_id, explanation: d.explanation }]
        : [];
    });
    return {
      key,
      count: values.length,
      score: values.length ? values.reduce((a, b) => a + b.score, 0) / values.length : null,
      sources: values,
    };
  });
  return {
    rubric,
    count: comparable.length,
    excluded: ready.length - comparable.length,
    dimensions,
  };
}
