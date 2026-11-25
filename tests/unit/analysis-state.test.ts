import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Interview, InterviewReport } from '@interviewlab/core';
import { analysisPresentation } from '../../code/frontend/features/live-interview/analysis-state';
import { AnalysisWaiting } from '../../code/frontend/features/live-interview/analysis';

(globalThis as typeof globalThis & { React: typeof React }).React = React;

const interview = {
  id: 'synthetic',
  job_title: '前端',
  configuration: { duration_minutes: 10, job: 'frontend' },
} as Interview;

function report(overrides: Partial<InterviewReport> = {}): InterviewReport {
  return {
    status: 'ready',
    analysis_progress: { total: 1, completed: 1, failed: 0, pending: 0 },
    missing_turn_ids: [],
    evaluations: [{}],
    summary_status: 'ready',
    summary: {},
    advice_status: 'ready',
    ...overrides,
  } as InterviewReport;
}

test('partial analysis keeps actual progress and stage failure while other work continues', () => {
  const view = analysisPresentation(
    interview,
    report({
      analysis_progress: { total: 3, completed: 1, failed: 1, pending: 1 },
      missing_turn_ids: ['answer'],
    }),
  );
  assert.equal(view.state, 'pending');
  assert.equal(view.description, '正在分析回答 · 1 / 3');
  assert.equal(view.detail, '已分析 1 / 3 份回答，部分分析需要重试');
  assert.deepEqual(view.progress, { value: 3, max: 5 });
  assert.deepEqual(view.steps.map((step) => step.state), ['done', 'error', 'done', 'done']);
});

test('legacy reports keep completed stages without an advice task and empty records show no scoring', () => {
  const legacy = analysisPresentation(
    interview,
    report({ analysis_progress: undefined, advice_status: undefined }),
  );
  assert.equal(legacy.state, 'ready');
  assert.deepEqual(legacy.progress, { value: 3, max: 3 });
  assert.deepEqual(legacy.steps.map((step) => step.state), ['done', 'done', 'done', 'done']);

  const empty = analysisPresentation(
    interview,
    report({
      analysis_progress: { total: 0, completed: 0, failed: 0, pending: 0 },
      evaluations: [],
      summary: null,
      summary_status: 'not_applicable',
      advice_status: undefined,
    }),
  );
  assert.equal(empty.state, 'empty');
  assert.equal(empty.detail, '没有回答时不会生成能力评分');
  assert.deepEqual(empty.progress, { value: 1, max: 1 });
});

test('a read error offers reconnect before requesting another report and retains saved-result navigation', () => {
  const html = renderToStaticMarkup(
    React.createElement(AnalysisWaiting, {
      id: interview.id,
      interview,
      report: report({ advice_status: 'failed' }),
      error: '连接暂时中断',
      refresh: () => {},
      onReport: () => {},
    }),
  );
  assert.match(html, /重新连接/);
  assert.doesNotMatch(html, /重试未完成的分析/);
  assert.match(html, /view=partial/);
  assert.match(html, /连接暂时中断/);
});
