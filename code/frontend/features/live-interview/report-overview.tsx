'use client';
import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { FileText, Info } from 'lucide-react';
import {
  feedbackScore,
  reportFeedback,
  type Interview,
  type InterviewReport,
} from '@interviewlab/core';
import { Button } from '../../components/ui/button';
import { AbilityRadar, TotalScore, QuestionCoverage } from './report-charts';
import { isReportPending } from './report-progress';
import { printReport } from './report-export';
import { ReportInsights } from './report-insights';

function ReportHeading({ interview, report }: { interview: Interview; report: InterviewReport }) {
  const id = interview.id;
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  return (
    <>
      <div className="page-heading report-page-heading">
        <div>
          <h1>面试分析报告</h1>
          <p>{interview.job_title} · 本场面试分析报告</p>
        </div>
        <div className="page-actions">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/reports/${id}/practice`}>逐题复盘</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/me/interviews">
              <FileText size={14} />
              查看记录
            </Link>
          </Button>
          <Button
            variant="default"
            size="sm"
            disabled={exporting}
            onClick={async () => {
              setExporting(true);
              setExportError('');
              try {
                await printReport(interview, report);
              } catch {
                setExportError('无法打开打印预览，请重试并检查浏览器打印设置。');
              } finally {
                setExporting(false);
              }
            }}
          >
            {exporting ? '正在准备…' : '导出报告'}
          </Button>
          <TotalScore
            score={report.overall_score}
            coverage={feedbackScore(reportFeedback(report)).coverage}
          />
        </div>
      </div>
      {exportError && <p role="alert">{exportError}</p>}
    </>
  );
}

function summaryMessage(report: InterviewReport) {
  if (report.summary_status === 'failed') return '整场总结生成失败，已完成的逐题复盘仍可查看。';
  if (report.summary_status === 'not_requested' || !report.summary_status)
    return '整场总结尚未生成。';
  if (report.summary_status === 'not_applicable')
    return '本次没有足够的评价证据生成整场总结，可查看原回答和逐题分析。';
  if (report.status === 'failed') return '暂无成功的逐题分析，请先重试缺失分析。';
  return '逐题分析完成后整理整场总结，可以先查看下面已完成的题目。';
}

export function ReportSummary({
  report,
  busy,
  onRetry,
  onSelect,
}: {
  report: InterviewReport;
  busy: boolean;
  onRetry: () => void;
  onSelect: (turnId: string) => void;
}) {
  const reportPending = isReportPending(report);
  return (
    <section className={report.summary ? 'report-summary-modules' : 'panel'} aria-label="整场总结">
      {report.summary ? (
        <ReportInsights report={report} onSelect={onSelect} />
      ) : (
        <p role="status">{summaryMessage(report)}</p>
      )}
      {!reportPending &&
        report.evaluations.length > 0 &&
        !report.summary &&
        ['failed', 'not_requested', undefined].includes(report.summary_status) && (
          <button className="live-button" disabled={busy} onClick={onRetry}>
            {report.summary_status === 'failed' ? '重试整场总结' : '生成整场总结'}
          </button>
        )}
    </section>
  );
}

export function ReportOverview({
  interview,
  report,
  busy,
  onRetrySummary,
  onSelect,
  children,
}: {
  interview: Interview;
  report: InterviewReport;
  busy: boolean;
  onRetrySummary: () => void;
  onSelect: (turnId: string) => void;
  children: ReactNode;
}) {
  const id = interview.id;
  const reportPending = isReportPending(report);
  return (
    <>
      <ReportHeading interview={interview} report={report} />
      <div className="report-banner">
        <div>
          <Info size={16} />
          <span>基于本场回答的 AI 辅助复盘，参考评分未经人工校准，不代表招聘结论。</span>
        </div>
      </div>
      {children}
      <div className="report-grid">
        <div className="report-stack">
          {!!reportFeedback(report)?.assessments.length && (
            <div className="report-visual-row">
              <section className="panel score-panel" aria-label="六维能力画像">
                <h2>能力画像</h2>
                <AbilityRadar
                  feedback={report.summary}
                  assessments={report.feedback_assessments}
                  pending={reportPending}
                />
              </section>
              <QuestionCoverage
                turns={interview.turns}
                evaluations={report.evaluations}
                scores={report.question_scores}
                pending={reportPending}
                failedIds={report.missing_turn_ids}
                onSelect={onSelect}
              />
            </div>
          )}
          {(report.summary ||
            (report.analysis_progress?.total ?? report.evaluations.length) > 0) && (
            <ReportSummary
              report={report}
              busy={busy}
              onRetry={onRetrySummary}
              onSelect={onSelect}
            />
          )}
        </div>
      </div>
      <Link
        id="interview-details-trigger"
        className="report-details-action"
        href={`/reports/${id}/practice`}
      >
        <FileText size={18} /> 逐题复盘与重练
      </Link>
    </>
  );
}
