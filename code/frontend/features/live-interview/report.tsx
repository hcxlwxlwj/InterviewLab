'use client';
import Link from 'next/link';
import { ScoringStandard, IndicatorRatings } from './report-standard';
import { printReport } from './report-export';
import { useCallback, useState } from 'react';
import { ChevronDown, FileText, ArrowLeftRight, RotateCcw, Info } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  DIMENSION_LABELS,
  FRONTEND_RUBRIC_VERSION,
  type InterviewEvidence,
  type InterviewFinding,
} from '@interviewlab/core';
import { Breadcrumb, Footer, Header, Loading } from '../../components/shared';
import { ApiClientError } from '../../lib/api/http';
import { interviewsApi } from '../../lib/api/interviews';
import { CommandNotice, ErrorNotice, SessionGate, useLiveCommand, useLiveResource } from './common';

function revealAnswer(turnId: string) {
  document.getElementById('review-tab')?.click();
  const target = document.getElementById(`turn-${turnId}`);
  if (target instanceof HTMLDetailsElement) target.open = true;
  requestAnimationFrame(() => target?.scrollIntoView({ block: 'start' }));
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
function ReportBody({ id }: { id: string }) {
  const router = useRouter();
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  const search = useSearchParams();
  const [tab, setTab] = useState<'review' | 'compare'>(
    search.has('comparison') ? 'compare' : 'review',
  );
  const load = useCallback(
    async (signal: AbortSignal) => {
      const interview = await interviewsApi.read(id, signal);
      let report = null;
      if (['completed', 'failed'].includes(interview.status)) {
        try {
          report = await interviewsApi.report(id, signal);
        } catch (e) {
          if (!(e instanceof ApiClientError && e.status === 404)) throw e;
        }
      }
      return { interview, report };
    },
    [id],
  );
  const resource = useLiveResource(load, (v) =>
    Boolean(v.report && ['pending', 'generating'].includes(v.report.status)),
  );
  const data = resource.value;
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
                (result) => resource.accept({ interview, report: result }),
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
  const reportPending = ['pending', 'generating'].includes(report.status);
  return (
    <>
      <div className="page-heading report-page-heading">
        <div>
          <h1>每一次复盘，都有下一步</h1>
          <p>{interview.job_title} · 本场面试分析报告</p>
        </div>
        <div className="page-actions">
          <Button variant="outline" size="sm" asChild>
            <Link href="/me/interviews">
              <FileText size={14} />
              查看记录
            </Link>
          </Button>
          <Button size="sm" asChild>
            <Link href={`/interview/setup?job=${encodeURIComponent(interview.configuration.job)}`}>
              <RotateCcw size={14} />
              重新面试
            </Link>
          </Button>
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
            {report.scoring_status === 'experimental' ? 'AI 参考评分 · 未经人工校准' : '证据复盘'}
          </span>
        </div>
        <p>
          {
            { text_fallback: '文字面试', realtime_voice: '语音面试', realtime_video: '视频面试' }[
              interview.configuration.interaction_mode
            ]
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
            : '未记录'} ·{' '}
          {{ completed: '正常完成', user_finished: '提前结束', hard_deadline: '达到时间上限' }[
            interview.end_reason as 'completed'
          ] ?? '面试已结束'}
        </p>

        {report.analysis_progress && (
          <p role="status" aria-live="polite">
            有效回答 {report.analysis_progress.total} 题 · 已分析{' '}
            {report.analysis_progress.completed} 题 · 待处理 {report.analysis_progress.pending} 题 ·
            失败 {report.analysis_progress.failed} 题
          </p>
        )}
        {report.analysis_progress?.total === 0 && (
          <p>没有有效回答，仅保存面试记录，不作能力评价。</p>
        )}
        {reportPending && <p role="status">回答已保存，正在逐题整理复盘，可以稍后从记录中回来。</p>}
        {!reportPending && (report.status === 'failed' || report.missing_turn_ids.length > 0) && (
          <>
            <p>部分分析未生成，重试不会重新进行面试。</p>
            <button
              className="live-button"
              disabled={command.blocked}
              onClick={() =>
                command.run(
                  (key) => interviewsApi.retryReport(id, report.version, key),
                  (result) => resource.accept({ interview, report: result }),
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
              report.evaluations.every((e) => e.scoring_rubric_version === FRONTEND_RUBRIC_VERSION)
            }
            busy={
              command.blocked ||
              reportPending ||
              !interview.turns.some((t) => t.answer_status === 'answered')
            }
            upgrade={() =>
              command.run(
                (key) => interviewsApi.retryReport(id, report.version, key, 'rubric'),
                (result) => resource.accept({ interview, report: result }),
              )
            }
          />
        )}
      <div className="report-grid">
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
                                        evaluation?.retry_goal ?? '围绕原题补充本人行动及验证依据',
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
                      (result) => router.replace(`/reports/${id}?comparison=${result.id}`),
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
        <aside className="report-sidebar">
          {report.evaluations.length > 0 && (
            <section className="panel score-panel" aria-label="能力评分概览">
              <div className="score-summary">
                <div>
                  <h3>AI 参考总分</h3>
                  <strong className="report-score-total">{report.overall_score ?? '—'}</strong>
                  {report.overall_score !== null && <span> / 100</span>}
                </div>
                <p>
                  {report.overall_score === null
                    ? '尚未生成参考评分'
                    : `按 ${Object.values(report.dimensions).filter((d) => d.score !== null).length} 个已评分维度等权平均`}
                  <br />
                  {report.is_partial
                    ? '当前为部分复盘，仅反映已成功分析的内容。'
                    : '仅反映本场已观察的回答内容。'}
                </p>
              </div>
              <div className="score-dimensions">
                {Object.entries(report.dimensions).map(([key, d]) => (
                  <article className="dimension" key={key}>
                    <div className="report-dimension-heading">
                      <h3>{DIMENSION_LABELS[key as keyof typeof DIMENSION_LABELS]}</h3>
                      <strong>
                        {d.score !== null
                          ? d.score
                          : d.status === 'observed'
                            ? report.summary_status === 'failed'
                              ? '评分失败，可重试'
                              : reportPending
                                ? '评分生成中'
                                : '尚未评分'
                            : '未观察'}
                      </strong>
                    </div>
                    <progress
                      className="report-score-bar"
                      max={100}
                      value={d.score ?? 0}
                      aria-label={`${DIMENSION_LABELS[key as keyof typeof DIMENSION_LABELS]}${d.score === null ? '未评分' : `${d.score} 分`}`}
                    />
                    <p>{d.explanation}</p>
                    <Evidence refs={d.evidence_refs} />
                  </article>
                ))}
              </div>
              <details className="report-scoring-rules">
                <summary>评分如何计算？</summary>
                {report.analysis_metadata?.scoring_rubric_version === FRONTEND_RUBRIC_VERSION ? (
                  <p>
                    本报告采用 {FRONTEND_RUBRIC_VERSION}：AI 按本题适用指标选择 0–4
                    档并关联原文证据；程序先对同一指标各回合取平均，再对维度内已观察指标等权平均。维度分换算为百分制并四舍五入，总分为已评分维度等权平均。重复追问不增加指标权重，未观察项不补零。完整锚点与示例见上方评分标准。
                  </p>
                ) : (
                  <p>
                    AI 根据已校验的逐题评价选择 0–4 档：0 为明显偏题或关键错误，1 为关键内容缺失，2
                    为基本回应但有明显缺口，3 为清晰且有依据、仍有次要缺口，4
                    为在题目要求范围内充分且边界清楚。档位乘以 25
                    得到维度分数，总分为已评分维度的平均值四舍五入。这是历史综合评分规则，可在上方显式升级至行为锚定标准。
                  </p>
                )}
                <p>
                  专业知识看原理与推理，项目表达看个人职责和行动，逻辑表达看切题与组织。未观察维度不计入总分；没有代码考核时不评代码能力。这是未经人工校准的
                  AI 参考评分，不代表招聘结论。
                </p>
              </details>
              {!reportPending &&
                report.summary_status === 'ready' &&
                report.overall_score === null && (
                  <button
                    className="live-button"
                    disabled={command.blocked}
                    onClick={() =>
                      command.run(
                        (key) => interviewsApi.retryReport(id, report.version, key, 'summary'),
                        (result) => resource.accept({ interview, report: result }),
                      )
                    }
                  >
                    重新生成总结与参考评分
                  </button>
                )}
            </section>
          )}
          {(report.summary ||
            (report.analysis_progress?.total ?? report.evaluations.length) > 0) && (
            <section className="panel" aria-label="整场总结">
              <h2>整场总结</h2>
              {report.summary ? (
                <>
                  <Findings items={[report.summary.overview]} />
                  <h3>主要优势</h3>
                  {report.summary.strengths.length ? (
                    <Findings items={report.summary.strengths} />
                  ) : (
                    <p>本次没有足够依据归纳整场优势，可查看逐题分析。</p>
                  )}
                  <h3>优先练习目标</h3>
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
                          查看原题并重练
                        </a>
                      </article>
                    ))
                  ) : (
                    <p>没有需要优先列出的已确认缺口，不强行生成练习目标。</p>
                  )}
                  <h3>分析范围与局限</h3>
                  <ul>
                    {report.summary.limitations.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
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
                        (result) => resource.accept({ interview, report: result }),
                      )
                    }
                  >
                    {report.summary_status === 'failed' ? '重试整场总结' : '生成整场总结'}
                  </button>
                )}
            </section>
          )}

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
        </aside>
      </div>
    </>
  );
}
export default function LiveReport({ id }: { id: string }) {
  return (
    <>
      <Header />
      <main className="container page-body real-report-page" id="main-content">
        <Breadcrumb items={['我的面试', '分析报告']} />
        <SessionGate>
          <ReportBody key={id} id={id} />
        </SessionGate>
      </main>
      <Footer />
    </>
  );
}
