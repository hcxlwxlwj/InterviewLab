'use client';
import Link from 'next/link';
import { useCallback, useEffect } from 'react';
import { FileText } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { Interview, InterviewReport } from '@interviewlab/core';
import { Button } from '../../components/ui/button';
import { Breadcrumb, Footer, Header, Loading } from '../../components/shared';
import { ApiClientError } from '../../lib/api/http';
import { interviewsApi } from '../../lib/api/interviews';
import { CommandNotice, ErrorNotice, SessionGate, useLiveCommand, useLiveResource } from './common';
import { ReportProgress, isReportPending, reportDisplayState } from './report-progress';
import { AnalysisWaiting } from './analysis';
import { ReportOverview } from './report-overview';
import { PracticeReportPage, PracticeResult, type StartReportPractice } from './report-practice';

function revealAnswer(turnId: string) {
  const target = document.getElementById(`turn-${turnId}`);
  if (!target) {
    const id = window.location.pathname.split('/')[2];
    window.location.assign(
      `/reports/${encodeURIComponent(id)}/practice#turn-${encodeURIComponent(turnId)}`,
    );
    return;
  }
  requestAnimationFrame(() => {
    if (target instanceof HTMLDetailsElement) target.open = true;
    const analysis = target.querySelector<HTMLDetailsElement>('details[data-turn-analysis]');
    if (analysis) analysis.open = true;
    target.scrollIntoView({ block: 'start' });
  });
}

function useReportResource(id: string) {
  const load = useCallback(
    async (signal: AbortSignal) => {
      const originalInterview = await interviewsApi.read(id, signal);
      let report: InterviewReport | null = null;
      if (['completed', 'failed'].includes(originalInterview.status)) {
        try {
          report = await interviewsApi.report(id, signal);
        } catch (error) {
          if (!(error instanceof ApiClientError && error.status === 404)) throw error;
        }
      }
      return { interview: originalInterview, originalInterview, report };
    },
    [id],
  );
  return useLiveResource(load, (value) => Boolean(value.report && isReportPending(value.report)), {
    retryReadErrors: true,
  });
}

function usePracticeAnchor(practice: boolean, data: ReturnType<typeof useReportResource>['value']) {
  useEffect(() => {
    if (!practice || !data) return;
    const hash = window.location.hash.slice(1);
    if (hash.startsWith('turn-')) revealAnswer(decodeURIComponent(hash.slice(5)));
  }, [practice, data?.report?.version, Boolean(data)]);
}

function needsReportAnalysis(
  interview: Interview,
  report: InterviewReport | null,
  partial: boolean,
) {
  if (!['completed', 'failed'].includes(interview.status)) return false;
  const display = reportDisplayState(report);
  return display === 'pending' || (!partial && !['ready', 'empty'].includes(display));
}

function useReportActions(id: string, resource: ReturnType<typeof useReportResource>) {
  const router = useRouter();
  const command = useLiveCommand(() => void resource.refresh());
  const refresh = () => void resource.refresh();
  const acceptReport = (report: InterviewReport) => {
    if (resource.value) resource.accept({ ...resource.value, report });
  };
  const version = resource.value?.report?.version ?? 1;
  const requestReport = (scope?: 'missing' | 'summary') =>
    command.run((key) => interviewsApi.retryReport(id, version, key, scope), acceptReport);
  const retryScore = () =>
    command.run((key) => interviewsApi.retryReport(id, version, key), refresh);
  const startPractice: StartReportPractice = (originalId, input) =>
    command.run(
      (key) => interviewsApi.retry(originalId, input, key),
      (result) => router.push(`/interview/${result.id}`),
    );
  return { command, refresh, acceptReport, requestReport, retryScore, startPractice };
}

export function EmptyReport({ interview }: { interview: Interview }) {
  return (
    <section className="workspace-empty-state">
      <span className="workspace-empty-symbol">
        <FileText size={40} />
      </span>
      <h1>本场面试已结束</h1>
      <p>本次没有提交回答，面试记录已保存，无需等待分析，也不会生成能力评分。</p>
      <div className="row-actions">
        <Button asChild>
          <Link href={`/interview/setup?job=${encodeURIComponent(interview.configuration.job)}`}>
            重新开始练习
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/me/interviews">返回面试记录</Link>
        </Button>
      </div>
    </section>
  );
}

export function MissingReport({
  interview,
  busy,
  request,
  notice,
}: {
  interview: Interview;
  busy: boolean;
  request: () => void;
  notice: React.ReactNode;
}) {
  const finalized = ['completed', 'failed'].includes(interview.status);
  return (
    <section className="panel">
      <h2>{finalized ? '面试记录已保存' : '面试尚未结束'}</h2>
      <p>
        {finalized
          ? '尚未生成复盘，你可以基于本场已保存的回答请求分析。'
          : '结束后再提供复盘，进行中不展示参考答案或评价。'}
      </p>
      {notice}
      {finalized ? (
        <button className="live-button" disabled={busy} onClick={request}>
          生成文字复盘
        </button>
      ) : (
        <Link className="live-button" href={`/interview/${interview.id}`}>
          返回面试
        </Link>
      )}
    </section>
  );
}

function ReportBody({ id, practice = false }: { id: string; practice?: boolean }) {
  const partialView = useSearchParams().get('view') === 'partial';
  const resource = useReportResource(id);
  const data = resource.value;
  usePracticeAnchor(practice, data);
  const actions = useReportActions(id, resource);
  const { command, refresh, acceptReport, requestReport } = actions;
  if (!data)
    return (
      <>
        <ErrorNotice message={resource.error} retry={refresh} />
        {!resource.error && <Loading />}
      </>
    );
  const { interview, report } = data;
  const displayState = reportDisplayState(report);
  if (needsReportAnalysis(interview, report, partialView)) {
    return (
      <AnalysisWaiting
        id={id}
        interview={interview}
        report={report}
        error={resource.error}
        refreshing={resource.refreshing}
        refresh={refresh}
        onReport={acceptReport}
      />
    );
  }
  if (displayState === 'empty') return <EmptyReport interview={interview} />;
  const notice = <CommandNotice command={command} refresh={refresh} />;
  if (!report)
    return (
      <MissingReport
        interview={interview}
        busy={command.blocked}
        notice={notice}
        request={() => requestReport()}
      />
    );
  return (
    <ReportResults
      id={id}
      practice={practice}
      interview={interview}
      report={report}
      resource={resource}
      actions={actions}
    />
  );
}

type ReportResultsProps = {
  id: string;
  practice: boolean;
  interview: Interview;
  report: InterviewReport;
  resource: ReturnType<typeof useReportResource>;
  actions: ReturnType<typeof useReportActions>;
};

function ReportResults({ id, practice, interview, report, resource, actions }: ReportResultsProps) {
  const { command, refresh, requestReport, retryScore, startPractice } = actions;
  const notice = <CommandNotice command={command} refresh={refresh} />;
  if (interview.parent_interview_id)
    return (
      <PracticeResult
        interview={interview}
        report={report}
        busy={command.blocked}
        startPractice={startPractice}
        notice={<CommandNotice command={command} />}
        retryScore={retryScore}
      />
    );
  if (practice)
    return (
      <PracticeReportPage
        id={id}
        interview={interview}
        report={report}
        busy={command.blocked}
        startPractice={startPractice}
        onSelect={revealAnswer}
        notice={notice}
      />
    );
  return (
    <ReportOverview
      interview={interview}
      report={report}
      busy={command.blocked}
      onRetrySummary={() => requestReport('summary')}
      onSelect={revealAnswer}
    >
      <ErrorNotice message={resource.error} retry={refresh} />
      {notice}
      <ReportProgress
        report={report}
        refreshing={resource.refreshing}
        refresh={refresh}
        busy={command.blocked}
        retry={() =>
          requestReport(
            report.missing_turn_ids.length || report.status === 'failed' ? 'missing' : 'summary',
          )
        }
      />
    </ReportOverview>
  );
}

export default function LiveReport({ id, practice = false }: { id: string; practice?: boolean }) {
  return (
    <>
      <Header />
      <main className="container page-body real-report-page" id="main-content">
        <Breadcrumb items={['我的面试', practice ? '逐题复盘与重练' : '分析报告']} />
        <SessionGate>
          <ReportBody key={`${id}:${practice}`} id={id} practice={practice} />
        </SessionGate>
      </main>
      <Footer />
    </>
  );
}
