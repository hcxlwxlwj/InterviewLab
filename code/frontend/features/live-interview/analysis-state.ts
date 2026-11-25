import type { Interview, InterviewReport } from '@interviewlab/core';
import { reportDisplayState, type ReportDisplayState } from './report-progress';
import type { TransitionScreenProps, TransitionStep } from './transition-screen';

interface AnalysisProgress {
  total: number;
  completed: number;
  analysisFailed: boolean;
  analysisDone: boolean;
  summaryDone: boolean;
  summaryFailed: boolean;
  adviceDone: boolean;
  adviceFailed: boolean;
  advicePending: boolean;
}

function answerProgress(report: InterviewReport) {
  const progress = report.analysis_progress;
  return {
    total: progress?.total ?? report.evaluations.length,
    completed: progress?.completed ?? report.evaluations.length,
    failed: progress?.failed ?? report.missing_turn_ids.length,
    pending: progress?.pending ?? 0,
  };
}

function analysisProgress(report: InterviewReport | null): AnalysisProgress {
  if (!report)
    return {
      total: 0,
      completed: 0,
      analysisFailed: false,
      analysisDone: false,
      summaryDone: false,
      summaryFailed: false,
      adviceDone: false,
      adviceFailed: false,
      advicePending: false,
    };
  const progress = answerProgress(report);
  const analysisFailed = progress.failed > 0;
  const summaryDone =
    report.summary_status === 'ready' || report.summary_status === 'not_applicable';
  return {
    total: progress.total,
    completed: progress.completed,
    analysisFailed,
    analysisDone: progress.completed >= progress.total && !analysisFailed && !progress.pending,
    summaryDone,
    summaryFailed: report.summary_status === 'failed',
    adviceDone:
      (!report.advice_status && summaryDone && report.status === 'ready') ||
      report.advice_status === 'ready',
    adviceFailed: report.advice_status === 'failed',
    advicePending: report.advice_status === 'pending',
  };
}

function analysisDescription(
  state: ReportDisplayState,
  interview: Interview | null,
  progress: AnalysisProgress,
) {
  if (state === 'empty') return '本次没有提交回答，面试记录已保存。';
  if (state === 'failed') return '你的回答和已完成的分析均已保存';
  if (state === 'unrequested') return '这份记录尚未生成分析';
  if (!interview) return '正在保存面试记录';
  if (!progress.analysisDone)
    return `正在分析回答 · ${progress.completed} / ${progress.total}`;
  if (!progress.summaryDone) return '正在整理本场总结';
  return '正在生成练习建议';
}

function analysisDetail(
  interview: Interview | null,
  report: InterviewReport | null,
  state: ReportDisplayState,
  progress: AnalysisProgress,
) {
  if (!interview) return '正在读取面试记录';
  if (state === 'empty') return '没有回答时不会生成能力评分';
  if (!report) return '面试记录已保存，等待生成复盘';
  const failure = progress.analysisFailed ? '，部分分析需要重试' : '';
  return `已分析 ${progress.completed} / ${progress.total} 份回答${failure}`;
}

function stepState(failed: boolean, done: boolean, active: boolean): TransitionStep['state'] {
  if (failed) return 'error';
  if (done) return 'done';
  if (active) return 'active';
  return 'pending';
}

function analysisSteps(
  interviewSaved: boolean,
  state: ReportDisplayState,
  progress: AnalysisProgress,
): TransitionStep[] {
  const empty = state === 'empty';
  const pending = state === 'pending';
  return [
    { label: '回答已保存', state: interviewSaved ? 'done' : 'active' },
    {
      label: empty ? '无需能力分析' : '逐题分析回答',
      state: stepState(
        progress.analysisFailed,
        progress.analysisDone,
        interviewSaved && pending,
      ),
    },
    {
      label: empty ? '记录已归档' : '整理总结与评分',
      state: stepState(
        progress.summaryFailed,
        progress.summaryDone || empty,
        progress.analysisDone && pending,
      ),
    },
    {
      label: '生成练习建议',
      state: stepState(
        progress.adviceFailed,
        progress.adviceDone || empty,
        progress.advicePending,
      ),
    },
  ];
}

type AnalysisPresentation = Pick<
  TransitionScreenProps,
  'title' | 'description' | 'context' | 'detail' | 'steps' | 'progress'
> & { state: ReportDisplayState };

/** Project the saved report stages into progress without estimating completion from elapsed time. */
export function analysisPresentation(
  interview: Interview | null,
  report: InterviewReport | null,
): AnalysisPresentation {
  const state = reportDisplayState(report);
  const progress = analysisProgress(report);
  const empty = state === 'empty';
  return {
    state,
    title: empty ? '本场面试已结束' : state === 'failed' ? '分析暂未完成' : '恭喜你，完成面试',
    description: analysisDescription(state, interview, progress),
    context: interview
      ? `${interview.job_title} · ${interview.configuration.duration_minutes} 分钟练习`
      : undefined,
    detail: analysisDetail(interview, report, state, progress),
    steps: analysisSteps(Boolean(interview), state, progress),
    progress: report
      ? {
          value: empty
            ? 1
            : progress.completed + Number(progress.summaryDone) + Number(progress.adviceDone),
          max: empty ? 1 : Math.max(progress.total, 1) + 2,
        }
      : undefined,
  };
}
