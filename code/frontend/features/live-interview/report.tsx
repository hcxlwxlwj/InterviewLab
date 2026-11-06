'use client';
import Link from 'next/link';
import { AbilityRadar, TotalScore, QuestionCoverage } from './report-charts';
import { ReportProgress, isReportPending, reportDisplayState } from './report-progress';
import { AnalysisWaiting } from './analysis';
import { IndicatorRatings } from './report-standard';
import { QuestionScorecard, PracticeHistory } from './question-scores';
import { printReport } from './report-export';
import { ReportInsights } from './report-insights';
import { ReviewConversationTurn } from './review-conversation';
import { reviewAdvice } from './review-advice';
import { useCallback, useEffect, useState } from 'react';
import { FileText, RotateCcw, Info } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  isQuestionScoringVersion,
  feedbackScore,
  reportFeedback,
  type InterviewReport,
  type InterviewFinding,
} from '@interviewlab/core';
import { Breadcrumb, Footer, Header, Loading } from '../../components/shared';
import { ApiClientError } from '../../lib/api/http';
import { interviewsApi } from '../../lib/api/interviews';
import { CommandNotice, ErrorNotice, SessionGate, useLiveCommand, useLiveResource } from './common';

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

function Findings({ items }: { items: InterviewFinding[] }) {
  return (
    <>
      {items.map((f, i) => (
        <div key={i}>
          <p>{f.text}</p>
        </div>
      ))}
    </>
  );
}
function ReportBody({ id, practice = false }: { id: string; practice?: boolean }) {
  const router = useRouter();
  const partialView = useSearchParams().get('view') === 'partial';
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  const load = useCallback(
    async (signal: AbortSignal) => {
      const originalInterview = await interviewsApi.read(id, signal);
      const interview = originalInterview;
      let report: InterviewReport | null = null;
      if (['completed', 'failed'].includes(interview.status)) {
        try {
          report = await interviewsApi.report(id, signal);
        } catch (e) {
          if (!(e instanceof ApiClientError && e.status === 404)) throw e;
        }
      }
      return { interview, originalInterview, report };
    },
    [id],
  );
  const resource = useLiveResource(load, (v) => Boolean(v.report && isReportPending(v.report)), {
    retryReadErrors: true,
  });
  const data = resource.value;
  useEffect(() => {
    if (!practice || !data) return;
    const hash = window.location.hash.slice(1);
    if (hash.startsWith('turn-')) revealAnswer(decodeURIComponent(hash.slice(5)));
  }, [practice, data?.report?.version, Boolean(data)]);
  const command = useLiveCommand(() => void resource.refresh());
  if (!data)
    return (
      <>
        <ErrorNotice message={resource.error} retry={() => void resource.refresh()} />
        {!resource.error && <Loading />}
      </>
    );
  const { interview, report } = data;
  const displayState = reportDisplayState(report);
  if (
    ['completed', 'failed'].includes(interview.status) &&
    (displayState === 'pending' || (!partialView && !['ready', 'empty'].includes(displayState)))
  ) {
    return (
      <AnalysisWaiting
        id={id}
        interview={interview}
        report={report}
        error={resource.error}
        refreshing={resource.refreshing}
        refresh={() => void resource.refresh()}
        onReport={(result) => resource.accept({ ...data, report: result })}
      />
    );
  }
  if (displayState === 'empty') {
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
  if (!report) {
    const finalized = ['completed', 'failed'].includes(interview.status);
    return (
      <section className="panel">
        <h2>{finalized ? '面试记录已保存' : '面试尚未结束'}</h2>
        <p>
          {finalized
            ? '尚未生成复盘，你可以基于本场已保存的回答请求分析。'
            : '结束后再提供复盘，进行中不展示参考答案或评价。'}
        </p>
        <CommandNotice command={command} refresh={() => void resource.refresh()} />
        {finalized ? (
          <button
            className="live-button"
            disabled={command.blocked}
            onClick={() =>
              command.run(
                (key) => interviewsApi.retryReport(id, 1, key),
                (result) =>
                  resource.accept({
                    interview,
                    originalInterview: data.originalInterview,
                    report: result,
                  }),
              )
            }
          >
            生成文字复盘
          </button>
        ) : (
          <Link className="live-button" href={`/interview/${id}`}>
            返回面试
          </Link>
        )}
      </section>
    );
  }
  const reportPending = isReportPending(report);
  if (interview.parent_interview_id) {
    const score = report.question_scores?.[0];
    const evaluation = report.evaluations.at(-1);
    return (
      <>
        <section className="panel">
          <h1>单题重练结果</h1>
          <p>{interview.turns[0]?.text}</p>
          <Link href={`/reports/${interview.parent_interview_id}/practice`}>
            返回原面试逐题复盘
          </Link>
          {score ? (
            <QuestionScorecard score={score.score} assessments={score.assessments} />
          ) : (
            <p role="status">
              {reportPending
                ? '本题评分生成中…'
                : report.status === 'failed'
                  ? '本题评分失败，回答已保留。'
                  : isQuestionScoringVersion(report.question_scoring_version)
                    ? '本次回答暂无能力评分。'
                    : '历史练习没有本版评分。'}
            </p>
          )}
          {report.status === 'failed' || report.analysis_progress?.failed ? (
            <button
              className="live-button"
              disabled={command.blocked}
              onClick={() =>
                command.run(
                  (key) => interviewsApi.retryReport(id, report.version, key),
                  () => resource.refresh(),
                )
              }
            >
              重试本题评分
            </button>
          ) : null}
          {evaluation && (
            <>
              <h3>做得好的地方</h3>
              <Findings items={evaluation.strengths} />
              {!!reviewAdvice(evaluation).length && (
                <section className="review-training-goal">
                  <h3>改进建议</h3>
                  {reviewAdvice(evaluation).map((text, index) => (
                    <p key={index}>{text}</p>
                  ))}
                </section>
              )}
              {report.advice_status === 'failed' && <p>个性化建议暂不可用，本题评分已保留。</p>}
            </>
          )}
          <section className="review-saved-answer">
            <h3>本次回答</h3>
            {interview.turns.map((t) => (
              <p key={t.id}>{t.answer_text}</p>
            ))}
          </section>
          <button
            className="live-button"
            disabled={command.blocked}
            onClick={() =>
              command.run(
                (key) =>
                  interviewsApi.retry(
                    interview.parent_interview_id!,
                    {
                      turn_id: interview.parent_turn_id!,
                      revision: interview.parent_revision!,
                      goal: interview.retry_goal ?? '围绕原题补充具体依据',
                    },
                    key,
                  ),
                (result) => router.push(`/interview/${result.id}`),
              )
            }
          >
            再次重练本题
          </button>
          <CommandNotice command={command} />
        </section>
        <section className="panel">
          <PracticeHistory
            report={report}
            turnIds={interview.parent_turn_id ? [interview.parent_turn_id] : undefined}
            originalId={interview.parent_interview_id}
          />
        </section>
      </>
    );
  }
  return (
    <>
      {!practice && (
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
          <div className="report-banner">
            <div>
              <Info size={16} />
              <span>基于本场回答的 AI 辅助复盘，参考评分未经人工校准，不代表招聘结论。</span>
            </div>
          </div>
          <ErrorNotice message={resource.error} retry={() => void resource.refresh()} />
          <CommandNotice command={command} refresh={() => void resource.refresh()} />
          <ReportProgress
            report={report}
            refreshing={resource.refreshing}
            refresh={() => void resource.refresh()}
            busy={command.blocked}
            retry={() =>
              command.run(
                (key) =>
                  interviewsApi.retryReport(
                    id,
                    report.version,
                    key,
                    report.missing_turn_ids.length || report.status === 'failed'
                      ? 'missing'
                      : 'summary',
                  ),
                (result) =>
                  resource.accept({
                    interview,
                    originalInterview: data.originalInterview,
                    report: result,
                  }),
              )
            }
          />
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
                    onSelect={revealAnswer}
                  />
                </div>
              )}
              {(report.summary ||
                (report.analysis_progress?.total ?? report.evaluations.length) > 0) && (
                <section
                  className={report.summary ? 'report-summary-modules' : 'panel'}
                  aria-label="整场总结"
                >
                  {report.summary ? (
                    <ReportInsights report={report} onSelect={revealAnswer} />
                  ) : (
                    <p role="status">
                      {report.summary_status === 'failed'
                        ? '整场总结生成失败，已完成的逐题复盘仍可查看。'
                        : report.summary_status === 'not_requested' || !report.summary_status
                          ? '整场总结尚未生成。'
                          : report.summary_status === 'not_applicable'
                            ? '本次没有足够的评价证据生成整场总结，可查看原回答和逐题分析。'
                            : report.status === 'failed'
                              ? '暂无成功的逐题分析，请先重试缺失分析。'
                              : '逐题分析完成后整理整场总结，可以先查看下面已完成的题目。'}
                    </p>
                  )}
                  {!reportPending &&
                    report.evaluations.length > 0 &&
                    !report.summary &&
                    ['failed', 'not_requested', undefined].includes(report.summary_status) && (
                      <button
                        className="live-button"
                        disabled={command.blocked}
                        onClick={() =>
                          command.run(
                            (key) => interviewsApi.retryReport(id, report.version, key, 'summary'),
                            (result) =>
                              resource.accept({
                                interview,
                                originalInterview: data.originalInterview,
                                report: result,
                              }),
                          )
                        }
                      >
                        {report.summary_status === 'failed' ? '重试整场总结' : '生成整场总结'}
                      </button>
                    )}
                </section>
              )}
            </div>
          </div>
        </>
      )}
      {!practice ? (
        <Link
          id="interview-details-trigger"
          className="report-details-action"
          href={`/reports/${id}/practice`}
        >
          <FileText size={18} /> 逐题复盘与重练
        </Link>
      ) : (
        <section className="report-practice-page">
          <div className="report-dialog-heading">
            <div>
              <h1>逐题复盘与重练</h1>
              <p>回看这场对话，展开每题分析，再选择需要练习的地方。</p>
            </div>
            <Link className="live-button secondary" href={`/reports/${id}`}>
              面试报告
            </Link>
          </div>
          <CommandNotice command={command} refresh={() => void resource.refresh()} />
          {reportPending && (
            <p className="notice" role="status">
              逐题分析正在生成，已完成的评分和原回答可先查看。
            </p>
          )}
          <section className="report-detail">
            <div id="review-panel">
              <div className="turn-reviews">
                <nav className="review-question-index" aria-label="按主问题浏览">
                  {interview.turns
                    .filter((t) => !t.follow_up_index)
                    .map((turn) => (
                      <a
                        key={turn.id}
                        href={`#turn-${turn.id}`}
                        onClick={() => revealAnswer(turn.id)}
                      >
                        第 {turn.main_question_index} 题
                      </a>
                    ))}
                </nav>
                {interview.turns.map((turn) => {
                  const questionScore = report.question_scores?.find((q) =>
                    q.turn_ids.includes(turn.id),
                  );
                  const evaluation = report.evaluations.find(
                    (e) => e.turn_id === turn.id && e.revision === turn.revision,
                  );
                  return (
                    <ReviewConversationTurn
                      turn={turn}
                      key={turn.id}
                      score={questionScore?.turn_id === turn.id ? questionScore.score : undefined}
                    >
                      {turn.answer_status === 'answered' ? (
                        <>
                          {questionScore && questionScore.turn_id === turn.id && (
                            <>
                              <QuestionScorecard
                                score={questionScore.score}
                                assessments={questionScore.assessments}
                              />
                              <section className="review-history">
                                <PracticeHistory
                                  report={report}
                                  turnIds={questionScore.turn_ids}
                                  originalId={id}
                                />
                              </section>
                            </>
                          )}
                          {evaluation && (
                            <>
                              {!questionScore && <IndicatorRatings evaluation={evaluation} />}
                              {!!evaluation.strengths.length && (
                                <section className="review-feedback-section">
                                  <h3>亮点</h3>
                                  <Findings items={evaluation.strengths} />
                                </section>
                              )}
                              {!!reviewAdvice(evaluation).length && (
                                <section className="review-training-goal">
                                  <h3>改进建议</h3>
                                  {reviewAdvice(evaluation).map((text, index) => (
                                    <p key={index}>{text}</p>
                                  ))}
                                </section>
                              )}
                            </>
                          )}
                          {!evaluation && (
                            <p>
                              {reportPending
                                ? '本题分析正在生成。'
                                : report.missing_turn_ids.includes(turn.id)
                                  ? '本题分析生成失败，原回答已保留。'
                                  : '本题分析尚未完成。'}
                            </p>
                          )}
                          {(turn.follow_up_index === 0 || questionScore?.turn_id === turn.id) && (
                            <button
                              className="live-button secondary"
                              disabled={command.blocked}
                              onClick={() =>
                                command.run(
                                  (key) =>
                                    interviewsApi.retry(
                                      id,
                                      {
                                        turn_id: turn.id,
                                        revision: turn.revision,
                                        goal:
                                          evaluation?.retry_goal ??
                                          '围绕原题补充本人行动及验证依据',
                                      },
                                      key,
                                    ),
                                  (result) => router.push(`/interview/${result.id}`),
                                )
                              }
                            >
                              重练这一题
                            </button>
                          )}
                        </>
                      ) : (
                        <p>
                          {turn.answer_status === 'skipped'
                            ? '已跳过，不进行能力评估。'
                            : '未提交回答，不进行能力评估。'}
                        </p>
                      )}
                    </ReviewConversationTurn>
                  );
                })}
              </div>
            </div>
          </section>

          <div className="report-dialog-footer">
            {' '}
            <Button size="sm" asChild>
              <Link
                href={`/interview/setup?job=${encodeURIComponent(interview.configuration.job)}`}
              >
                <RotateCcw size={14} />
                重新面试
              </Link>
            </Button>
          </div>
        </section>
      )}
    </>
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
