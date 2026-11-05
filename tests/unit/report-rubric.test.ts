import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import {
  FRONTEND_RUBRIC_VERSION,
  REPORT_INDICATORS,
  REPORT_RUBRIC,
  applicableReportIndicators,
  aggregateIndicatorScores,
  type InterviewEvaluation,
  type InterviewSnapshot,
  type InterviewTurn,
  type ReportIndicatorAssessment,
} from '@interviewlab/core';
import { newInterviewState } from '../../code/backend/src/modules/interviews/repository';
import { assertEvaluation } from '../../code/backend/src/modules/reports/analysis';
import { emptyReport, aggregateReport } from '../../code/backend/src/modules/reports/aggregate';
import { reportSchema, reportRequestBody } from '../../code/backend/src/modules/reports/schemas';
import { reportExportHtml } from '../../code/frontend/features/live-interview/report-export';

function fixture() {
  const state = newInterviewState('synthetic-rubric', {
    job: 'frontend',
    career_stage: 'internship',
    interview_type: 'technical_qa',
    difficulty: '基础',
    duration_minutes: 5,
    interviewer_style: '标准',
    interaction_mode: 'text_fallback',
  });
  const turn: InterviewTurn = {
    id: randomUUID(),
    text: '请介绍学习背景与求职动机。',
    topic: '介绍',
    purpose: '沟通',
    knowledge_question_id: null,
    source_refs: [],
    evidence_refs: [],
    stage: 'introduction',
    main_question_index: 1,
    follow_up_index: 0,
    generation_id: randomUUID(),
    presented_at: null,
    answer_status: 'answered',
    answer_text: '我是软件工程学生。我喜欢做可交互的网页。',
    revision: 1,
    input_mode: 'text_fallback',
    answered_at: null,
  };
  const snapshot: InterviewSnapshot = {
    job_title: '前端实习',
    knowledge: { content_version: 'test', questions: [], sources: [], missing_reason: null },
    prompt_version: 'test',
    rubric_version: 'test',
    model: 'test',
  };
  state.view.turns = [turn];
  state.view.status = 'completed';
  state.view.end_reason = 'completed';
  state.snapshot = snapshot;
  const ref = { turn_id: turn.id, revision: 1, quote: '我是软件工程学生。' };
  const evaluation: InterviewEvaluation = {
    turn_id: turn.id,
    revision: 1,
    strengths: [{ text: '回应背景。', evidence_refs: [ref] }],
    gaps: [],
    reference_points: [],
    retry_goal: '说明岗位动机',
    dimensions: ['logical_expression'],
    limitations: [],
    scoring_rubric_version: FRONTEND_RUBRIC_VERSION,
    indicator_assessments: [
      {
        indicator_id: 'relevance',
        status: 'scored',
        level: 3,
        text: '回应背景与动机。',
        evidence_refs: [ref],
      },
      {
        indicator_id: 'structure',
        status: 'not_observed',
        level: null,
        text: '回答过短，无法判断组织。',
        evidence_refs: [],
      },
    ],
  };
  return { state, turn, snapshot, ref, evaluation };
}
test('standard is a versioned uncalibrated draft with five anchors per indicator and illustrative examples', () => {
  assert.equal(REPORT_RUBRIC.calibration_status, 'not_validated');
  assert.equal(REPORT_INDICATORS.length, 6);
  for (const i of REPORT_INDICATORS) {
    assert.equal(i.anchors.length, 5);
    assert.ok(i.anchors.every((a) => a.length > 10));
    assert.ok(i.example.explanation);
  }
});
test('question applicability prevents introduction/project answers from being scored on unasked professional knowledge or verification', () => {
  const { turn, snapshot } = fixture();
  assert.deepEqual(
    applicableReportIndicators(turn, snapshot).map((i) => i.id),
    ['relevance', 'structure'],
  );
  const project = { ...turn, stage: 'experience' as const, text: '详情页优化你具体负责哪部分？' };
  assert.deepEqual(
    applicableReportIndicators(project, snapshot).map((i) => i.id),
    ['personal_ownership', 'relevance', 'structure'],
  );
  assert.ok(
    applicableReportIndicators({ ...project, text: '你如何验证优化的效果？' }, snapshot).some(
      (i) => i.id === 'verification',
    ),
  );
  assert.ok(
    !applicableReportIndicators(
      { ...turn, stage: 'technical', text: '为什么选择这个方案？' },
      snapshot,
    ).some((i) => i.dimension === 'technical_knowledge'),
  );
});
test('all requested indicators must appear once; unknown indicators, fake evidence, scored-null and not-observed-zero are rejected', () => {
  const { evaluation, turn, snapshot } = fixture();
  assert.doesNotThrow(() => assertEvaluation(evaluation, turn, snapshot));
  for (const change of [
    (e: InterviewEvaluation) => {
      e.indicator_assessments!.pop();
    },
    (e: InterviewEvaluation) => {
      e.indicator_assessments![1] = e.indicator_assessments![0];
    },
    (e: InterviewEvaluation) => {
      e.indicator_assessments![0].indicator_id = 'technical_accuracy';
    },
    (e: InterviewEvaluation) => {
      e.indicator_assessments![0].evidence_refs[0].quote = '虚构原文';
    },
    (e: InterviewEvaluation) => {
      e.indicator_assessments![0].level = null;
    },
    (e: InterviewEvaluation) => {
      e.indicator_assessments![1].level = 0;
    },
    (e: InterviewEvaluation) => {
      delete e.scoring_rubric_version;
    },
  ]) {
    const e = structuredClone(evaluation);
    change(e);
    assert.throws(() => assertEvaluation(e, turn, snapshot));
  }
});
test('repeated follow-ups do not overweight an indicator; legacy scores never mix with BARS', () => {
  const { evaluation, ref } = fixture();
  const rated = (id: ReportIndicatorAssessment['indicator_id'], level: 0 | 1 | 2 | 3 | 4) => ({
    indicator_id: id,
    status: 'scored' as const,
    level,
    text: '合成锚点',
    evidence_refs: [ref],
  });
  const e = (items: ReportIndicatorAssessment[]) => ({
    ...evaluation,
    indicator_assessments: items,
  });
  const scores = aggregateIndicatorScores([
    e([rated('relevance', 4)]),
    e([rated('relevance', 4)]),
    e([rated('structure', 0)]),
    { ...e([rated('structure', 4)]), scoring_rubric_version: undefined },
  ]);
  assert.equal(scores.find((i) => i.id === 'relevance')!.score, 100);
  assert.equal(scores.find((i) => i.id === 'structure')!.score, 0);
  assert.equal(scores.reduce((s, i) => s + i.score, 0) / scores.length, 50);
});
test('BARS scores are available independently of summary, exclude unobserved skills and are carried into PDF export', () => {
  const { state, evaluation, turn } = fixture();
  const base = emptyReport(state, randomUUID());
  base.summary_status = 'failed';
  const report = aggregateReport(state, base, [
    {
      turn_id: turn.id,
      task_id: 'test',
      result: evaluation,
      task_status: 'succeeded',
      attempts: 1,
      max_attempts: 2,
      error_code: null,
    },
  ]);
  assert.equal(report.dimensions.logical_expression.score, 75);
  assert.equal(report.overall_score, 75);
  assert.equal(report.dimensions.coding_ability.score, null);
  assert.equal(report.dimensions.project_communication.score, null);
  assert.equal(report.analysis_metadata!.scoring_rubric_version, FRONTEND_RUBRIC_VERSION);
  assert.equal(report.is_partial, true);
  assert.ok(reportSchema.safeParse(report).success);
  const html = reportExportHtml(state.view, report);
  assert.ok(html.includes(FRONTEND_RUBRIC_VERSION));
  assert.ok(html.includes('切题与范围'));
  assert.ok(html.includes('3 / 4 档'));
});
test('rubric upgrade is explicit and historical reports are never silently converted', () => {
  const { state, evaluation, turn } = fixture();
  delete evaluation.indicator_assessments;
  delete evaluation.scoring_rubric_version;
  const report = aggregateReport(state, emptyReport(state, randomUUID()), [
    {
      turn_id: turn.id,
      task_id: null,
      result: evaluation,
      task_status: 'succeeded',
      attempts: 1,
      max_attempts: 2,
      error_code: null,
    },
  ]);
  assert.equal(report.overall_score, null);
  assert.notEqual(report.analysis_metadata?.scoring_rubric_version, FRONTEND_RUBRIC_VERSION);
  assert.equal(reportRequestBody.safeParse({ version: 1, scope: 'rubric' }).success, false);
});

test('professional indicators require a matching frozen reference and an explicit technical question', async () => {
  const { structuredInterviewKnowledge } = await import(
    '../../code/backend/src/modules/interviews/knowledge'
  );
  const { state, turn, snapshot } = fixture();
  const knowledge = await structuredInterviewKnowledge.read(state.view.configuration);
  const question = knowledge.questions.find((q) => q.report_reference?.cards.length)!;
  assert.ok(question);
  const technical = {
    ...turn,
    stage: 'technical' as const,
    text: '为什么选择这个方案？有哪些取舍？',
    topic: question.topic,
    knowledge_question_id: question.id,
  };
  const indicators = applicableReportIndicators(technical, { ...snapshot, knowledge });
  assert.ok(indicators.some((i) => i.id === 'technical_accuracy'));
  assert.ok(indicators.some((i) => i.id === 'technical_reasoning'));
  assert.ok(!indicators.some((i) => i.id === 'verification'));
  assert.ok(
    !applicableReportIndicators(
      { ...technical, topic: '未覆盖', knowledge_question_id: null },
      { ...snapshot, knowledge },
    ).some((i) => i.dimension === 'technical_knowledge'),
  );
});
