import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildQuestions,
  commitAnswer,
  defaultConfiguration,
  elapsedSeconds,
  finishSession,
  overallScore,
  reportFor,
  sampleSession,
  transitionSession,
  type Session,
} from '@interviewlab/core';
const start = Date.parse('2026-10-19T01:00:00Z');
test('technical, HR and mixed types select different preset questions for the chosen job', () => {
  const config = {
    ...defaultConfiguration('backend'),
    interview_type: 'technical_qa' as const,
    difficulty: '挑战' as const,
  };
  const technical = buildQuestions(config);
  assert.match(technical[0].text, /事务/);
  assert.match(technical[0].text, /替代方案/);
  assert.equal(technical.length, 6);
  const hr = buildQuestions({ ...config, interview_type: 'hr' });
  assert.match(hr[0].text, /简单介绍自己/);
  const mixed = buildQuestions({ ...config, interview_type: 'mixed' });
  assert.ok(mixed.some((q) => q.text.includes('事务')));
  assert.ok(mixed.some((q) => q.text.includes('参与的项目')));
});
function session(): Session {
  const sample = sampleSession();
  return {
    ...sample,
    id: 'test',
    is_sample: false,
    status: 'in_progress',
    turns: [],
    started_at: new Date(start).toISOString(),
    ended_at: undefined,
    report_ready_at: undefined,
  };
}
test('question budgets distinguish main questions and follow-ups', () => {
  const questions = buildQuestions({ ...defaultConfiguration(), interviewer_style: '深入追问' });
  assert.equal(questions.filter((q) => !q.follow_up_index).length, 6);
  assert.ok(questions.every((q) => q.follow_up_index <= 2));
  assert.equal(new Set(questions.map((q) => q.id)).size, questions.length);
});
test('no materials produces general questions without project assumptions', () => {
  const questions = buildQuestions({
    ...defaultConfiguration(),
    focus_experience_ids: [],
    resume_document_id: undefined,
  });
  assert.equal(questions.length, 6);
  assert.ok(!questions[0].text.includes('参与的项目'));
});
test('submitting is idempotent and preserves exact original text', () => {
  const one = commitAnswer(
    session(),
    '我只负责列表页面，与同学协作接口。',
    'answer',
    'sub1',
    start + 1000,
  );
  const two = commitAnswer(one, '不同内容', 'answer', 'sub1', start + 2000);
  assert.equal(two.turns.length, 1);
  assert.equal(two.turns[0].answer_text, '我只负责列表页面，与同学协作接口。');
  assert.equal(two.turns[0].answer_segments[0].source, 'text');
  assert.equal(two.turns[0].input_mode, 'text_fallback');
});
test('blank answer is rejected; skipped question has no answer segment', () => {
  assert.throws(() => commitAnswer(session(), '  ', 'answer', 's', start + 1000));
  const next = commitAnswer(session(), 'discarded', 'skip', 's', start + 1000);
  assert.equal(next.turns[0].answer_text, '');
  assert.deepEqual(next.turns[0].answer_segments, []);
});
test('pause blocks submission and still counts towards the hard cap', () => {
  const paused = transitionSession(session(), 'paused', start + 60000);
  assert.throws(() => commitAnswer(paused, 'text', 'answer', 's', start + 120000));
  assert.equal(elapsedSeconds(paused, start + 720000), 720);
  const ended = transitionSession(paused, 'in_progress', start + 720000);
  assert.equal(ended.status, 'completed');
  assert.equal(ended.turns.length, 0);
});
test('answer arriving at the hard cap is not treated as a completed answer', () => {
  const ended = commitAnswer(session(), 'late answer', 'answer', 's', start + 720000);
  assert.equal(ended.status, 'completed');
  assert.equal(ended.turns.length, 0);
});
test('finish is idempotent and terminal sessions cannot be resumed', () => {
  const ended = finishSession(session(), start + 1000);
  assert.deepEqual(finishSession(ended, start + 2000), ended);
  assert.throws(() => transitionSession(ended, 'in_progress', start + 2000));
});
test('unobserved dimensions are null and do not count as zero', () => {
  const report = reportFor(sampleSession());
  assert.equal(report.dimensions.coding_ability.score, null);
  assert.equal(report.dimensions.coding_ability.status, 'not_observed');
  assert.equal(report.overall_score, 81);
  const dimensions = structuredClone(report.dimensions);
  dimensions.technical_knowledge.score = 79;
  dimensions.project_communication.score = 80;
  dimensions.logical_expression.status = 'not_observed';
  dimensions.logical_expression.score = null;
  assert.equal(overallScore(dimensions), 80);
});
test('user demonstration answers never receive fabricated scores', () => {
  const answered = commitAnswer(session(), '我的合成回答', 'answer', 's', start + 1000);
  const ended = finishSession(answered, start + 2000);
  const report = reportFor(ended, start + 5000);
  assert.equal(report.overall_score, null);
  assert.ok(
    Object.values(report.dimensions).every((d) => d.status === 'not_observed' && d.score === null),
  );
  assert.equal(report.status, 'ready');
});
test('zero answers produce no score and report generation is independent of session completion', () => {
  const ended = finishSession(session(), start + 1000);
  assert.equal(ended.status, 'completed');
  assert.equal(reportFor(ended, start + 1100).status, 'generating');
  assert.equal(reportFor(ended, start + 5000).overall_score, null);
  assert.match(reportFor(ended, start + 5000).coverage, /没有/);
});
test('sample evidence quotes exist verbatim in the referenced revision', () => {
  const sample = sampleSession();
  const report = reportFor(sample);
  for (const d of Object.values(report.dimensions)) {
    for (const ref of d.evidence_refs) {
      const turn = sample.turns.find((t) => t.id === ref.turn_id);
      assert.equal(turn?.revision, ref.revision);
      assert.ok(turn?.answer_text.includes(ref.quote));
    }
  }
});
