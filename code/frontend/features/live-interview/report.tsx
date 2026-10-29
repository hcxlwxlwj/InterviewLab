'use client';
import Link from 'next/link';
import { useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  DIMENSION_LABELS,
  type InterviewEvidence,
  type InterviewFinding,
} from '@interviewlab/core';
import { Loading } from '../../components/shared';
import { ApiClientError } from '../../lib/api/http';
import { interviewsApi } from '../../lib/api/interviews';
import { CommandNotice, ErrorNotice, LiveFrame, useLiveCommand, useLiveResource } from './common';

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
          <a href={`#turn-${ref.turn_id}`}>定位回答 v{ref.revision}</a>
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
  const search = useSearchParams();
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
      <ErrorNotice message={resource.error} retry={() => void resource.refresh()} />
      <CommandNotice command={command} refresh={() => void resource.refresh()} />
      <section className="panel">
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
          文字面试 · {interview.configuration.duration_minutes} 分钟配置 ·{' '}
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
        {report.evaluations.length > 0 && (
          <section className="report-score-panel" aria-label="能力评分概览">
            <div className="report-score-heading">
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
            <div className="live-dimensions report-score-dimensions">
              {Object.entries(report.dimensions).map(([key, d]) => (
                <article key={key}>
                  <div className="report-dimension-heading">
                    <h3>{DIMENSION_LABELS[key as keyof typeof DIMENSION_LABELS]}</h3>
                    <strong>
                      {d.score !== null ? d.score : d.status === 'observed' ? '待评分' : '未观察'}
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
              <p>
                AI 根据已校验的逐题评价选择 0–4 档：0 为明显偏题或关键错误，1 为关键内容缺失，2
                为基本回应但有明显缺口，3 为清晰且有依据、仍有次要缺口，4
                为在题目要求范围内充分且边界清楚。档位乘以 25
                得到维度分数，总分为已评分维度的平均值四舍五入。
              </p>
              <p>
                专业知识看原理与推理，项目表达看个人职责和行动，逻辑表达看切题与组织。未观察维度不计入总分；没有代码考核时不评代码能力。这是未经人工校准的
                AI 参考评分，不代表招聘结论。
              </p>
            </details>
            {!reportPending &&
              report.summary_status === 'ready' &&
              report.summary?.dimension_assessments === undefined && (
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
                  生成 AI 参考评分
                </button>
              )}
          </section>
        )}
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
      </section>
      {(report.summary || (report.analysis_progress?.total ?? report.evaluations.length) > 0) && (
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
                    <a className="live-button secondary" href={`#turn-${item.turn_id}`}>
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
      <section className="panel">
        <h2>逐题复盘</h2>
        <nav aria-label="按主问题浏览">
          {interview.turns
            .filter((t) => !t.follow_up_index)
            .map((turn) => (
              <p key={turn.id}>
                <a href={`#turn-${turn.id}`}>
                  主问题 {turn.main_question_index}：{turn.text}
                </a>
              </p>
            ))}
        </nav>
      </section>
      {interview.turns.map((turn) => {
        const evaluation = report.evaluations.find(
          (e) => e.turn_id === turn.id && e.revision === turn.revision,
        );
        return (
          <article className="panel" key={turn.id} id={`turn-${turn.id}`}>
            <span className="eyebrow">
              主问题 {turn.main_question_index}
              {turn.follow_up_index ? ` · 追问 ${turn.follow_up_index}` : ''}
            </span>
            <h2>{turn.text}</h2>
            {turn.answer_status === 'answered' ? (
              <>
                <details className="live-answer report-original-answer">
                  <summary>
                    查看你的原回答 · v{turn.revision}（{turn.answer_text?.length ?? 0} 字）
                  </summary>
                  <p>{turn.answer_text}</p>
                </details>
                {evaluation && (
                  <>
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
                            goal: evaluation?.retry_goal ?? '围绕原题补充本人行动及验证依据',
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
          </article>
        );
      })}
      {comparisonId && <Comparison key={comparisonId} id={comparisonId} />}
    </>
  );
}
export default function LiveReport({ id }: { id: string }) {
  return (
    <LiveFrame title="面试复盘">
      <ReportBody key={id} id={id} />
    </LiveFrame>
  );
}
