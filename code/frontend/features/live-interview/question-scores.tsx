'use client';
import { useState } from 'react';
import Link from 'next/link';
import {
  FEEDBACK_DIMENSIONS,
  isQuestionScoringVersion,
  type FeedbackAssessment,
  type InterviewReport,
} from '@interviewlab/core';

export function QuestionScorecard({
  score,
  assessments,
}: {
  score: number;
  assessments: FeedbackAssessment[];
}) {
  return (
    <section className="question-scorecard">
      <h3>
        本题得分 <strong>{Math.round(score)} / 100</strong>
      </h3>
      <div className="question-dimension-section">
        <h3>维度表现</h3>
        <div className="template-score-table">
          <table>
            <thead>
              <tr>
                <th>维度</th>
                <th>得分</th>
                <th>评分理由</th>
              </tr>
            </thead>
            <tbody>
              {FEEDBACK_DIMENSIONS.map((d) => {
                const a = assessments.find((a) => a.dimension === d.key);
                if (!a) return null;
                return (
                  <tr key={d.key}>
                    <th>{d.short}</th>
                    <td>{Math.round(a.score)}</td>
                    <td>{a.text}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
export function PracticeHistory({
  report,
  turnIds,
  originalId,
}: {
  report: InterviewReport;
  turnIds?: string[];
  originalId: string;
}) {
  const [dimension, setDimension] = useState('total');
  const filtered = (report.practice_history ?? []).filter(
    (e) => !turnIds || turnIds.includes(e.original_turn_id),
  );
  const entries = [...new Map(filtered.map((e) => [e.interview_id, e])).values()];
  if (!entries.length) return null;
  const referenceVersion =
    entries.find((e) => e.interview_id === originalId)?.scoring_version ??
    report.question_scoring_version;
  const points = entries.map((e) => ({
    ...e,
    value:
      !isQuestionScoringVersion(e.scoring_version ?? undefined) ||
      e.scoring_version !== referenceVersion
        ? null
        : dimension === 'total'
          ? e.score
          : (e.assessments.find((a) => a.dimension === dimension)?.score ?? null),
  }));
  const practiceNumber = (i: number) =>
    points.slice(0, i + 1).filter((e) => e.interview_id !== originalId).length;
  const comparable = points.filter((e) => e.value !== null);
  const first = comparable[0],
    last = comparable.at(-1),
    previous = comparable.at(-2);
  const delta = (n: number) => `${n > 0 ? '+' : ''}${Math.round(n * 10) / 10}`;
  const x = (i: number) => 45 + (i * 510) / Math.max(points.length - 1, 1),
    y = (score: number) => 170 - score * 1.4;
  return (
    <section className="practice-history">
      <h3>本题练习记录</h3>
      {entries.length > 1 && (
        <label>
          查看走势{' '}
          <select value={dimension} onChange={(e) => setDimension(e.target.value)}>
            <option value="total">本题总分</option>
            {FEEDBACK_DIMENSIONS.map((d) => (
              <option key={d.key} value={d.key}>
                {d.short}
              </option>
            ))}
          </select>
        </label>
      )}
      {last && previous && (
        <p>
          比首条同标准记录 {delta(last.value! - first.value!)} 分 · 比上次{' '}
          {delta(last.value! - previous.value!)} 分
        </p>
      )}
      {comparable.length > 1 && (
        <svg
          viewBox="0 0 600 210"
          className="practice-trend"
          role="img"
          aria-label="历次练习分数变化，纵轴0至100分"
        >
          {[0, 25, 50, 75, 100].map((n) => (
            <g key={n}>
              <line x1="35" x2="570" y1={y(n)} y2={y(n)} stroke="#dce5e7" />
              <text x="5" y={y(n) + 4}>
                {n}
              </text>
            </g>
          ))}
          {points.map((e, i) =>
            e.value === null ? null : (
              <g key={e.interview_id}>
                {i > 0 && points[i - 1].value !== null && (
                  <line
                    x1={x(i - 1)}
                    y1={y(points[i - 1].value!)}
                    x2={x(i)}
                    y2={y(e.value)}
                    stroke="#ed9369"
                    strokeWidth="3"
                  />
                )}
                <circle cx={x(i)} cy={y(e.value)} r="5" fill="#ed9369" />
                <text x={x(i)} y={y(e.value) - 12} textAnchor="middle">
                  {Math.round(e.value)}
                </text>
                <text x={x(i)} y="198" textAnchor="middle">
                  {e.interview_id === originalId ? '首次' : `重练${practiceNumber(i)}`}
                </text>
              </g>
            ),
          )}
        </svg>
      )}
      <ol>
        {points.map((e, i) => (
          <li key={e.interview_id}>
            <Link
              href={`/reports/${e.interview_id}${e.interview_id === originalId ? '/practice' : ''}`}
            >
              {e.interview_id === originalId ? '首次回答' : `第${practiceNumber(i)}次重练`}
            </Link>{' '}
            ·{' '}
            {e.value === null
              ? e.scoring_version &&
                (!isQuestionScoringVersion(e.scoring_version ?? undefined) ||
                  e.scoring_version !== referenceVersion)
                ? '历史评分标准，不参与对比'
                : e.status === 'failed'
                  ? '评分失败'
                  : '评分生成中'
              : `${Math.round(e.value)}分`}
            {e.ended_at && <small> · {new Date(e.ended_at).toLocaleString('zh-CN')}</small>}
          </li>
        ))}
      </ol>
      <p>同一评分标准下比较；重练不会改变原面试报告。</p>
    </section>
  );
}
