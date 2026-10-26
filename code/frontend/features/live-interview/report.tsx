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
import { interviewsApi } from '../../lib/api/interviews';
import { CommandNotice, ErrorNotice, LiveFrame, useLiveCommand, useLiveResource } from './common';

function Evidence({ refs }: { refs: InterviewEvidence[] }) {
  return (
    <>
      {refs.map((ref, i) => (
        <blockquote className="live-evidence" key={`${ref.turn_id}:${i}`}>
          <a href={`#turn-${ref.turn_id}`}>回答 v{ref.revision}</a>：“{ref.quote}”
        </blockquote>
      ))}
    </>
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
      const report = ['completed', 'failed'].includes(interview.status)
        ? await interviewsApi.report(id, signal)
        : null;
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
  if (!report)
    return (
      <section className="panel">
        <h2>面试尚未结束</h2>
        <p>结束后再提供复盘，进行中不展示参考答案或评价。</p>
        <Link className="live-button" href={`/interview/${id}`}>
          返回面试
        </Link>
      </section>
    );
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
            {reportPending ? '复盘生成中' : report.is_partial ? '部分复盘' : '面后复盘'}
          </span>
          <span>未校准数值评分</span>
        </div>
        <p>{report.coverage}</p>
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
        {report.status === 'ready' && (
          <div className="live-dimensions">
            {Object.entries(report.dimensions).map(([key, d]) => (
              <article key={key}>
                <h3>{DIMENSION_LABELS[key as keyof typeof DIMENSION_LABELS]}</h3>
                <strong>{d.status === 'observed' ? '已观察 · 暂不评分' : '未观察'}</strong>
                <p>{d.explanation}</p>
              </article>
            ))}
          </div>
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
                <div className="live-answer">
                  <h3>你的回答 · v{turn.revision}</h3>
                  <p>{turn.answer_text}</p>
                </div>
                {evaluation && (
                  <>
                    <h3>已说明的内容</h3>
                    <Findings items={evaluation.strengths} />
                    <h3>可改进的缺口</h3>
                    <Findings items={evaluation.gaps} />
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
