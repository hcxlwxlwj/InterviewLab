'use client';

import Link from 'next/link';
import { useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { liveInterviewPath, type Interview, type InterviewReport } from '@interviewlab/core';
import { Button } from '../../components/ui/button';
import { ApiClientError } from '../../lib/api/http';
import { interviewsApi } from '../../lib/api/interviews';
import { SessionGate, useLiveCommand, useLiveResource } from './common';
import { reportDisplayState, reportRetryScope, type ReportDisplayState } from './report-progress';
import { analysisPresentation } from './analysis-state';
import { TransitionScreen } from './transition-screen';

interface AnalysisWaitingProps {
  id: string;
  interview: Interview | null;
  report: InterviewReport | null;
  error?: string;
  refreshing?: boolean;
  refresh: () => void;
  onReport: (report: InterviewReport) => void;
}

interface AnalysisActionProps extends Omit<AnalysisWaitingProps, 'onReport'> {
  state: ReportDisplayState;
  command: ReturnType<typeof useLiveCommand>;
  retry: () => void;
}

function AnalysisRetryAction({
  interview,
  error,
  refreshing,
  refresh,
  state,
  command,
  retry,
}: AnalysisActionProps) {
  if (command.unresolved)
    return (
      <Button onClick={command.retry} disabled={command.busy}>
        确认并重试原操作
      </Button>
    );
  if (error)
    return (
      <Button onClick={refresh} disabled={refreshing}>
        重新连接
      </Button>
    );
  if (!interview || !['failed', 'unrequested'].includes(state)) return null;
  const label = command.busy
    ? '正在恢复分析…'
    : state === 'unrequested'
      ? '生成完整复盘'
      : '重试未完成的分析';
  return (
    <Button onClick={retry} disabled={command.blocked}>
      {label}
    </Button>
  );
}

function AnalysisActions(props: AnalysisActionProps) {
  const { id, interview, report, state } = props;
  const empty = state === 'empty';
  const partial = ['failed', 'empty', 'unrequested'].includes(state) && interview && report;
  return (
    <div className="transition-actions">
      <AnalysisRetryAction {...props} />
      {partial && (
        <Button variant="outline" asChild>
          <Link href={`/reports/${id}?view=partial`}>
            {empty ? '查看本场记录' : '查看已完成结果'}
          </Link>
        </Button>
      )}
      {empty && (
        <Button asChild>
          <Link
            href={`/interview/setup?job=${encodeURIComponent(interview?.configuration.job ?? 'frontend')}`}
          >
            重新开始练习
          </Link>
        </Button>
      )}
      <Button variant="ghost" asChild>
        <Link href="/me/interviews">稍后查看</Link>
      </Button>
    </div>
  );
}

export function AnalysisWaiting({
  id,
  interview,
  report,
  error = '',
  refreshing = false,
  refresh,
  onReport,
}: AnalysisWaitingProps) {
  const command = useLiveCommand(refresh);
  const { state, ...presentation } = analysisPresentation(interview, report);
  const retry = () =>
    command.run(
      (key) => interviewsApi.retryReport(id, report?.version ?? 1, key, reportRetryScope(report)),
      onReport,
    );
  return (
    <TransitionScreen
      kind="analysis"
      {...presentation}
      error={
        command.error ||
        error ||
        (state === 'failed' ? '成功结果和原回答均已保存。重试只处理未完成的部分。' : undefined)
      }
    >
      <AnalysisActions
        id={id}
        interview={interview}
        report={report}
        error={error}
        refreshing={refreshing}
        refresh={refresh}
        state={state}
        command={command}
        retry={retry}
      />
    </TransitionScreen>
  );
}

function AnalysisBody({ id }: { id: string }) {
  const router = useRouter();
  const load = useCallback(
    async (signal: AbortSignal) => {
      const interview = await interviewsApi.read(id, signal);
      let report: InterviewReport | null = null;
      if (['completed', 'failed'].includes(interview.status)) {
        try {
          report = await interviewsApi.report(id, signal);
        } catch (error) {
          if (!(error instanceof ApiClientError && error.status === 404)) throw error;
        }
      }
      return { interview, report };
    },
    [id],
  );
  const resource = useLiveResource(
    load,
    (value) => reportDisplayState(value.report) === 'pending',
    { retryReadErrors: true },
  );
  const data = resource.value;
  useEffect(() => {
    if (!data) return;
    if (!['completed', 'failed'].includes(data.interview.status))
      router.replace(liveInterviewPath(data.interview));
    else if (['ready', 'empty'].includes(reportDisplayState(data.report)))
      router.replace(`/reports/${id}`);
  }, [data, id, router]);
  return (
    <AnalysisWaiting
      id={id}
      interview={data?.interview ?? null}
      report={data?.report ?? null}
      error={resource.error}
      refreshing={resource.refreshing}
      refresh={() => void resource.refresh()}
      onReport={(report) => {
        if (data) resource.accept({ ...data, report });
      }}
    />
  );
}

export default function LiveAnalysis({ id }: { id: string }) {
  return (
    <SessionGate>
      <AnalysisBody id={id} />
    </SessionGate>
  );
}
