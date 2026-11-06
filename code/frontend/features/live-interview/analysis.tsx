'use client';

import Link from 'next/link';
import { useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { liveInterviewPath, type Interview, type InterviewReport } from '@interviewlab/core';
import { Button } from '../../components/ui/button';
import { ApiClientError } from '../../lib/api/http';
import { interviewsApi } from '../../lib/api/interviews';
import { SessionGate, useLiveCommand, useLiveResource } from './common';
import { reportDisplayState, reportRetryScope } from './report-progress';
import { TransitionScreen } from './transition-screen';

export function AnalysisWaiting({
  id,
  interview,
  report,
  error = '',
  refreshing = false,
  refresh,
  onReport,
}: {
  id: string;
  interview: Interview | null;
  report: InterviewReport | null;
  error?: string;
  refreshing?: boolean;
  refresh: () => void;
  onReport: (report: InterviewReport) => void;
}) {
  const command = useLiveCommand(refresh);
  const state = reportDisplayState(report);
  const p = report?.analysis_progress;
  const total = p?.total ?? report?.evaluations.length ?? 0;
  const completed = p?.completed ?? report?.evaluations.length ?? 0;
  const analysisFailed = (p?.failed ?? report?.missing_turn_ids.length ?? 0) > 0;
  const analysisDone = Boolean(report && completed >= total && !analysisFailed && !p?.pending);
  const summaryDone =
    report?.summary_status === 'ready' || report?.summary_status === 'not_applicable';
  const adviceDone =
    Boolean(report && !report.advice_status && summaryDone && report.status === 'ready') ||
    report?.advice_status === 'ready';
  const empty = state === 'empty';
  const canRetry = state === 'failed' || state === 'unrequested';
  const retry = () =>
    command.run(
      (key) => interviewsApi.retryReport(id, report?.version ?? 1, key, reportRetryScope(report)),
      onReport,
    );
  return (
    <TransitionScreen
      kind="analysis"
      title={empty ? '本场面试已结束' : state === 'failed' ? '分析暂未完成' : '恭喜你，完成面试'}
      description={
        empty
          ? '本次没有提交回答，面试记录已保存。'
          : state === 'failed'
            ? '你的回答和已完成的分析均已保存'
            : state === 'unrequested'
              ? '这份记录尚未生成分析'
              : !interview
                ? '正在保存面试记录'
                : !analysisDone
                  ? `正在分析回答 · ${completed} / ${total}`
                  : !summaryDone
                    ? '正在整理本场总结'
                    : '正在生成练习建议'
      }
      context={
        interview
          ? `${interview.job_title} · ${interview.configuration.duration_minutes} 分钟练习`
          : undefined
      }
      detail={
        !interview
          ? '正在读取面试记录'
          : empty
            ? '没有回答时不会生成能力评分'
            : report
              ? `已分析 ${completed} / ${total} 份回答${analysisFailed ? '，部分分析需要重试' : ''}`
              : '面试记录已保存，等待生成复盘'
      }
      steps={[
        { label: '回答已保存', state: interview ? 'done' : 'active' },
        {
          label: empty ? '无需能力分析' : '逐题分析回答',
          state: analysisFailed
            ? 'error'
            : analysisDone
              ? 'done'
              : interview && state === 'pending'
                ? 'active'
                : 'pending',
        },
        {
          label: empty ? '记录已归档' : '整理总结与评分',
          state:
            report?.summary_status === 'failed'
              ? 'error'
              : summaryDone || empty
                ? 'done'
                : analysisDone && state === 'pending'
                  ? 'active'
                  : 'pending',
        },
        {
          label: '生成练习建议',
          state:
            report?.advice_status === 'failed'
              ? 'error'
              : adviceDone || empty
                ? 'done'
                : report?.advice_status === 'pending'
                  ? 'active'
                  : 'pending',
        },
      ]}
      progress={
        report
          ? {
              value: empty ? 1 : completed + Number(summaryDone) + Number(adviceDone),
              max: empty ? 1 : Math.max(total, 1) + 2,
            }
          : undefined
      }
      error={
        command.error ||
        error ||
        (state === 'failed' ? '成功结果和原回答均已保存。重试只处理未完成的部分。' : undefined)
      }
    >
      <div className="transition-actions">
        {command.unresolved ? (
          <Button onClick={command.retry} disabled={command.busy}>
            确认并重试原操作
          </Button>
        ) : error ? (
          <Button onClick={refresh} disabled={refreshing}>
            重新连接
          </Button>
        ) : canRetry && interview ? (
          <Button onClick={retry} disabled={command.blocked}>
            {command.busy
              ? '正在恢复分析…'
              : state === 'unrequested'
                ? '生成完整复盘'
                : '重试未完成的分析'}
          </Button>
        ) : null}
        {(state === 'failed' || empty || state === 'unrequested') && interview && report && (
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
