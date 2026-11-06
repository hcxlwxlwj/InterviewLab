import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Interview, InterviewReport } from '@interviewlab/core';
import { AnalysisWaiting } from '../../code/frontend/features/live-interview/analysis';
import {
  isReportPending,
  reportDisplayState,
  reportRetryScope,
} from '../../code/frontend/features/live-interview/report-progress';
(globalThis as typeof globalThis & { React: typeof React }).React = React;

function report(overrides: Partial<InterviewReport> = {}): InterviewReport {
  return {
    status: 'ready',
    analysis_progress: { total: 1, completed: 1, failed: 0, pending: 0 },
    missing_turn_ids: [],
    evaluations: [{}],
    summary_status: 'ready',
    summary: {},
    advice_status: 'ready',
    is_partial: false,
    ...overrides,
  } as InterviewReport;
}

test('a ready report row still waits for advice and permits a completed partial interview', () => {
  const pending = report({ advice_status: 'pending' });
  assert.equal(isReportPending(pending), true);
  assert.equal(reportDisplayState(pending), 'pending');
  assert.equal(reportDisplayState(report({ is_partial: true })), 'ready');
  assert.equal(reportDisplayState(report({ advice_status: undefined })), 'ready');
});

test('analysis, summary and advice failures select only the missing stage to retry', () => {
  const analysis = report({
    missing_turn_ids: ['answer'],
    analysis_progress: { total: 2, completed: 1, failed: 1, pending: 0 },
  });
  const summary = report({ summary_status: 'failed', summary: null });
  const advice = report({ advice_status: 'failed' });
  for (const value of [analysis, summary, advice])
    assert.equal(reportDisplayState(value), 'failed');
  assert.equal(reportRetryScope(analysis), 'missing');
  assert.equal(reportRetryScope(summary), 'summary');
  assert.equal(reportRetryScope(advice), 'advice');
  assert.equal(reportDisplayState(report({ summary_status: 'ready', summary: null })), 'failed');
});

test('zero answers, practice and legacy records do not wait forever or regenerate on reads', () => {
  assert.equal(
    reportDisplayState(
      report({
        analysis_progress: { total: 0, completed: 0, failed: 0, pending: 0 },
        evaluations: [],
        summary: null,
        summary_status: 'not_applicable',
        advice_status: undefined,
      }),
    ),
    'empty',
  );
  assert.equal(
    reportDisplayState(report({ summary: null, summary_status: 'not_applicable' })),
    'ready',
  );
  const legacy = report({ summary: null, summary_status: 'not_requested' });
  const before = JSON.stringify(legacy);
  assert.equal(reportDisplayState(legacy), 'unrequested');
  assert.equal(reportRetryScope(legacy), 'summary');
  assert.equal(reportDisplayState(null), 'unrequested');
  assert.equal(reportRetryScope(null), 'missing');
  assert.equal(JSON.stringify(legacy), before);
});

test('ongoing successful work stays in the waiting screen while another stage has failed', () => {
  const value = report({
    missing_turn_ids: ['answer'],
    analysis_progress: { total: 3, completed: 1, failed: 1, pending: 1 },
  });
  assert.equal(reportDisplayState(value), 'pending');
  assert.equal(
    reportDisplayState(report({ status: 'generating', summary_status: 'pending' })),
    'pending',
  );
});

test('the full-screen report gate shows real stages, focused recovery and a zero-answer exit', () => {
  const interview = {
    id: 'synthetic',
    job_title: '前端',
    configuration: { duration_minutes: 10, job: 'frontend' },
  } as Interview;
  const view = (value: InterviewReport | null) =>
    renderToStaticMarkup(
      React.createElement(AnalysisWaiting, {
        id: interview.id,
        interview,
        report: value,
        refresh: () => {},
        onReport: () => {},
      }),
    );
  const pending = view(
    report({
      status: 'generating',
      summary_status: 'pending',
      summary: null,
      advice_status: undefined,
    }),
  );
  assert.match(pending, /role="dialog"/);
  assert.match(pending, /报告分析进度/);
  assert.match(pending, /正在整理本场总结/);
  assert.match(pending, /aria-valuenow="1"/);
  assert.match(pending, /aria-valuemax="3"/);
  assert.ok(!pending.includes('<li'));
  const failed = view(report({ advice_status: 'failed' }));
  assert.match(failed, /重试未完成的分析/);
  assert.match(failed, /view=partial/);
  const empty = view(
    report({
      analysis_progress: { total: 0, completed: 0, failed: 0, pending: 0 },
      evaluations: [],
      summary: null,
      summary_status: 'not_applicable',
      advice_status: undefined,
    }),
  );
  assert.match(empty, /没有提交回答/);
  assert.match(empty, /重新开始练习/);
  assert.match(view(null), /生成完整复盘/);
});
