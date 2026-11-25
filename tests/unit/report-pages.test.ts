import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  EVIDENCE_SCORING_VERSION,
  FEEDBACK_DIMENSIONS,
  FEEDBACK_TEMPLATE_VERSION,
  type Interview,
  type InterviewEvaluation,
  type InterviewReport,
  type InterviewTurn,
} from '@interviewlab/core';
import { EmptyReport, MissingReport } from '../../code/frontend/features/live-interview/report';
import {
  ReportOverview,
  ReportSummary,
} from '../../code/frontend/features/live-interview/report-overview';
import {
  PracticeReportPage,
  PracticeResult,
  PracticeReportTurn,
} from '../../code/frontend/features/live-interview/report-practice';

(globalThis as typeof globalThis & { React: typeof React }).React = React;
const noop = () => {};

function turn(overrides: Partial<InterviewTurn> = {}): InterviewTurn {
  return {
    id: 'main',
    text: '请说明验证方法。',
    answer_text: '我验证了 <script> 边界。',
    answer_status: 'answered',
    revision: 2,
    main_question_index: 1,
    follow_up_index: 0,
    ...overrides,
  } as InterviewTurn;
}

function evaluation(overrides: Partial<InterviewEvaluation> = {}): InterviewEvaluation {
  return {
    turn_id: 'main',
    revision: 2,
    strengths: [{ text: '当前版本的验证说明', evidence_refs: [] }],
    gaps: [],
    reference_points: [],
    retry_goal: '补充验证结果',
    dimensions: [],
    limitations: [],
    ...overrides,
  };
}

function report(overrides: Partial<InterviewReport> = {}): InterviewReport {
  return {
    version: 1,
    status: 'ready',
    evaluations: [],
    missing_turn_ids: [],
    question_scores: [],
    summary: null,
    summary_status: 'not_applicable',
    analysis_progress: { total: 1, completed: 1, failed: 0, pending: 0 },
    advice_status: 'ready',
    overall_score: null,
    ...overrides,
  } as InterviewReport;
}

function interview(overrides: Partial<Interview> = {}): Interview {
  return {
    id: 'practice',
    parent_interview_id: 'original',
    parent_turn_id: 'main',
    parent_revision: 2,
    retry_goal: null,
    status: 'completed',
    configuration: { job: 'frontend' },
    turns: [turn()],
    ...overrides,
  } as Interview;
}

test('report summary keeps terminal failures, explicit legacy generation and unavailable evidence distinct', () => {
  const cases: [Partial<InterviewReport>, RegExp, boolean][] = [
    [{ summary_status: 'failed' }, /整场总结生成失败/, true],
    [{ summary_status: undefined }, /整场总结尚未生成/, true],
    [{ summary_status: 'not_applicable' }, /没有足够的评价证据/, false],
    [{ summary_status: 'pending' }, /逐题分析完成后整理整场总结/, false],
  ];
  for (const [state, message, retryable] of cases) {
    const html = renderToStaticMarkup(
      React.createElement(ReportSummary, {
        report: report({ evaluations: [evaluation()], ...state }),
        busy: true,
        onRetry: noop,
        onSelect: noop,
      }),
    );
    assert.match(html, message);
    assert.equal(html.includes('<button'), retryable);
    if (retryable) assert.match(html, /disabled=""/);
    assert.ok(!html.includes('本题得分'));
  }
});

test('single-question results retain pending, failed, current unscorable and historical score states', () => {
  const cases: [Partial<InterviewReport>, RegExp][] = [
    [{ status: 'generating' }, /本题评分生成中/],
    [{ status: 'failed' }, /本题评分失败，回答已保留/],
    [{ question_scoring_version: EVIDENCE_SCORING_VERSION }, /本次回答暂无能力评分/],
    [{ question_scoring_version: undefined }, /历史练习没有本版评分/],
  ];
  for (const [state, message] of cases) {
    const html = renderToStaticMarkup(
      React.createElement(PracticeResult, {
        interview: interview(),
        report: report(state),
        busy: true,
        retryScore: noop,
        startPractice: noop,
        notice: null,
      }),
    );
    assert.match(html, message);
    assert.match(html, /href="\/reports\/original\/practice"/);
    assert.match(html, /我验证了 &lt;script&gt; 边界/);
    assert.ok(!html.includes('<script>'));
    assert.ok(!html.includes('本题得分'));
    assert.match(html, /disabled=""/);
  }
});

test('question review keeps a genuine zero, binds feedback to its revision and avoids duplicate follow-up practice', () => {
  const value = report({
    evaluations: [
      evaluation({ revision: 1, strengths: [{ text: '过期的评价', evidence_refs: [] }] }),
    ],
    missing_turn_ids: ['main'],
    question_scores: [
      {
        turn_id: 'main',
        turn_ids: ['main', 'follow-up'],
        main_question_index: 1,
        score: 0,
        assessments: [],
      },
    ],
  });
  const main = renderToStaticMarkup(
    React.createElement(PracticeReportTurn, {
      id: 'original',
      turn: turn(),
      report: value,
      busy: true,
      startPractice: noop,
    }),
  );
  assert.match(main, /本题得分 <strong>0 \/ 100/);
  assert.match(main, /本题分析生成失败，原回答已保留/);
  assert.ok(!main.includes('过期的评价'));
  assert.match(main, /disabled=""/);
  const followUp = renderToStaticMarkup(
    React.createElement(PracticeReportTurn, {
      id: 'original',
      turn: turn({ id: 'follow-up', follow_up_index: 1 }),
      report: value,
      busy: false,
      startPractice: noop,
    }),
  );
  assert.ok(!followUp.includes('question-scorecard'));
  assert.ok(!followUp.includes('重练这一题'));
  const skipped = renderToStaticMarkup(
    React.createElement(PracticeReportTurn, {
      id: 'original',
      turn: turn({ answer_status: 'skipped' }),
      report: value,
      busy: false,
      startPractice: noop,
    }),
  );
  assert.match(skipped, /已跳过这道题/);
  assert.ok(!skipped.includes('data-turn-analysis'));
  assert.ok(!skipped.includes('重练这一题'));
});

test('missing and zero-answer reports preserve saved-record exits without exposing evaluation during an interview', () => {
  const active = renderToStaticMarkup(
    React.createElement(MissingReport, {
      interview: interview({ status: 'in_progress' }),
      busy: false,
      request: noop,
      notice: null,
    }),
  );
  assert.match(active, /面试尚未结束/);
  assert.ok(!active.includes('生成文字复盘'));
  const saved = renderToStaticMarkup(
    React.createElement(MissingReport, {
      interview: interview(),
      busy: true,
      request: noop,
      notice: null,
    }),
  );
  assert.match(saved, /面试记录已保存/);
  assert.match(saved, /disabled=""/);
  const empty = renderToStaticMarkup(React.createElement(EmptyReport, { interview: interview() }));
  assert.match(empty, /不会生成能力评分/);
  assert.match(empty, /href="\/me\/interviews"/);
  assert.ok(!empty.includes('正在生成'));
});

test('complete report pages preserve real zero scores, insufficient evidence and report actions', () => {
  const assessments = FEEDBACK_DIMENSIONS.map(({ key }) => ({
    dimension: key,
    score: 0,
    text: '回答未提供可评分依据',
    evidence_refs: [],
  }));
  const completed = report({
    overall_score: 0,
    feedback_assessments: assessments,
    summary_status: 'ready',
    summary: {
      overview: { text: '需要补充实际验证结果。', evidence_refs: [] },
      strengths: [],
      improvements: [],
      limitations: [],
      feedback_template: {
        version: FEEDBACK_TEMPLATE_VERSION,
        assessments,
        action_plan: [],
        next_expectation: '保留可核对的实际回答',
      },
    },
    question_scores: [
      { turn_id: 'main', turn_ids: ['main'], main_question_index: 1, score: 0, assessments },
    ],
  });
  const cases: [InterviewReport, boolean, RegExp][] = [
    [completed, true, /需要补充实际验证结果/],
    [report(), false, /没有足够的评价证据/],
    [
      report({ status: 'generating', summary_status: 'pending' }),
      false,
      /逐题分析完成后整理整场总结/,
    ],
  ];
  for (const [value, scored, message] of cases) {
    const html = renderToStaticMarkup(
      React.createElement(ReportOverview, {
        interview: interview({ id: 'original', job_title: '前端实习', parent_interview_id: null }),
        report: value,
        busy: false,
        onRetrySummary: noop,
        onSelect: noop,
        children: React.createElement('p', { role: 'alert' }, '读取失败后保留已保存结果'),
      }),
    );
    assert.match(html, /面试分析报告/);
    assert.match(html, /前端实习/);
    assert.match(html, /读取失败后保留已保存结果/);
    assert.match(html, /href="\/reports\/original\/practice"/);
    assert.match(html, /导出报告/);
    assert.match(html, /未经人工校准/);
    assert.match(html, message);
    assert.equal(html.includes('能力雷达图'), scored);
    if (scored) {
      assert.match(html, /aria-label="综合得分：0"/);
      assert.match(html, /第1题 0 分/);
      assert.ok(!html.includes('本场回答不足以形成综合评分'));
    } else {
      assert.match(html, /本场回答不足以形成综合评分/);
      assert.ok(!html.includes('aria-label="综合得分：0"'));
    }
  }
});

test('whole practice pages retain question navigation, current answer feedback and bounded retry actions', () => {
  const turns = [
    turn(),
    turn({ id: 'follow-up', follow_up_index: 1 }),
    turn({ id: 'second', main_question_index: 2, text: '请补充验证结果。' }),
    turn({ id: 'skipped', main_question_index: 3, answer_status: 'skipped' }),
    turn({ id: 'waiting', main_question_index: 4, answer_status: 'waiting' }),
  ];
  for (const pending of [true, false]) {
    const value = report({
      status: pending ? 'generating' : 'ready',
      evaluations: [
        evaluation(),
        evaluation({
          turn_id: 'follow-up',
          revision: 1,
          strengths: [{ text: '已过期追问评价', evidence_refs: [] }],
        }),
      ],
      missing_turn_ids: pending ? [] : ['second'],
      question_scores: [
        {
          turn_id: 'main',
          turn_ids: ['main', 'follow-up'],
          main_question_index: 1,
          score: 0,
          assessments: [],
        },
      ],
    });
    const html = renderToStaticMarkup(
      React.createElement(PracticeReportPage, {
        id: 'original',
        interview: interview({ turns }),
        report: value,
        busy: pending,
        startPractice: noop,
        onSelect: noop,
        notice: React.createElement('p', { role: 'alert' }, '上次操作结果尚未确认'),
      }),
    );
    assert.match(html, /逐题复盘与重练/);
    assert.match(html, /上次操作结果尚未确认/);
    assert.match(html, /href="\/reports\/original"/);
    assert.match(html, /href="\/interview\/setup\?job=frontend"/);
    const navigation =
      html.match(/<nav[^>]*aria-label="按主问题浏览"[^>]*>(.*?)<\/nav>/s)?.[1] ?? '';
    for (const id of ['main', 'second', 'skipped', 'waiting'])
      assert.ok(navigation.includes(`#turn-${id}`));
    assert.ok(!navigation.includes('#turn-follow-up'));
    assert.match(html, /当前版本的验证说明/);
    assert.match(html, /补充验证结果/);
    assert.ok(!html.includes('已过期追问评价'));
    assert.match(html, /我验证了 &lt;script&gt; 边界/);
    assert.equal((html.match(/class="question-scorecard"/g) ?? []).length, 1);
    assert.equal((html.match(/重练这一题/g) ?? []).length, 2);
    assert.equal(
      (html.match(/class="live-button secondary" disabled=""/g) ?? []).length,
      pending ? 2 : 0,
    );
    assert.match(html, /已跳过这道题/);
    assert.match(html, /这道题未提交回答/);
    assert.match(html, pending ? /本题分析正在生成/ : /本题分析生成失败，原回答已保留/);
  }
});

test('scored practice results keep genuine zero and saved answers when personalized advice fails', () => {
  const html = renderToStaticMarkup(
    React.createElement(PracticeResult, {
      interview: interview(),
      busy: false,
      retryScore: noop,
      startPractice: noop,
      notice: null,
      report: report({
        question_scoring_version: EVIDENCE_SCORING_VERSION,
        evaluations: [evaluation()],
        advice_status: 'failed',
        question_scores: [
          {
            turn_id: 'main',
            turn_ids: ['main'],
            main_question_index: 1,
            score: 0,
            assessments: [],
          },
        ],
        practice_history: [
          {
            interview_id: 'original',
            original_turn_id: 'main',
            ended_at: null,
            scoring_version: EVIDENCE_SCORING_VERSION,
            score: 40,
            assessments: [],
            status: 'ready',
          },
          {
            interview_id: 'practice',
            original_turn_id: 'main',
            ended_at: null,
            scoring_version: EVIDENCE_SCORING_VERSION,
            score: 0,
            assessments: [],
            status: 'ready',
          },
        ],
      }),
    }),
  );
  assert.match(html, /本题得分 <strong>0 \/ 100/);
  assert.match(html, /当前版本的验证说明/);
  assert.match(html, /补充验证结果/);
  assert.match(html, /个性化建议暂不可用，本题评分已保留/);
  assert.match(html, /我验证了 &lt;script&gt; 边界/);
  assert.match(html, /本题练习记录/);
  assert.match(html, /比上次 -40 分/);
  assert.match(html, /再次重练本题/);
  assert.ok(!html.includes('历史练习没有本版评分'));
});
