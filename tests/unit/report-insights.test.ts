import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { completeInterviewAssessments, type InterviewReport } from '@interviewlab/core';
import { ReportInsights } from '../../code/frontend/features/live-interview/report-insights';
import { QuestionCoverage } from '../../code/frontend/features/live-interview/report-charts';

(globalThis as typeof globalThis & { React: typeof React }).React = React;

test('report overview presents conclusions and acceptance checks without disclosures, repeated quotes or score tables', () => {
  const ref = { turn_id: 'original', revision: 2, quote: '我验证了错误恢复。' };
  const report = {
    evaluations: [],
    feedback_assessments: completeInterviewAssessments([]),
    next_steps: ['练习错误恢复；验收：保留输入并能重试'],
    summary: {
      overview: { text: '回答有实际验证步骤。', evidence_refs: [ref] },
      strengths: [{ text: '验证了错误恢复', evidence_refs: [ref] }],
      improvements: [
        {
          text: '补充验证结果',
          evidence_refs: [ref],
          turn_id: 'original',
          retry_goal: '记录验证前后差异',
        },
      ],
      feedback_template: { action_plan: [], next_expectation: '对比原回答与重练回答' },
      limitations: ['仅基于本次回答'],
    },
  } as unknown as InterviewReport;
  const html = renderToStaticMarkup(
    React.createElement(ReportInsights, {
      report,
      onSelect: () => {},
    }),
  );
  for (const text of ['本场速览', '优势亮点', '优先提升', '练习建议', '保留输入并能重试'])
    assert.ok(html.includes(text));
  assert.equal((html.match(/<meter /g) ?? []).length, 0);
  assert.ok(!html.includes('评分明细'));
  assert.ok(!html.includes('<table'));
  assert.ok(!html.includes('按模板重新生成后'));
  assert.ok(!html.includes('记录验证前后差异'));
  assert.ok(!html.includes('下次练习的目标'));
  assert.ok(!html.includes('<details'));
  assert.ok(!html.includes(ref.quote));
  assert.ok(html.includes('回答有实际验证步骤。'));
});

test('question visual rows retain a real zero score and distinguish unanswered questions', () => {
  const html = renderToStaticMarkup(
    React.createElement(QuestionCoverage, {
      turns: [
        {
          id: 'one',
          text: '请解释验证思路。',
          main_question_index: 1,
          follow_up_index: 0,
          revision: 1,
          answer_status: 'answered',
        },
        {
          id: 'two',
          text: '请说明改进结果。',
          main_question_index: 2,
          follow_up_index: 0,
          revision: 0,
          answer_status: 'waiting',
        },
      ],
      evaluations: [],
      scores: [
        { turn_id: 'one', main_question_index: 1, turn_ids: ['one'], score: 0, assessments: [] },
      ],
      onSelect: () => {},
    }),
  );
  assert.match(html, /请解释验证思路/);
  assert.match(html, /请说明改进结果/);
  assert.match(html, /未作答/);
  assert.equal((html.match(/<meter /g) ?? []).length, 1);
  assert.match(html, /value="0"/);
});
