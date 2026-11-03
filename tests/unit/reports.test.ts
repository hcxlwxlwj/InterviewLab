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
      assert.equal(payload.input.evaluations[0].turn_id, evaluation.turn_id);
      assert.deepEqual(
        payload.input.evidence_catalog['e0-s0-0'],
        evaluation.strengths[0].evidence_refs[0],
      );
      assert.equal(body.model, snapshot.model);
      return Response.json({
        choices: [
          {
            finish_reason: 'stop',
            message: {
              content: JSON.stringify({
                overview: { text: summary.overview.text, evidence_ids: ['e0-s0-0'] },
                strengths: [{ text: summary.strengths[0].text, evidence_ids: ['e0-s0-0'] }],
                improvements: [
                  {
                    text: summary.improvements[0].text,
                    evidence_ids: ['e0-g0-0'],
                    turn_id: evaluation.turn_id,
                  },
                ],
                dimension_assessments: {
                  technical_knowledge: null,
                  project_communication: { level: 2, text: '基本回应但验证不足。' },
                  logical_expression: null,
                },
                limitations: [],
              }),
            },
          },
        ],
      });
    },
    (entry) => logs.push(entry),
  );
  assert.deepEqual(
    await agent.summarize([evaluation], snapshot, new AbortController().signal, false),
    {
      ...summary,
      dimension_assessments: [
        {
          dimension: 'project_communication',
          level: 2,
          text: '基本回应但验证不足。',
          evidence_refs: [
            evaluation.strengths[0].evidence_refs[0],
            evaluation.gaps[0].evidence_refs[0],
          ],
        },
      ],
    },
  );
  assert.equal((logs[0] as { prompt_version: string }).prompt_version, 'text-review-v6');
});

test('AI reference scores use explicit evidence levels and equal-weight averaging, excluding unobserved skills', () => {
  const { state, task, summary } = fixture();
  task.result!.dimensions = ['project_communication', 'logical_expression'];
  summary.dimension_assessments = [
    { ...summary.overview, dimension: 'project_communication', level: 3 },
    { ...summary.overview, dimension: 'logical_expression', level: 2 },
  ];
  assert.doesNotThrow(() => assertSummary(summary, [task.result!]));
  const report = aggregateReport(
    state,
    { ...emptyReport(state, randomUUID()), summary, summary_status: 'ready' },
    [task],
  );
  assert.equal(report.dimensions.project_communication.score, 75);
  assert.equal(report.dimensions.logical_expression.score, 50);
  assert.equal(report.overall_score, 63);
  assert.equal(report.scoring_status, 'experimental');
  assert.equal(report.dimensions.technical_knowledge.score, null);
  assert.equal(report.dimensions.coding_ability.score, null);
});

test('dimension scores reject unrelated evidence, duplicates and unobserved dimensions', () => {
  const { summary, evaluation } = fixture();
  summary.dimension_assessments = [
    { ...summary.overview, dimension: 'technical_knowledge', level: 4 },
  ];
  assert.throws(() => assertSummary(summary, [evaluation]));
  summary.dimension_assessments = [
    { ...summary.overview, dimension: 'project_communication', level: 3 },
  ];
  summary.dimension_assessments.push(summary.dimension_assessments[0]);
  assert.throws(() => assertSummary(summary, [evaluation]));
});

test('frontend report references cover catalog questions without guessing unknown topics', async () => {
  const { localInterviewKnowledge } = await import(
    '../../code/backend/src/modules/interviews/knowledge'
  );
  const { withFrontendReportReference } = await import(
    '../../code/backend/src/modules/interviews/frontend-reference'
  );
  const state = fixture().state;
  const knowledge = await localInterviewKnowledge.read(state.view.configuration);
  assert.equal(knowledge.questions.length, 8);
  for (const question of knowledge.questions) {
    assert.equal(question.report_reference?.version, 'frontend-report-reference-v1');
    assert.equal(question.report_reference?.review_state, 'draft');
    assert.ok(question.report_reference?.cards.length);
    assert.ok(question.report_reference?.cards.every((c) => c.source_urls.length));
  }
  const unknown = {
    ...knowledge.questions[0],
    topic: '未覆盖的专业主题',
    report_reference: undefined,
  };
  assert.equal(withFrontendReportReference(unknown).report_reference, undefined);
});

test('report analysis sends frozen professional reference to the model', async () => {
  const { createReportAnalysis } = await import('../../code/backend/src/modules/reports/analysis');
  const { localInterviewKnowledge } = await import(
    '../../code/backend/src/modules/interviews/knowledge'
  );
  const { state, turn, evaluation } = fixture();
  const knowledge = await localInterviewKnowledge.read(state.view.configuration);
  turn.knowledge_question_id = knowledge.questions[0].id;
  turn.topic = knowledge.questions[0].topic;
  let received: unknown;
  const analysis = createReportAnalysis(async (_kind, schema, input) => {
    received = input;
    return schema.parse({
      ...evaluation,
      strengths: evaluation.strengths.map((f) => ({
        ...f,
        evidence_refs: f.evidence_refs.map((r) => ({ ...r, quote: 'q0' })),
      })),
      gaps: evaluation.gaps.map((f) => ({
        ...f,
        evidence_refs: f.evidence_refs.map((r) => ({ ...r, quote: 'q1' })),
      })),
    });
  });
  await analysis.evaluate(turn, { ...snapshot, knowledge }, new AbortController().signal, false);
  const input = received as {
    observation_points: { report_reference?: { version: string } }[];
    instructions: string;
  };
  assert.equal(
    input.observation_points[0].report_reference?.version,
    'frontend-report-reference-v1',
  );
  assert.ok(input.instructions.includes('未经专家审核'));
});

test('summary merges repeated practice targets for one turn while retaining checked evidence and scores', async () => {
  const { createReportAnalysis } = await import('../../code/backend/src/modules/reports/analysis');
  const { evaluation } = fixture();
  const analysis = createReportAnalysis(async (_kind, schema) =>
    schema.parse({
      overview: { text: '说明职责，验证待补充。', evidence_ids: ['e0-s0-0'] },
      strengths: [{ text: '职责清楚。', evidence_ids: ['e0-s0-0'] }],
      improvements: [1, 2].map(() => ({
        text: '补充验证。',
        turn_id: evaluation.turn_id,
        evidence_ids: ['e0-g0-0'],
      })),
      dimension_assessments: {
        technical_knowledge: null,
        project_communication: { level: 2, text: '验证不足。' },
        logical_expression: null,
      },
      limitations: ['仅依据本人陈述'],
    }),
  );
  const value = await analysis.summarize(
    [evaluation],
    snapshot,
    new AbortController().signal,
    false,
  );
  assert.equal(value.improvements.length, 1);
  assert.equal(value.improvements[0].retry_goal, evaluation.retry_goal);
  assert.equal(value.dimension_assessments![0].level, 2);
  assert.doesNotThrow(() => assertSummary(value, [evaluation]));
});

test('evaluation quotes must be exact source spans, including punctuation and revision', async () => {
  const { createReportAnalysis } = await import('../../code/backend/src/modules/reports/analysis');
  const { turn, evaluation } = fixture();
  const analysis = createReportAnalysis(async (_kind, schema) => {
    assert.equal(
      schema.safeParse({
        ...evaluation,
        strengths: [
          {
            text: '职责',
            evidence_refs: [
              { ...evaluation.strengths[0].evidence_refs[0], quote: '我主要负责接口' },
            ],
          },
        ],
      }).success,
      false,
    );
    return schema.parse({
      ...evaluation,
      strengths: evaluation.strengths.map((f) => ({
        ...f,
        evidence_refs: f.evidence_refs.map((r) => ({ ...r, quote: 'q0' })),
      })),
      gaps: evaluation.gaps.map((f) => ({
        ...f,
        evidence_refs: f.evidence_refs.map((r) => ({ ...r, quote: 'q1' })),
      })),
    });
  });
  assert.deepEqual(
    await analysis.evaluate(turn, snapshot, new AbortController().signal, false),
    evaluation,
  );
});

test('PDF print snapshot includes partial state, scores, full answers and safely escapes user/model markup', async () => {
  const { reportExportHtml } = await import(
    '../../code/frontend/features/live-interview/report-export'
  );
  const { state, task, summary } = fixture();
  summary.dimension_assessments = [
    { ...summary.overview, dimension: 'project_communication', level: 3 },
  ];
  const report = aggregateReport(
    state,
    { ...emptyReport(state, randomUUID()), summary, summary_status: 'ready' },
    [task],
  );
  state.view.job_title = '<script>alert(1)</script>';
  state.view.turns[0].answer_text = '<img src=x onerror=alert(2)> & 回答';
  report.is_partial = true;
  const html = reportExportHtml(state.view, report);
  assert.ok(html.includes('75 / 100'));
  assert.ok(html.includes('部分复盘'));
  assert.ok(html.includes('未观察'));
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(html.includes('&lt;img src=x onerror=alert(2)&gt; &amp; 回答'));
  assert.ok(!html.includes('<script>'));
  assert.ok(!html.includes('<img'));
});

test('six-dimension template uses the scoring sheet weights and normalizes observed weights without filling missing dimensions with zero', async () => {
  const { FEEDBACK_DIMENSIONS, FEEDBACK_TEMPLATE_VERSION, feedbackScore } = await import(
    '@interviewlab/core'
  );
  const { summary, evaluation } = fixture();
  assert.deepEqual(
    FEEDBACK_DIMENSIONS.map((d) => d.weight),
    [25, 25, 25, 15, 5, 5],
  );
  const template: import('@interviewlab/core').FeedbackTemplate = {
    version: FEEDBACK_TEMPLATE_VERSION,
    assessments: FEEDBACK_DIMENSIONS.map((d, i) => ({
      dimension: d.key,
      score: [80, 80, 60, 100, 80, 100][i],
      text: '依据具体行为',
      evidence_refs: evaluation.strengths[0].evidence_refs,
    })),
    action_plan: [],
    next_expectation: '下次明确个人职责与验证方式',
  };
  assert.deepEqual(feedbackScore(template), { coverage: 100, score: 79 });
  template.assessments[0] = {
    ...template.assessments[0],
    score: null,
    evidence_refs: [],
  };
  assert.deepEqual(feedbackScore(template), { coverage: 75, score: 79 });
  summary.feedback_template = template;
  assert.doesNotThrow(() => assertSummary(summary, [evaluation]));
  assert.ok(
    reportSchema.safeParse({ ...emptyReport(fixture().state, randomUUID()), summary }).success,
  );
  const fabricated = structuredClone(summary);
  fabricated.feedback_template!.assessments[1].evidence_refs[0].quote = '没有这段话';
  assert.throws(() => assertSummary(fabricated, [evaluation]));
  const duplicate = structuredClone(summary);
  duplicate.feedback_template!.assessments[5] = duplicate.feedback_template!.assessments[4];
  assert.throws(() => assertSummary(duplicate, [evaluation]));
  const missingEvidence = structuredClone(summary);
  missingEvidence.feedback_template!.assessments[2].evidence_refs = [];
  assert.throws(() => assertSummary(missingEvidence, [evaluation]));
  const inventedAction = structuredClone(summary);
  inventedAction.feedback_template!.action_plan.push({
    horizon: 'short_term',
    turn_id: 'unrelated',
    action: '补充验证',
    acceptance: '说明验证步骤',
  });
  assert.throws(() => assertSummary(inventedAction, [evaluation]));
});

test('template model scores resolve checked quote IDs and preserve actionable acceptance criteria', async () => {
  const { createReportAnalysis } = await import('../../code/backend/src/modules/reports/analysis');
  const { FEEDBACK_DIMENSIONS, FEEDBACK_TEMPLATE_VERSION } = await import('@interviewlab/core');
  const { evaluation, state, task } = fixture();
  const analysis = createReportAnalysis(async (_kind, schema, input) => {
    assert.deepEqual(
      (input as { feedback_standard: { dimensions: unknown } }).feedback_standard.dimensions,
      FEEDBACK_DIMENSIONS,
    );
    return schema.parse({
      overview: { text: '职责已说明，验证待补充', evidence_ids: ['e0-s0-0'] },
      strengths: [{ text: '说明本人职责', evidence_ids: ['e0-s0-0'] }],
      improvements: [
        { text: '补充验证步骤', turn_id: evaluation.turn_id, evidence_ids: ['e0-g0-0'] },
      ],
      dimension_assessments: {
        technical_knowledge: null,
        project_communication: { level: 2, text: '职责清楚，验证待补充' },
        logical_expression: null,
      },
      feedback_template: {
        version: FEEDBACK_TEMPLATE_VERSION,
        assessments: FEEDBACK_DIMENSIONS.map((d) => ({
          dimension: d.key,
          score: d.key === 'project_reflection' ? 70 : null,
          text: d.key === 'project_reflection' ? '职责清楚，缺验证' : '未问到此维度',
          evidence_ids: d.key === 'project_reflection' ? ['e0-s0-0'] : [],
        })),
        action_plan: [
          {
            horizon: 'short_term',
            turn_id: evaluation.turn_id,
            action: '一周内整理本人执行的验证步骤',
            acceptance: '重练时清楚说明一项检查方法与结果',
          },
        ],
        next_expectation: '下次用具体检查结果支撑项目陈述',
      },
      limitations: [],
    });
  });
  const summary = await analysis.summarize(
    [evaluation],
    snapshot,
    new AbortController().signal,
    false,
  );
  assert.deepEqual(
    summary.feedback_template!.assessments[1].evidence_refs,
    evaluation.strengths[0].evidence_refs,
  );
  assert.equal(
    summary.feedback_template!.action_plan[0].acceptance,
    '重练时清楚说明一项检查方法与结果',
  );
  const report = aggregateReport(
    state,
    { ...emptyReport(state, randomUUID()), summary, summary_status: 'ready' },
    [task],
  );
  assert.equal(report.overall_score, 70);
  assert.ok(reportSchema.safeParse(report).success);
  const { reportExportHtml } = await import(
    '../../code/frontend/features/live-interview/report-export'
  );
  const html = reportExportHtml(state.view, report);
  assert.ok(html.includes('17.5 / 25'));
  assert.ok(html.includes('验收方式'));
  assert.ok(html.includes('六、下一步期待'));
});
