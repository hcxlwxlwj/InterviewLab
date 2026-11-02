'use client';
import {
  REPORT_RUBRIC,
  REPORT_INDICATORS,
  DIMENSION_LABELS,
  type InterviewEvaluation,
} from '@interviewlab/core';

export function ScoringStandard({
  current,
  busy,
  upgrade,
}: {
  current: boolean;
  busy: boolean;
  upgrade: () => void;
}) {
  return (
    <section className="panel report-standard" aria-label="评分标准与行为锚点">
      <h2>{REPORT_RUBRIC.title}</h2>
      <p>
        标准版本：<code>{REPORT_RUBRIC.version}</code> · 专家审核待完成 · 人工校准待完成
      </p>
      <p>{REPORT_RUBRIC.scope}</p>
      {!current && (
        <div>
          <p>
            当前报告尚未完整采用本标准。重新评分会基于已保存回答生成新版本，保留原回答，不重新面试。
          </p>
          <button className="live-button" disabled={busy} onClick={upgrade}>
            按行为锚定标准重新评分
          </button>
        </div>
      )}
      <details>
        <summary>查看评分规则、指标档位与示例</summary>
        <ul>
          {REPORT_RUBRIC.rules.map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
        </ul>
        {REPORT_INDICATORS.map((indicator) => (
          <details className="report-rubric-indicator" key={indicator.id}>
            <summary>
              {indicator.title} · {DIMENSION_LABELS[indicator.dimension]}
            </summary>
            <p>适用范围：{indicator.applies_when}</p>
            <ol start={0}>
              {indicator.anchors.map((anchor, level) => (
                <li key={level}>
                  <strong>{level} 档：</strong>
                  {anchor}
                </li>
              ))}
            </ol>
            <p>示例问题：{indicator.example.question}</p>
            <blockquote>{indicator.example.answer}</blockquote>
            <p>
              示例对应 {indicator.example.level} 档：{indicator.example.explanation}
            </p>
          </details>
        ))}
        <h3>方法来源与使用范围</h3>
        <ul>
          {REPORT_RUBRIC.methods.map((source) => (
            <li key={source.name}>
              <a href={source.url} target="_blank" rel="noreferrer">
                {source.name}
              </a>
              ：{source.role}
            </li>
          ))}
        </ul>
        <p>借鉴公开方法，由平台编写岗位指标；不表示获得上述机构认证。STAR 仅作回答组织建议。</p>
      </details>
    </section>
  );
}

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
            {rating.evidence_refs.length > 0 && (
              <details>
                <summary>查看评分原文依据</summary>
                {rating.evidence_refs.map((ref, index) => (
                  <blockquote key={index}>
                    回答 v{ref.revision}：“{ref.quote}”
                  </blockquote>
                ))}
              </details>
            )}
          </article>
        );
      })}
    </section>
  );
}
