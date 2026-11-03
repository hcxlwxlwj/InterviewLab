'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, LoaderCircle, RefreshCw } from 'lucide-react';
import type { InterviewReport } from '@interviewlab/core';

export function isReportPending(report: InterviewReport) {
  return (
    ['pending', 'generating'].includes(report.status) ||
    (report.analysis_progress?.pending ?? 0) > 0 ||
    ['pending', 'generating'].includes(report.summary_status ?? '')
  );
}

export function ReportProgress({
  report,
  refreshing,
  refresh,
  retry,
  busy,
}: {
  report: InterviewReport;
  refreshing: boolean;
  refresh: () => void;
  retry: () => void;
  busy: boolean;
}) {
  const pending = isReportPending(report);
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (!pending) return;
    setSeconds(0);
    const started = Date.now();
    const timer = setInterval(() => setSeconds(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [pending, report.version]);
  const p = report.analysis_progress;
  const total = p?.total ?? report.evaluations.length;
  const completed = p?.completed ?? report.evaluations.length;
  const failed = p?.failed ?? report.missing_turn_ids.length;
  const summaryReady = report.summary_status === 'ready';
  const needsRetry =
    !pending && (failed > 0 || report.summary_status === 'failed' || report.status === 'failed');
  if (!pending && !needsRetry) return null;
  const stage = pending
    ? p?.pending
      ? '正在逐题分析回答'
      : '正在整理六维评分与反馈建议'
    : '部分报告未能生成';
  return (
    <section className="panel report-generation" aria-label="报告生成进度">
      <div className="report-generation-heading">
        <div>
          <h2>
            {pending ? <LoaderCircle className="report-spinner" size={20} /> : null}
            {stage}
          </h2>
          <p role="status">
            回答已保存 · 已分析 {completed} / {total} 题
            {failed > 0 ? ` · ${failed} 题分析失败` : ''}。
            {pending
              ? '完成的逐题复盘可先在“面试详情”中查看，页面会自动更新。'
              : '成功结果和原回答仍保留，可以重试缺失部分。'}
          </p>
        </div>
        <button className="report-refresh" onClick={refresh} disabled={refreshing}>
          <RefreshCw size={15} />
          {refreshing ? '正在刷新…' : '刷新进度'}
        </button>
      </div>
      <ol className="report-generation-steps">
        <li data-done="true">
          <CheckCircle2 size={17} />
          回答已保存
        </li>
        <li data-done={completed + failed >= total}>
          <span>2</span>逐题分析 {completed}/{total}
        </li>
        <li data-done={summaryReady}>
          <span>3</span>六维反馈{summaryReady ? '已完成' : '整理中'}
        </li>
      </ol>
      <progress
        max={total + 1}
        value={completed + (summaryReady ? 1 : 0)}
        aria-label="报告分析完成进度"
      />
      {pending && (
        <p className="report-generation-time">
          本页已等待 {seconds} 秒。
          {seconds >= 30
            ? '模型响应较慢，仍在处理中；无需重复提交，可以稍后从面试记录返回。'
            : '分析需要一些时间，你可以先查看已完成的题目。'}
        </p>
      )}
      {needsRetry && (
        <button className="live-button" disabled={busy} onClick={retry}>
          重试未完成的分析
        </button>
      )}
    </section>
  );
}
