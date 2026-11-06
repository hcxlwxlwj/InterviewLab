'use client';

import {
  reportFeedback,
  feedbackScore,
  HR_SCORING_VERSION,
  type QuestionScore,
  FEEDBACK_DIMENSIONS,
  type InterviewReport,
  type InterviewEvaluation,
} from '@interviewlab/core';

export function TotalScore({ score, coverage = 100 }: { score: number | null; coverage?: number }) {
  return (
    <div className="report-total" aria-label={`综合得分：${score ?? '尚未评分'}`}>
      <div className="report-total-ring">
        <svg viewBox="0 0 100 100" aria-hidden="true">
          <circle cx="50" cy="50" r="43" />
          <circle
            className="report-total-value"
            cx="50"
            cy="50"
            r="43"
            pathLength="100"
            strokeDasharray={`${score ?? 0} 100`}
          />
        </svg>
        <span>
          <strong>{score ?? '—'}</strong>
          <small>/ 100</small>
        </span>
      </div>
      <div>
        <b>综合得分</b>
        <small>
          {score === null
            ? '评分正在生成或暂无评价依据'
            : coverage < 100
              ? `部分参考分 · 已评价权重 ${coverage}/100`
              : 'AI 参考 · 未经人工校准'}
        </small>
      </div>
    </div>
  );
}

export function ReportDistribution({ report }: { report: InterviewReport }) {
  const strengths = report.summary?.strengths.length ?? 0;
  const gaps = report.summary?.improvements.length ?? 0;
  return (
    <div className="report-distribution">
      <b>表现概览</b>
      <div
        className="report-distribution-bar"
        aria-label={`主要优势 ${strengths} 项，优先提升 ${gaps} 项`}
      >
        <span style={{ flex: Math.max(strengths, 1) }}>主要优势 {strengths} 项</span>
        <span style={{ flex: Math.max(gaps, 1) }}>优先提升 {gaps} 项</span>
      </div>
      <b>已分析 {report.evaluations.length} 题</b>
    </div>
  );
}

export function AbilityRadar({
  feedback,
  pending = false,
  assessments,
}: {
  assessments?: import('@interviewlab/core').FeedbackAssessment[];
  feedback: InterviewReport['summary'];
  pending?: boolean;
}) {
  if (pending && !feedback?.feedback_template && !assessments?.length)
    return (
      <div className="radar-pending" role="status">
        <strong>能力画像正在整理</strong>
        <p>先分析回答，再生成六维评分。尚未生成评分不代表没有观察到能力。</p>
      </div>
    );
  const dimensions = Object.fromEntries(
    FEEDBACK_DIMENSIONS.map((d) => {
      const a = (assessments ?? feedback?.feedback_template?.assessments)?.find(
        (a) => a.dimension === d.key,
      );
      return [d.key, { score: a?.score ?? null }];
    }),
  );
  const labels = Object.fromEntries(FEEDBACK_DIMENSIONS.map((d) => [d.key, d.short]));
  const entries = Object.entries(dimensions).filter(([, d]) => d.score !== null);
  if (!entries.length) return <p className="radar-pending">本场暂无已考察的能力维度。</p>;
  if (entries.length < 3)
    return (
      <div className="ability-chips" role="img" aria-label="已考察维度评分条形图">
        {entries.map(([key, d]) => (
          <div key={key}>
            <span>{labels[key]}</span>
            <meter min={0} max={100} value={d.score!} aria-label={labels[key]} />
            <strong>{Math.round(d.score!)} / 100</strong>
          </div>
        ))}
      </div>
    );
  const point = (index: number, radius: number) => {
    const angle = (index * Math.PI * 2) / entries.length - Math.PI / 2;
    return [260 + Math.cos(angle) * radius, 190 + Math.sin(angle) * radius];
  };
  const observed = entries.flatMap(([, d], index) =>
    d.score === null ? [] : [{ index, score: d.score }],
  );
  return (
    <>
      <svg
        className="ability-radar"
        viewBox="0 0 520 380"
        role="img"
        aria-label={`能力雷达图：${entries.map(([key, d]) => `${labels[key]}${d.score === null ? '尚未生成' : `${d.score} 分`}`).join('，')}`}
      >
        {[25, 50, 75, 100].map((level) => (
          <polygon
            key={level}
            className="radar-grid"
            points={entries.map((_, i) => point(i, level * 1.2).join(',')).join(' ')}
          />
        ))}
        {entries.map(([key], i) => (
          <line
            key={key}
            className="radar-grid"
            x1="260"
            y1="190"
            x2={point(i, 120)[0]}
            y2={point(i, 120)[1]}
          />
        ))}
        {observed.length === entries.length && (
          <polygon
            className="radar-area"
            points={observed
              .map(({ index, score }) => point(index, score * 1.2).join(','))
              .join(' ')}
          />
        )}
        {observed.map(({ index, score }) => (
          <g key={index}>
            {observed.length !== entries.length && (
              <line
                className="radar-spoke"
                x1="260"
                y1="190"
                x2={point(index, score * 1.2)[0]}
                y2={point(index, score * 1.2)[1]}
              />
            )}
            <circle
              className="radar-point"
              cx={point(index, score * 1.2)[0]}
              cy={point(index, score * 1.2)[1]}
              r="5"
            />
          </g>
        ))}
        {entries.map(([key, d], i) => {
          const [x, y] = point(i, 162);
          return (
            <text key={key} x={x} y={y} textAnchor="middle" dominantBaseline="middle">
              {labels[key]}
              <tspan x={x} dy="22" className="radar-label-score">
                {d.score ?? '尚未生成'}
              </tspan>
            </text>
          );
        })}
      </svg>
      <p className="radar-caption">图中仅展示已考察维度。评分反映本场回答表现，未考察不补零。</p>
      <div className="ability-chips">
        {entries.map(([key, d]) => (
          <div key={key}>
            <span>{labels[key]}</span>
            <strong>{d.score ?? '尚未生成'}</strong>
          </div>
        ))}
      </div>
    </>
  );
}

export function QuestionCoverage({
  turns,
  evaluations,
  onSelect,
  pending = false,
  failedIds = [],
  scores = [],
}: {
  turns: {
    id: string;
    main_question_index: number;
    follow_up_index: number;
    revision: number;
    answer_status: string;
  }[];
  evaluations: InterviewEvaluation[];
  scores?: QuestionScore[];
  pending?: boolean;
  failedIds?: string[];
  onSelect: (id: string) => void;
}) {
  if (!turns.length) return null;
  const groups = [
    ...new Map(
      turns.map((t) => [
        t.main_question_index,
        turns.find((v) => v.main_question_index === t.main_question_index)!,
      ]),
    ).values(),
  ];
  return (
    <section className="panel question-coverage">
      <h2>逐题得分</h2>
      <p>0–100分；每题合并主问题与追问评价，点击查看得分依据。</p>
      <div className="question-chart" role="group" aria-label="按题目查看分析详情">
        {groups.map((turn) => {
          const evaluation = evaluations.find(
            (e) => e.turn_id === turn.id && e.revision === turn.revision,
          );
          const score = scores.find(
            (s) => s.main_question_index === turn.main_question_index,
          )?.score;
          const state =
            score !== undefined
              ? `${Math.round(score)} 分`
              : evaluation
                ? evaluation.question_scoring_version === HR_SCORING_VERSION
                  ? '本题未考察能力'
                  : '历史报告无单题分'
                : turn.answer_status === 'answered'
                  ? failedIds.includes(turn.id)
                    ? '分析失败'
                    : pending
                      ? '分析中'
                      : '尚未分析'
                  : '未作答';
          return (
            <button
              key={turn.id}
              onClick={() => onSelect(turn.id)}
              aria-label={`第 ${turn.main_question_index} 题${turn.follow_up_index ? `追问 ${turn.follow_up_index}` : ''}，${state}`}
            >
              <span className="question-chart-track">
                <span
                  className={`question-chart-bar ${score !== undefined ? '' : 'unscored'}`}
                  style={{ height: `${score ?? 0}%` }}
                />
                <strong>{state}</strong>
              </span>
              <span>
                第 {turn.main_question_index} 题
                {turn.follow_up_index ? ` · 追问 ${turn.follow_up_index}` : ''}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

export function FeedbackScoreTable({ report }: { report: InterviewReport }) {
  const feedback = reportFeedback(report);
  const total = { ...feedbackScore(feedback), score: report.overall_score };
  return (
    <section className="template-score-summary">
      <h3>五、评分汇总</h3>
      <div className="template-score-table">
        <table>
          <thead>
            <tr>
              <th>评价维度</th>
              <th>权重</th>
              <th>得分</th>
              <th>评分依据（具体行为）</th>
            </tr>
          </thead>
          <tbody>
            {FEEDBACK_DIMENSIONS.map((d) => {
              const a = feedback?.assessments.find((a) => a.dimension === d.key);
              return (
                <tr key={d.key}>
                  <th scope="row">{d.label}</th>
                  <td>{d.weight}</td>
                  <td>
                    {a?.score == null
                      ? report.question_scoring_version === HR_SCORING_VERSION
                        ? '未考察'
                        : '尚未生成'
                      : `${Math.round(((a.score * d.weight) / 100) * 10) / 10} / ${d.weight}`}
                  </td>
                  <td>
                    {a?.text ??
                      (report.question_scoring_version === HR_SCORING_VERSION
                        ? '本场未考察，不计入总分。'
                        : '评分正在生成。')}
                    {!!a?.evidence_refs.length && (
                      <details className="report-evidence">
                        <summary>查看评分依据</summary>
                        {a.evidence_refs.map((r, i) => (
                          <blockquote key={i}>
                            回答 v{r.revision}：“{r.quote}”
                          </blockquote>
                        ))}
                      </details>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p>
        {total.score === null
          ? `暂无已评价维度，暂不计算综合分。`
          : `综合参考分 ${total.score} / 100${total.coverage < 100 ? `（按已评价权重 ${total.coverage}/100 归一化）` : ''}`}
      </p>
      <p className="radar-caption">
        维度分按百分制绘图，按 25 / 25 / 25 / 15 / 5 / 5
        加权。专业、业务、综合面保留六维；HR仅按已考察维度计分。AI 参考评分不代表招聘结论。
      </p>
    </section>
  );
}
