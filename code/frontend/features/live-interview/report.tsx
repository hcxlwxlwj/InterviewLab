'use client';
import Link from 'next/link';
import {
  AbilityRadar,
  ReportDistribution,
  TotalScore,
  QuestionCoverage,
  FeedbackScoreTable,
} from './report-charts';
import { ReportProgress, isReportPending } from './report-progress';
import { ScoringStandard, IndicatorRatings } from './report-standard';
import { printReport } from './report-export';
import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, FileText, ArrowLeftRight, RotateCcw, Info } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  FEEDBACK_DIMENSIONS,
  FEEDBACK_ANALYSIS_VERSION,
  feedbackScore,
  FRONTEND_RUBRIC_VERSION,
  type InterviewReport,
  type InterviewEvidence,
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
  document.getElementById('review-tab')?.click();
  requestAnimationFrame(() => {
    if (target instanceof HTMLDetailsElement) target.open = true;
    target.scrollIntoView({ block: 'start' });
  });
}

function Evidence({ refs }: { refs: InterviewEvidence[] }) {
  const unique = [
    ...new Map(
      refs.map((ref) => [JSON.stringify([ref.turn_id, ref.revision, ref.quote]), ref]),
    ).values(),
  ];
  if (!unique.length) return null;
  return (
    <details className="report-evidence">
      <summary>查看依据（{unique.length} 处）</summary>
      {unique.map((ref, i) => (
        <blockquote className="live-evidence" key={`${ref.turn_id}:${i}`}>
          <a href={`#turn-${ref.turn_id}`} onClick={() => revealAnswer(ref.turn_id)}>
            定位回答 v{ref.revision}
          </a>
          <p>“{ref.quote.length > 160 ? `${ref.quote.slice(0, 160)}…` : ref.quote}”</p>
        </blockquote>
      ))}
    </details>
  );
}
function Findings({ items }: { items: InterviewFinding[] }) {
  return (
    <>
      {items.map((f, i) => (
        <div key={i}>
          <p>{f.text}</p>
          <Evidence refs={f.evidence_refs} />
        </div>
      ))}
    </>
  );
}
function Comparison({ id }: { id: string }) {
  const load = useCallback((signal: AbortSignal) => interviewsApi.comparison(id, signal), [id]);
  const resource = useLiveResource(load, (v) => ['pending', 'generating'].includes(v.status));
  const command = useLiveCommand();
  const v = resource.value;
  return (
    <section className="panel">
      <h2>重练比较</h2>
      <ErrorNotice message={resource.error} retry={() => void resource.refresh()} />
      <CommandNotice command={command} refresh={() => void resource.refresh()} />
      {!v && !resource.error ? (
        <Loading />
      ) : (
        v && (
          <>
            <p>比较目标：{v.goal}</p>
            <div className="live-comparison">
              <article id={`turn-${v.original_turn_id}`}>
                <h3>原回答 · v{v.original_revision}</h3>
                <p>{v.original_text}</p>
              </article>
              <article>
                <h3>重练回答 · v{v.retry_revision}</h3>
                <p>{v.retry_text}</p>
              </article>
            </div>
            {v.status === 'ready' ? (
              <>
                <h3>观察到的变化</h3>
                <Findings items={v.changes} />
                <h3>仍需补充</h3>
                <Findings items={v.remaining_gaps} />
                <ul>
                  {v.limitations.map((l, i) => (
                    <li key={i}>{l}</li>
                  ))}
                </ul>
              </>
            ) : v.status === 'failed' ? (
              <>
                <p>比较生成失败，两份回答仍保留。</p>
                <button
                  className="live-button"
                  disabled={command.blocked}
                  onClick={() =>
                    command.run(
                      (key) => interviewsApi.retryComparison(id, v.version, key),
                      resource.accept,
                    )
                  }
                >
                  重试比较
                </button>
              </>
            ) : (
              <p role="status">正在比较两次回答…</p>
            )}
          </>
        )
      )}
    </section>
  );
}
function ReportBody({ id, practice = false }: { id: string; practice?: boolean }) {
  const router = useRouter();
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  const search = useSearchParams();
  const [tab, setTab] = useState<'review' | 'compare'>(
    search.has('comparison') ? 'compare' : 'review',
  );
  const load = useCallback(
    async (signal: AbortSignal) => {
      const originalInterview = await interviewsApi.read(id, signal);
      let interview = originalInterview;
      let report: InterviewReport | null = null;
      if (['completed', 'failed'].includes(interview.status)) {
        try {
          report = await interviewsApi.report(id, signal);
          if (report.needs_refresh) {
            try {
              report = await interviewsApi.retryReport(
                id,
                report.version,
                crypto.randomUUID(),
                'latest',
              );
            } catch (error) {
              if (!(error instanceof ApiClientError && error.status === 409)) throw error;
              report = await interviewsApi.report(id, signal);
            }
          }
          interview = {
            ...originalInterview,
            turns: originalInterview.turns.map(
              (turn) =>
                report?.answer_sources?.find((source) => source.original_turn_id === turn.id)
                  ?.turn ?? turn,
            ),
          };
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
  const retryTurn = interview.turns.find((t) => t.answer_status === 'answered');
  const comparisonId = search.get('comparison');
  const reportPending = isReportPending(report);
  return (
    <>
      {!!report.answer_sources?.length && (
        <p className="notice" role="status">
          本报告已采用 {report.answer_sources.length} 题的最新重练回答，首次回答和历次记录仍保留。
        </p>
      )}
      {!practice && (
        <>
          <div className="page-heading report-page-heading">
            <div>
              <h1>面试分析报告</h1>
              <p>{interview.job_title} · 本场面试分析报告</p>
            </div>
            <div className="page-actions">
              <Button variant="outline" size="sm" asChild>
                <Link href="/me/interviews">
                  <FileText size={14} />
                  查看记录
                </Link>
              </Button>
              <TotalScore
                score={feedbackScore(report.summary?.feedback_template).score}
                coverage={feedbackScore(report.summary?.feedback_template).coverage}
              />
            </div>
          </div>
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
              <div className="report-visual-row">
                <section className="panel score-panel" aria-label="六维能力画像">
                  <h2>能力画像</h2>
                  <AbilityRadar feedback={report.summary} pending={reportPending} />
                  <p className="radar-caption">六维评分模板 · 权重 25 / 25 / 25 / 15 / 5 / 5</p>
                </section>
                <QuestionCoverage
                  turns={interview.turns}
                  evaluations={report.evaluations}
                  pending={reportPending}
                  failedIds={report.missing_turn_ids}
                  onSelect={revealAnswer}
                />
              </div>
              {(report.summary ||
                (report.analysis_progress?.total ?? report.evaluations.length) > 0) && (
                <section className="panel" aria-label="整场总结">
                  <h2>
                    <FileText size={22} /> 面试反馈报告
                  </h2>
                  {(!report.summary?.feedback_template ||
                    report.analysis_metadata?.prompt_version !== FEEDBACK_ANALYSIS_VERSION) &&
                    !reportPending &&
                    report.evaluations.length > 0 && (
                      <div className="template-upgrade">
                        <p>
                          六维评价规则已更新，可结合完整回答识别同一道题体现的多项能力。重新分析会保留原回答。
                        </p>
                        <button
                          className="live-button"
                          disabled={command.blocked}
                          onClick={() =>
                            command.run(
                              (key) =>
                                interviewsApi.retryReport(id, report.version, key, 'summary'),
                              (result) =>
                                resource.accept({
                                  interview,
                                  originalInterview: data.originalInterview,
                                  report: result,
                                }),
                            )
                          }
                        >
                          更新六维分析
                        </button>
                      </div>
                    )}
                  {report.summary ? (
                    <>
                      <h3>一、总体印象</h3>
                      <Findings items={[report.summary.overview]} />
                      <ReportDistribution report={report} />
                      <h3>二、做得好的地方（具体行为）</h3>
                      {report.summary.strengths.length ? (
                        <Findings items={report.summary.strengths} />
                      ) : (
                        <p>本次没有足够依据归纳整场优势，可查看逐题分析。</p>
                      )}
                      <h3>三、需要提升的地方（具体、可操作）</h3>
                      {report.summary.improvements.length ? (
                        report.summary.improvements.map((item, index) => (
                          <article key={item.turn_id}>
                            <h4>
                              {index + 1}. {item.text}
                            </h4>
                            <Evidence refs={item.evidence_refs} />
                            <p>练习目标：{item.retry_goal}</p>
                            <a
                              className="live-button secondary"
                              href={`#turn-${item.turn_id}`}
                              onClick={() => revealAnswer(item.turn_id)}
                            >
                              查看原题与分析
                            </a>
                          </article>
                        ))
                      ) : (
                        <p>没有需要优先列出的已确认缺口，不强行生成练习目标。</p>
                      )}
                      <h3>四、针对性改进建议</h3>
                      {report.summary.feedback_template?.action_plan.length ? (
                        report.summary.feedback_template.action_plan.map((item, i) => (
                          <article className="template-action" key={i}>
                            <h4>
                              {
                                {
                                  short_term: '短期（1周）',
                                  medium_term: '中期（1月）',
                                  long_term: '长期（持续练习）',
                                }[item.horizon]
                              }
                            </h4>
                            <p>{item.action}</p>
                            <p>验收方式：{item.acceptance}</p>
                            <button
                              className="live-button secondary"
                              onClick={() => revealAnswer(item.turn_id)}
                            >
                              查看相关题目
                            </button>
                          </article>
                        ))
                      ) : (
                        <p>按模板重新生成后，提供分阶段行动步骤和验收方式。</p>
                      )}
                      <FeedbackScoreTable report={report} />
                      <h3>六、下一步期待</h3>
                      <p>
                        {report.summary.feedback_template?.next_expectation ??
                          '围绕已确认的改进目标完成一次重练，再对比原回答与新回答。'}
                      </p>
                      <details className="report-summary-limitations">
                        <summary>分析范围与局限</summary>
                        <ul>
                          {report.summary.limitations.map((item, i) => (
                            <li key={i}>{item}</li>
                          ))}
                        </ul>
                      </details>
                    </>
                  ) : (
                    <p role="status">
                      {report.summary_status === 'failed'
                        ? '整场总结生成失败，已完成的逐题复盘仍可查看。'
                        : report.summary_status === 'not_requested' || !report.summary_status
                          ? '这份历史报告尚未生成整场总结。'
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
              <details className="panel report-methodology">
                <summary>评分依据与分析范围</summary>
                <section className="template-rubric">
                  <h3>面试反馈模板 · 六维评分表</h3>
                  <p>
                    差：0–39；中：40–69；良：70–89；优：90–100。按明确行为评价，未问到、证据不足不补零。综合素质仅描述本场可观察的主动与反思，不推断人格、抗压或长期稳定。
                  </p>
                  {FEEDBACK_DIMENSIONS.map((d) => (
                    <details key={d.key}>
                      <summary>
                        {d.label} · {d.weight} 分
                      </summary>
                      <ol>
                        {d.anchors.map((a, i) => (
                          <li key={a}>
                            {['差', '中', '良', '优'][i]}：{a}
                          </li>
                        ))}
                      </ol>
                    </details>
                  ))}
                </section>
                <section className="panel report-overview">
                  <div className="live-toolbar">
                    <h2>{interview.job_title}</h2>
                    <span className="badge">
                      {reportPending
                        ? '复盘生成中'
                        : report.status === 'failed'
                          ? '分析失败'
                          : report.is_partial
                            ? '部分复盘'
                            : '面后复盘'}
                    </span>
                    <span>
                      {report.scoring_status === 'experimental'
                        ? 'AI 参考评分 · 未经人工校准'
                        : '证据复盘'}
                    </span>
                  </div>
                  <p>
                    {
                      {
                        text_fallback: '文字面试',
                        realtime_voice: '语音面试',
                        realtime_video: '视频面试',
                      }[interview.configuration.interaction_mode]
                    }{' '}
                    · {interview.configuration.duration_minutes} 分钟配置 ·{' '}
                    {
                      {
                        technical_qa: '技术问答',
                        project_deep_dive: '项目深挖',
                        business_scenario: '业务场景',
                        hr: '综合素质',
                        mixed: '混合面试',
                      }[interview.configuration.interview_type]
                    }
                  </p>
                  <p>
                    结束时间：
                    {interview.ended_at
                      ? new Date(interview.ended_at).toLocaleString('zh-CN')
                      : '未记录'}{' '}
                    ·{' '}
                    {{
                      completed: '正常完成',
                      user_finished: '提前结束',
                      hard_deadline: '达到时间上限',
                    }[interview.end_reason as 'completed'] ?? '面试已结束'}
                  </p>

                  {report.analysis_progress && (
                    <p role="status" aria-live="polite">
                      有效回答 {report.analysis_progress.total} 题 · 已分析{' '}
                      {report.analysis_progress.completed} 题 · 待处理{' '}
                      {report.analysis_progress.pending} 题 · 失败 {report.analysis_progress.failed}{' '}
                      题
                    </p>
                  )}
                  {report.analysis_progress?.total === 0 && (
                    <p>没有有效回答，仅保存面试记录，不作能力评价。</p>
                  )}
                  {reportPending && (
                    <p role="status">回答已保存，正在逐题整理复盘，可以稍后从记录中回来。</p>
                  )}
                  {!reportPending &&
                    (report.status === 'failed' || report.missing_turn_ids.length > 0) && (
                      <>
                        <p>部分分析未生成，重试不会重新进行面试。</p>
                        <button
                          className="live-button"
                          disabled={command.blocked}
                          onClick={() =>
                            command.run(
                              (key) => interviewsApi.retryReport(id, report.version, key),
                              (result) =>
                                resource.accept({
                                  interview,
                                  originalInterview: data.originalInterview,
                                  report: result,
                                }),
                            )
                          }
                        >
                          重试缺失分析
                        </button>
                      </>
                    )}
                </section>
                {interview.configuration.job === 'frontend' &&
                  interview.configuration.career_stage === 'internship' && (
                    <ScoringStandard
                      current={
                        report.evaluations.length > 0 &&
                        report.evaluations.every(
                          (e) => e.scoring_rubric_version === FRONTEND_RUBRIC_VERSION,
                        )
                      }
                      busy={
                        command.blocked ||
                        reportPending ||
                        !interview.turns.some((t) => t.answer_status === 'answered')
                      }
                      upgrade={() =>
                        command.run(
                          (key) => interviewsApi.retryReport(id, report.version, key, 'rubric'),
                          (result) =>
                            resource.accept({
                              interview,
                              originalInterview: data.originalInterview,
                              report: result,
                            }),
                        )
                      }
                    />
                  )}
              </details>
              <section className="panel export-panel">
                <h3>导出 PDF</h3>
                <p>导出总分、维度评分、整场总结、逐题分析及原回答。在打印窗口选择“另存为 PDF”。</p>
                {reportPending && <p role="status">报告仍在生成，可导出当前已完成的内容。</p>}
                {report.is_partial && <p>导出文件会保留部分报告及缺失分析标记。</p>}
                {exportError && <p role="alert">{exportError}</p>}
                <Button
                  variant="outline"
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
                  {exporting ? '正在准备…' : '导出 / 保存 PDF'}
                </Button>
              </section>
            </div>
          </div>
        </>
      )}
      {!practice ? (
        <Link
          id="interview-details-trigger"
          className="report-details-fab"
          href={`/reports/${id}/practice`}
        >
          <FileText size={18} /> 逐题复盘与重练
        </Link>
      ) : (
        <section className="report-practice-page">
          <div className="report-dialog-heading">
            <div>
              <h1>逐题复盘与重练</h1>
              <p>查看回答、分析和重练记录。完成重练后，面试报告会按最新回答更新。</p>
            </div>
            <Link className="live-button secondary" href={`/reports/${id}`}>
              面试报告
            </Link>
          </div>
          <CommandNotice command={command} refresh={() => void resource.refresh()} />
          {reportPending && (
            <p className="notice" role="status">
              正在分析最新回答并更新报告，完成后将自动刷新。
            </p>
          )}
          <section className="report-detail">
            <div className="content-tabs" role="tablist" aria-label="报告视图">
              {(['review', 'compare'] as const).map((value) => (
                <button
                  key={value}
                  id={`${value}-tab`}
                  role="tab"
                  aria-selected={tab === value}
                  aria-controls={`${value}-panel`}
                  tabIndex={tab === value ? 0 : -1}
                  className={tab === value ? 'selected' : ''}
                  onClick={() => setTab(value)}
                  onKeyDown={(event) => {
                    if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
                      event.preventDefault();
                      const next =
                        event.key === 'Home'
                          ? 'review'
                          : event.key === 'End'
                            ? 'compare'
                            : value === 'review'
                              ? 'compare'
                              : 'review';
                      setTab(next);
                      document.getElementById(`${next}-tab`)?.focus();
                    }
                  }}
                >
                  {value === 'review' ? <FileText size={15} /> : <ArrowLeftRight size={15} />}
                  {value === 'review' ? '逐题复盘' : '重练对比'}
                </button>
              ))}
            </div>
            <div
              id="review-panel"
              role="tabpanel"
              aria-labelledby="review-tab"
              hidden={tab !== 'review'}
            >
              <div className="turn-reviews">
                <section className="panel">
                  <h2>逐题复盘</h2>
                  <nav aria-label="按主问题浏览">
                    {interview.turns
                      .filter((t) => !t.follow_up_index)
                      .map((turn) => (
                        <p key={turn.id}>
                          <a href={`#turn-${turn.id}`} onClick={() => revealAnswer(turn.id)}>
                            主问题 {turn.main_question_index}：{turn.text}
                          </a>
                        </p>
                      ))}
                  </nav>
                </section>
                {interview.turns.map((turn, index) => {
                  const evaluation = report.evaluations.find(
                    (e) => e.turn_id === turn.id && e.revision === turn.revision,
                  );
                  return (
                    <details
                      className="panel turn-review"
                      key={turn.id}
                      id={`turn-${turn.id}`}
                      open={index === 0}
                    >
                      <summary>
                        <span className="review-number">
                          {String(turn.main_question_index).padStart(2, '0')}
                          {turn.follow_up_index ? <small>.{turn.follow_up_index}</small> : null}
                        </span>
                        <span>
                          {turn.text}
                          <small>
                            {turn.follow_up_index ? '连续追问' : '主问题'} · 回答 v{turn.revision}
                          </small>
                        </span>
                        <ChevronDown size={17} />
                      </summary>
                      <div className="turn-review-body">
                        {report.answer_sources
                          ?.filter((source) => source.turn.id === turn.id)
                          .map((source) => (
                            <div className="notice" key={source.retry_interview_id}>
                              <p>
                                本题采用最新完成的重练回答。
                                <Link href={`/reports/${source.retry_interview_id}`}>
                                  查看本次重练报告
                                </Link>
                              </p>
                              <details>
                                <summary>查看首次回答</summary>
                                <p>
                                  {
                                    data.originalInterview.turns.find(
                                      (t) => t.id === source.original_turn_id,
                                    )?.answer_text
                                  }
                                </p>
                              </details>
                              <Link href="/me/interviews">查看历次面试与重练记录</Link>
                            </div>
                          ))}
                        {turn.answer_status === 'answered' ? (
                          <>
                            <details className="live-answer report-original-answer">
                              <summary>
                                查看你的原回答 · v{turn.revision}（{turn.answer_text?.length ?? 0}{' '}
                                字）
                              </summary>
                              <p>{turn.answer_text}</p>
                            </details>
                            {evaluation && (
                              <>
                                <IndicatorRatings evaluation={evaluation} />
                                <h3>已说明的内容</h3>
                                {evaluation.strengths.length ? (
                                  <Findings items={evaluation.strengths} />
                                ) : (
                                  <p>暂无足够依据归纳亮点。</p>
                                )}
                                <h3>可改进的缺口</h3>
                                {evaluation.gaps.length ? (
                                  <Findings items={evaluation.gaps} />
                                ) : (
                                  <p>本题未识别到有证据支持的明确缺口。</p>
                                )}
                                <h3>参考要点</h3>
                                <ul>
                                  {evaluation.reference_points.map((point, i) => (
                                    <li key={i}>{point}</li>
                                  ))}
                                </ul>
                                <p>重练目标：{evaluation.retry_goal}</p>
                                <ul>
                                  {evaluation.limitations.map((l, i) => (
                                    <li key={i}>{l}</li>
                                  ))}
                                </ul>
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
                          </>
                        ) : (
                          <p>
                            {turn.answer_status === 'skipped'
                              ? '已跳过，不进行能力评估。'
                              : '未提交回答，不进行能力评估。'}
                          </p>
                        )}
                      </div>
                    </details>
                  );
                })}
              </div>
            </div>
            <div
              id="compare-panel"
              role="tabpanel"
              aria-labelledby="compare-tab"
              hidden={tab !== 'compare'}
            >
              <section className="panel comparison-panel">
                <h2>同一道题，两次回答</h2>
                {interview.parent_interview_id && retryTurn && (
                  <button
                    className="live-button"
                    disabled={command.blocked}
                    onClick={() =>
                      command.run(
                        (key) =>
                          interviewsApi.compare(
                            {
                              original_interview_id: interview.parent_interview_id!,
                              retry_interview_id: interview.id,
                              original_turn_id: interview.parent_turn_id!,
                              retry_turn_id: retryTurn.id,
                              original_revision: interview.parent_revision!,
                              retry_revision: retryTurn.revision,
                            },
                            key,
                          ),
                        (result) =>
                          router.replace(`/reports/${id}/practice?comparison=${result.id}`),
                      )
                    }
                  >
                    比较原回答与本次重练
                  </button>
                )}
                {interview.parent_interview_id && (
                  <p>
                    <Link href={`/reports/${interview.parent_interview_id}`}>查看原场面试报告</Link>
                  </p>
                )}
                {!interview.parent_interview_id && !comparisonId && (
                  <p>从逐题复盘中选择一道题重练。完成后，进入重练报告生成前后对比。</p>
                )}
                {comparisonId && <Comparison key={comparisonId} id={comparisonId} />}
              </section>
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
