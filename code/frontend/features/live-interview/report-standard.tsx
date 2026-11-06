'use client';
import { REPORT_INDICATORS, type InterviewEvaluation } from '@interviewlab/core';

export function IndicatorRatings({ evaluation }: { evaluation: InterviewEvaluation }) {
  if (!evaluation.indicator_assessments) return null;
  return (
    <section className="report-indicator-ratings" aria-label="本题指标评分">
      <h3>本题行为指标</h3>
      <p>标准：{evaluation.scoring_rubric_version} · 未列出的指标不属于本题评分范围。</p>
      {evaluation.indicator_assessments.map((rating) => {
        const indicator = REPORT_INDICATORS.find((i) => i.id === rating.indicator_id);
        return (
          <article key={rating.indicator_id}>
            <h4>
              {indicator?.title ?? rating.indicator_id} ·{' '}
              {rating.level === null ? '未观察' : `${rating.level} / 4 档`}
            </h4>
            <p>{rating.text}</p>
            {rating.level !== null && (
              <p className="report-anchor">对应锚点：{indicator?.anchors[rating.level]}</p>
            )}
          </article>
        );
      })}
    </section>
  );
}
