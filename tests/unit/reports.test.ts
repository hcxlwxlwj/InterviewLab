import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type {
  InterviewEvaluation,
  InterviewReportSummary,
  InterviewTurn,
  InterviewSnapshot,
} from '@interviewlab/core';
import { newInterviewState } from '../../code/backend/src/modules/interviews/repository';
import {
  aggregateReport,
  emptyReport,
  evaluationDigest,
  type EvaluationTask,
} from '../../code/backend/src/modules/reports/aggregate';
import { assertSummary, assertEvaluation } from '../../code/backend/src/modules/reports/analysis';
import { reportSchema, reportRequestBody } from '../../code/backend/src/modules/reports/schemas';
import { createInterviewAgent } from '../../code/backend/src/modules/interviews/agent';
import { loadConfig } from '../../code/backend/src/foundation/config';

const snapshot: InterviewSnapshot = {
  job_title: '前端',
  knowledge: { content_version: 'test', questions: [], sources: [], missing_reason: '无专业依据' },
  prompt_version: 'test',
  rubric_version: 'uncalibrated-test',
  model: 'controlled-model',
};
function fixture() {
  const state = newInterviewState('synthetic', {
    job: 'frontend',
    career_stage: 'internship',
    interview_type: 'project_deep_dive',
    difficulty: '基础',
    duration_minutes: 5,
    interviewer_style: '标准',
    interaction_mode: 'text_fallback',
  });
  const turn: InterviewTurn = {
    id: randomUUID(),
    text: '请说明本人工作和验证方式。',
    topic: '职责',
    purpose: '了解本人工作',
    knowledge_question_id: null,
    source_refs: [],
    evidence_refs: [],
    main_question_index: 1,
    follow_up_index: 0,
    generation_id: randomUUID(),
    presented_at: null,
    answer_status: 'answered',
    answer_text: '我负责预约接口。我们完成了系统。',
    revision: 1,
    input_mode: 'text_fallback',
    answered_at: new Date().toISOString(),
    stage: 'experience',
  };
  state.view.turns = [turn];
  state.view.status = 'completed';
  state.view.end_reason = 'completed';
  state.snapshot = snapshot;
  const ref = { turn_id: turn.id, revision: 1, quote: '我负责预约接口。' };
  const gapRef = { ...ref, quote: '我们完成了系统。' };
  const evaluation: InterviewEvaluation = {
    turn_id: turn.id,
    revision: 1,
    strengths: [{ text: '说明了负责的接口。', evidence_refs: [ref] }],
    gaps: [{ text: '尚未说明验证方式。', evidence_refs: [gapRef] }],
    reference_points: ['补充实际做过的验证'],
    retry_goal: '补充本人采用的验证方式',
    dimensions: ['project_communication'],
    limitations: ['仅依据本人陈述'],
  };
  const task: EvaluationTask = {
    turn_id: turn.id,
    task_id: randomUUID(),
    result: evaluation,
    task_status: 'succeeded',
    attempts: 1,
    max_attempts: 2,
    error_code: null,
  };
  const summary: InterviewReportSummary = {
    overview: evaluation.strengths[0],
    strengths: evaluation.strengths,
    improvements: [{ ...evaluation.gaps[0], turn_id: turn.id, retry_goal: evaluation.retry_goal }],
    limitations: [],
  };
  return { state, turn, evaluation, task, summary };
}
test('partial report exposes successful turns, separates pending from terminal failures, and never scores', () => {
  const { state, task } = fixture();
  const second = { ...state.view.turns[0], id: randomUUID(), main_question_index: 2 };
  state.view.turns.push(second);
  const base = emptyReport(state, randomUUID());
  const waiting = { ...task, turn_id: second.id, result: null, task_status: 'failed', attempts: 1 };
  let report = aggregateReport(state, base, [task, waiting]);
  assert.deepEqual(report.analysis_progress, { total: 2, completed: 1, failed: 0, pending: 1 });
  assert.equal(report.evaluations.length, 1);
  assert.equal(report.dimensions.project_communication.status, 'observed');
  assert.equal(report.dimensions.coding_ability.status, 'not_observed');
  assert.ok(Object.values(report.dimensions).every((d) => d.score === null));
  report = aggregateReport(state, base, [task, { ...waiting, attempts: 2 }]);
  assert.deepEqual(report.missing_turn_ids, [second.id]);
  assert.equal(report.is_partial, true);
  assert.equal(report.analysis_progress!.failed, 1);
});
test('a result at another answer revision is not published as current evidence', () => {
  const { state, task } = fixture();
  const report = aggregateReport(state, emptyReport(state, randomUUID()), [
    { ...task, result: { ...task.result!, revision: 2 } },
  ]);
  assert.equal(report.evaluations.length, 0);
  assert.equal(report.analysis_progress!.failed, 1);
});
test('zero-answer and skipped-only interviews have no ability evaluation or summary', () => {
  const { state } = fixture();
  state.view.turns[0].answer_status = 'skipped';
  const report = aggregateReport(state, emptyReport(state, randomUUID()), []);
  assert.equal(report.summary_status, 'not_applicable');
  assert.equal(report.status, 'ready');
  assert.deepEqual(report.analysis_progress, { total: 0, completed: 0, failed: 0, pending: 0 });
  assert.ok(Object.values(report.dimensions).every((d) => d.status === 'not_observed'));
});
test('legacy report schema remains readable and GET projection does not silently request a summary', () => {
  const { state, task } = fixture();
  const report = emptyReport(state, randomUUID());
  delete report.summary_status;
  delete report.summary;
  delete report.analysis_metadata;
  report.status = 'ready';
  assert.ok(reportSchema.safeParse(report).success);
  const projected = aggregateReport(state, report, [task]);
  assert.equal(projected.summary_status, 'not_requested');
  assert.equal(projected.analysis_metadata, undefined);
});
test('summary evidence must originate from checked findings, with exact revision and quote', () => {
  const { summary, evaluation } = fixture();
  assert.doesNotThrow(() => assertSummary(summary, [evaluation]));
  for (const field of ['quote', 'turn_id', 'revision'] as const) {
    const bad = structuredClone(summary);
    if (field === 'revision') bad.overview.evidence_refs[0].revision++;
    else bad.overview.evidence_refs[0][field] = 'fabricated';
    assert.throws(() => assertSummary(bad, [evaluation]));
  }
  const reordered = structuredClone(summary);
  const ref = reordered.overview.evidence_refs[0];
  reordered.overview.evidence_refs[0] = {
    quote: ref.quote,
    revision: ref.revision,
    turn_id: ref.turn_id,
  };
  assert.doesNotThrow(() => assertSummary(reordered, [evaluation]));
});
test('summary cannot turn a gap into a strength or invent a retry goal or unrelated turn', () => {
  const { summary, evaluation } = fixture();
  const badStrength = structuredClone(summary);
  badStrength.strengths = evaluation.gaps;
  assert.throws(() => assertSummary(badStrength, [evaluation]));
  for (const field of ['retry_goal', 'turn_id'] as const) {
    const bad = structuredClone(summary);
    bad.improvements[0][field] = 'invented';
    assert.throws(() => assertSummary(bad, [evaluation]));
  }
  const duplicate = structuredClone(summary);
  duplicate.improvements.push(duplicate.improvements[0]);
  assert.throws(() => assertSummary(duplicate, [evaluation]));
});
test('summary output is bounded, strict, and rejects uncalibrated numeric scores', () => {
  const { summary, evaluation } = fixture();
  const scored = { ...summary, overall_score: 90 };
  assert.throws(() => assertSummary(scored, [evaluation]));
  assert.throws(() =>
    assertSummary({ ...summary, strengths: Array(4).fill(summary.strengths[0]) }, [evaluation]),
  );
});
test('injected evaluations must obey structure, real evidence and the introduction dimension restriction', () => {
  const { evaluation, turn } = fixture();
  assert.doesNotThrow(() => assertEvaluation(evaluation, turn, snapshot));
  assert.throws(() =>
    assertEvaluation({ ...evaluation, gaps: [{ text: 'bad', evidence_refs: [] }] }, turn, snapshot),
  );
  assert.throws(() => assertEvaluation(evaluation, { ...turn, stage: 'introduction' }, snapshot));
});
test('summary failure does not hide checked per-turn results and corrected retry clears the partial flag', () => {
  const { state, task, summary } = fixture();
  const base = emptyReport(state, randomUUID());
  base.summary_status = 'failed';
  base.status = 'ready';
  const partial = aggregateReport(state, base, [task]);
  assert.equal(partial.evaluations.length, 1);
  assert.equal(partial.is_partial, true);
  assert.equal(
    aggregateReport(state, { ...partial, summary, summary_status: 'ready' }, [task]).is_partial,
    false,
  );
});
test('evaluation digest is independent of query order but changes with content or revision', () => {
  const { evaluation } = fixture();
  const second = { ...evaluation, turn_id: randomUUID() };
  assert.equal(evaluationDigest([evaluation, second]), evaluationDigest([second, evaluation]));
  assert.notEqual(
    evaluationDigest([evaluation]),
    evaluationDigest([{ ...evaluation, revision: 2 }]),
  );
});
test('report retry accepts the legacy body and explicit scopes, rejecting unknown commands', () => {
  assert.ok(reportRequestBody.safeParse({ version: 1 }).success);
  assert.ok(reportRequestBody.safeParse({ version: 1, scope: 'summary' }).success);
  assert.equal(reportRequestBody.safeParse({ version: 1, scope: 'all' }).success, false);
});
test('summary uses the shared model adapter with checked evaluations and records its own prompt version', async () => {
  const { summary, evaluation } = fixture();
  const logs: object[] = [];
  const agent = createInterviewAgent(
    loadConfig({ LLM_API_KEY: 'synthetic-only' }),
    async (_url, init) => {
      const body = JSON.parse(init!.body as string);
      const payload = JSON.parse(body.messages[1].content);
      assert.equal(payload.task, 'summarize');
      assert.deepEqual(payload.input.evaluations, [evaluation]);
      assert.equal(body.model, snapshot.model);
      return Response.json({
        choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(summary) } }],
      });
    },
    (entry) => logs.push(entry),
  );
  assert.deepEqual(
    await agent.summarize([evaluation], snapshot, new AbortController().signal, false),
    summary,
  );
  assert.equal((logs[0] as { prompt_version: string }).prompt_version, 'text-review-v1');
});
