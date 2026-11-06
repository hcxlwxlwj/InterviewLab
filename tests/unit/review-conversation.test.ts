import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { InterviewTurn } from '@interviewlab/core';
import { reviewAdvice } from '../../code/frontend/features/live-interview/review-advice';
import { ReviewConversationTurn } from '../../code/frontend/features/live-interview/review-conversation';
import {
  QuestionScorecard,
  PracticeHistory,
} from '../../code/frontend/features/live-interview/question-scores';
import type { InterviewReport } from '@interviewlab/core';

(globalThis as typeof globalThis & { React: typeof React }).React = React;
const turn = {
  id: 'original-answer',
  text: '你如何验证结果？',
  answer_text: '我检查了正常与异常输入。',
  main_question_index: 2,
  follow_up_index: 0,
  answer_status: 'answered',
  revision: 2,
} as InterviewTurn;
function render(value: InterviewTurn, score?: number) {
  return renderToStaticMarkup(
    React.createElement(ReviewConversationTurn, {
      turn: value,
      score,
      children: React.createElement('p', {}, '本题分析与重练记录'),
    }),
  );
}
test('conversation overview always contains the original question and answer while analysis starts collapsed', () => {
  const html = render(turn, 60);
  assert.ok(html.includes(turn.text));
  assert.ok(html.includes(turn.answer_text!));
  assert.match(html, /id="turn-original-answer"/);
  assert.match(html, /data-turn-analysis/);
  assert.ok(!html.includes(' open=""'));
  assert.match(html, /本题分析与重练记录/);
});
test('a genuine zero score remains distinct from an unanswered or skipped turn', () => {
  assert.match(render(turn, 0), /<strong>0<\/strong>/);
  for (const answer_status of ['waiting', 'skipped'] as const) {
    const html = render({ ...turn, answer_status, answer_text: null });
    assert.ok(html.includes(answer_status === 'waiting' ? '未提交回答' : '已跳过'));
    assert.ok(!html.includes('data-turn-analysis'));
    assert.ok(!html.includes('本题得分'));
  }
});
test('follow-ups retain a separate anchor and are not presented as a new main question', () => {
  const html = render({ ...turn, id: 'follow-up', follow_up_index: 1 });
  assert.match(html, /id="turn-follow-up"/);
  assert.match(html, /追问/);
  assert.match(html, /第2题追问1/);
});

test('related gaps, retry goals and reference points form a single actionable feedback list', () => {
  const value = {
    retry_goal: '补充AI玩法开发的具体实现',
    gaps: [{ text: '没有说明实现细节', evidence_refs: [] }],
    reference_points: ['建议说明AI的具体应用'],
  };
  assert.deepEqual(reviewAdvice(value), ['补充AI玩法开发的具体实现']);
  assert.deepEqual(reviewAdvice({ ...value, retry_goal: '' }), ['没有说明实现细节']);
  assert.deepEqual(
    reviewAdvice({
      retry_goal: '',
      gaps: [],
      reference_points: ['说明验证方法', '说明验证方法', ''],
    }),
    ['说明验证方法'],
  );
});

test('expanded analysis has flat dimension scores without further disclosures or repeated answer quotes', () => {
  const html = renderToStaticMarkup(
    React.createElement(QuestionScorecard, {
      score: 60,
      assessments: [
        {
          dimension: 'communication',
          score: 60,
          text: '内容可辨但细节有限',
          evidence_refs: [{ turn_id: 'one', revision: 1, quote: '重复的回答原文' }],
        },
      ],
    }),
  );
  assert.match(html, /维度表现/);
  assert.match(html, /内容可辨但细节有限/);
  assert.ok(!html.includes('<details'));
  assert.ok(!html.includes('重复的回答原文'));
});

test('practice records remain visible without an empty trend chart; comparable retries produce the real trend', () => {
  const entry = {
    interview_id: 'original',
    original_turn_id: 'one',
    ended_at: '2026-11-06T10:00:00.000Z',
    scoring_version: 'question-evidence-v3',
    score: 60,
    assessments: [],
    status: 'ready',
  };
  const report = {
    question_scoring_version: 'question-evidence-v3',
    practice_history: [entry],
  } as unknown as InterviewReport;
  const renderHistory = (value: InterviewReport) =>
    renderToStaticMarkup(
      React.createElement(PracticeHistory, { report: value, originalId: 'original' }),
    );
  const first = renderHistory(report);
  assert.match(first, /首次回答/);
  assert.match(first, /60分/);
  assert.ok(!first.includes('<svg'));
  assert.ok(!first.includes('<details'));
  const retried = renderHistory({
    ...report,
    practice_history: [
      report.practice_history![0],
      { ...report.practice_history![0], interview_id: 'retry', score: 80 },
    ],
  });
  assert.match(retried, /<svg/);
  assert.match(retried, /第1次重练/);
  assert.match(retried, /80分/);
});
