import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizePerformance, type InterviewReport } from '@interviewlab/core';
function report(score: number | null, status = 'observed', rubric = 'current', evidence = true) {
  return {
    status: 'ready',
    interview_id: 'sample',
    analysis_metadata: { rubric_version: rubric },
    dimensions: {
      technical_knowledge: {
        status,
        score,
        evidence_refs: evidence ? [{ turn_id: 'turn' }] : [],
        explanation: '样例证据',
      },
    },
  } as unknown as InterviewReport;
}
test('performance profile does not turn missing observations into zero or mix rubrics', () => {
  const result = summarizePerformance([
    report(80),
    report(null, 'not_observed'),
    report(20, 'observed', 'old'),
    report(30, 'observed', 'current', false),
  ]);
  assert.equal(result.dimensions[0].score, 80);
  assert.equal(result.dimensions[0].count, 1);
  assert.equal(result.excluded, 1);
  assert.equal(result.dimensions[1].score, null);
});
test('pending and stale reports cannot become performance conclusions', () => {
  const a = report(90);
  a.status = 'pending';
  const b = report(80);
  b.needs_refresh = true;
  assert.equal(summarizePerformance([a, b]).dimensions[0].score, null);
});

test('current six-dimensional reports feed the profile without inventing missing scores', () => {
  const a = report(90),
    b = report(90),
    old = report(90);
  for (const r of [a, b]) {
    r.question_scoring_version = 'whole-interview-six-v1';
    r.feedback_assessments = [
      {
        dimension: 'professional_foundation',
        score: r === a ? 0 : 40,
        text: '本场评分',
        evidence_refs: [],
      },
      {
        dimension: 'communication',
        score: r === a ? 60 : 80,
        text: '表达清晰',
        evidence_refs: [{ turn_id: 'turn', revision: 1, quote: '回答' }],
      },
    ];
  }
  old.question_scoring_version = 'old';
  const unscored = report(null, 'not_observed', 'unscored-newer-report');
  const result = summarizePerformance([unscored, a, b, old]);
  assert.equal(result.dimensions.length, 6);
  assert.equal(result.dimensions.find((d) => d.key === 'professional_foundation')?.score, 20);
  assert.equal(result.dimensions.find((d) => d.key === 'communication')?.score, 70);
  assert.equal(result.dimensions.find((d) => d.key === 'project_reflection')?.score, null);
  assert.equal(result.excluded, 1);
  assert.equal(result.count, 2);
});
