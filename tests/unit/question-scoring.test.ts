import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FEEDBACK_DIMENSIONS,
  QUESTION_SCORING_VERSION,
  weightedQuestionScore,
  questionScores,
  aggregateQuestionAssessments,
  type InterviewTurn,
  type InterviewEvaluation,
  type InterviewSnapshot,
} from '@interviewlab/core';
import {
  createReportAnalysis,
  assertEvaluation,
} from '../../code/backend/src/modules/reports/analysis';
import { aggregateReport, emptyReport } from '../../code/backend/src/modules/reports/aggregate';
import { newInterviewState } from '../../code/backend/src/modules/interviews/repository';
const snapshot: InterviewSnapshot = {
  job_title: '前端',
  knowledge: { content_version: 'synthetic', questions: [], sources: [], missing_reason: null },
  prompt_version: 'test',
  rubric_version: 'test',
  model: 'test',
};
const turn = (id: string, index = 1, follow = 0): InterviewTurn => ({
  id,
  main_question_index: index,
  follow_up_index: follow,
  text: '如何验证项目？',
  topic: '验证',
  purpose: '验证',
  knowledge_question_id: null,
  source_refs: [],
  evidence_refs: [],
  generation_id: 'test',
  presented_at: null,
  answer_status: 'answered',
  answer_text: '我测试了边界。',
  revision: 1,
  input_mode: 'text_fallback',
  answered_at: null,
});
const ratings = (t: InterviewTurn, score: number) =>
  FEEDBACK_DIMENSIONS.map((d) => ({
    dimension: d.key,
    score,
    text: score ? '说明了行为' : '本次没有体现',
    evidence_refs: score ? [{ turn_id: t.id, revision: 1, quote: t.answer_text! }] : [],
  }));
const evaluation = (t: InterviewTurn, score: number): InterviewEvaluation => ({
  turn_id: t.id,
  revision: 1,
  strengths: [],
  gaps: [],
  reference_points: [],
  retry_goal: '补充测试结果',
  dimensions: [],
  limitations: [],
  question_scoring_version: QUESTION_SCORING_VERSION,
  feedback_assessments: ratings(t, score),
});
const wire = (scores: Record<string, unknown>) => ({
  scores: FEEDBACK_DIMENSIONS.map((d) => {
    const a = scores[d.key] as { score: number; text: string; evidence_ids: string[] } | undefined;
    return a ? [a.score, a.text, a.evidence_ids[0] ?? null] : null;
  }),
  strengths: [],
  gaps: [],
  reference_points: [],
  retry_goal: '补充结果',
});
const zero = () =>
  Object.fromEntries(
    FEEDBACK_DIMENSIONS.map((d) => [d.key, { score: 0, text: '本次未体现', evidence_ids: [] }]),
  );

test('all six dimensions are required; zero is a real score and missing/null are rejected', async () => {
  const t = turn('t');
  const analysis = createReportAnalysis(async (_kind, schema) => {
    for (const invalid of [
      { ...zero(), communication: null },
      Object.fromEntries(Object.entries(zero()).slice(1)),
    ])
      assert.equal(schema.safeParse(wire(invalid)).success, false);
    return schema.parse(wire(zero()));
  });
  const result = await analysis.evaluate(t, snapshot, new AbortController().signal, false);
  assert.equal(result.feedback_assessments?.length, 6);
  assert.equal(weightedQuestionScore(result.feedback_assessments!), 0);
  assert.deepEqual(
    result.feedback_assessments!.map((a) => a.score),
    [0, 0, 0, 0, 0, 0],
  );
});
test('positive scores require genuine source evidence and cannot cite another question', () => {
  const t = turn('t'),
    value = evaluation(t, 80);
  assert.doesNotThrow(() => assertEvaluation(value, t, snapshot));
  value.feedback_assessments![0].evidence_refs = [];
  assert.throws(() => assertEvaluation(value, t, snapshot));
  value.feedback_assessments = ratings(turn('other', 2), 80);
  assert.throws(() => assertEvaluation(value, t, snapshot));
});
test('follow-ups form one cumulative unit; equal question weights and unrounded arithmetic agree', () => {
  const a = turn('a'),
    b = turn('b', 1, 1),
    c = turn('c', 2);
  const questions = questionScores(
    [a, b, c],
    [evaluation(a, 10), evaluation(b, 81), evaluation(c, 60)],
  );
  assert.equal(questions.length, 2);
  assert.equal(questions[0].score, 81);
  assert.deepEqual(questions[0].turn_ids, ['a', 'b']);
  const aggregate = aggregateQuestionAssessments(questions);
  assert.equal(weightedQuestionScore(aggregate), 70.5);
  assert.equal((questions[0].score + questions[1].score) / 2, weightedQuestionScore(aggregate));
  assert.equal(questionScores([a, b], [evaluation(a, 10)]).length, 0);
  assert.equal(questionScores([a], [{ ...evaluation(a, 90), revision: 2 }]).length, 0);
});
test('six-dimensional evidence can reference earlier answers in the same group without using the resume', async () => {
  const earlier = turn('earlier'),
    t = turn('t', 1, 1);
  let input: unknown;
  const analysis = createReportAnalysis(async (_kind, schema, payload) => {
    input = payload;
    return schema.parse(
      wire(
        Object.fromEntries(
          FEEDBACK_DIMENSIONS.map((d) => [
            d.key,
            { score: 75, text: '此前说明测试行为', evidence_ids: ['g0-0'] },
          ]),
        ),
      ),
    );
  });
  const result = await analysis.evaluate(
    t,
    {
      ...snapshot,
      personal_material: {
        id: 'resume',
        kind: 'resume',
        version: 1,
        title: 'private',
        text: 'RESUME_ONLY_MARKER',
        confirmed: true,
        created_at: 'test',
      },
    },
    new AbortController().signal,
    false,
    { main_question: earlier.text, earlier_answers: [], earlier_turns: [earlier] },
  );
  assert.equal(result.feedback_assessments![0].evidence_refs[0].turn_id, earlier.id);
  assert.ok(!JSON.stringify(input).includes('RESUME_ONLY_MARKER'));
});
test('scores remain visible when summary fails and cannot be replaced by summary model scores', () => {
  const t = turn('t'),
    state = newInterviewState('test', {
      job: 'frontend',
      career_stage: 'internship',
      interview_type: 'technical_qa',
      difficulty: '基础',
      duration_minutes: 5,
      interviewer_style: '标准',
      interaction_mode: 'text_fallback',
    });
  state.view.turns = [t];
  state.view.status = 'completed';
  state.snapshot = snapshot;
  const report = aggregateReport(state, { ...emptyReport(state, 'r'), summary_status: 'failed' }, [
    {
      turn_id: t.id,
      task_id: 'task',
      result: evaluation(t, 71),
      task_status: 'succeeded',
      attempts: 1,
      max_attempts: 2,
      error_code: null,
    },
  ]);
  assert.equal(report.overall_score, 71);
  assert.equal(report.feedback_assessments!.length, 6);
  assert.equal(report.is_partial, true);
});
test('advice alone receives the frozen resume and returns no scores', async () => {
  const analysis = createReportAnalysis(async (kind, schema, input) => {
    assert.equal(kind, 'report_advice');
    assert.equal((input as { resume: { text: string } }).resume.text, '合成项目简历');
    assert.equal(
      schema.safeParse({ next_steps: ['围绕项目补充测试结果'], score: 100 }).success,
      false,
    );
    return schema.parse({
      next_steps: [{ action: '围绕项目补充测试结果', acceptance: '记录失败率' }],
    });
  });
  const result = await analysis.suggest(
    [evaluation(turn('t'), 70)],
    {
      ...snapshot,
      personal_material: {
        id: 'r',
        kind: 'resume',
        version: 3,
        title: '简历',
        text: '合成项目简历',
        confirmed: true,
        created_at: 'test',
      },
    },
    new AbortController().signal,
    false,
  );
  assert.equal(result.next_steps.length, 1);
});

test('summary receives computed scores and is not allowed to return a second score set', async () => {
  const t = turn('t'),
    e = evaluation(t, 73);
  e.strengths = [
    {
      text: '说明测试行为',
      evidence_refs: [{ turn_id: t.id, revision: 1, quote: t.answer_text! }],
    },
  ];
  const analysis = createReportAnalysis(async (_kind, schema, input) => {
    assert.equal((input as { computed_scores: { score: number }[] }).computed_scores[0].score, 73);
    const valid = {
      overview: { text: '说明测试行为', evidence_ids: ['e0-s0-0'] },
      strengths: [],
      improvements: [],
      limitations: [],
    };
    assert.equal(
      schema.safeParse({
        ...valid,
        feedback_template: { assessments: [] },
      }).success,
      false,
    );
    return schema.parse(valid);
  });
  const value = await analysis.summarize([e], snapshot, new AbortController().signal, false, {
    turns: [t],
  });
  assert.equal(value.feedback_template.assessments[0].score, 73);
});
