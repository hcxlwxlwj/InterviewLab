'use client';

import { ArrowUpRight, CheckCircle2, Sparkles, Target, Flag } from 'lucide-react';
import { type InterviewReport } from '@interviewlab/core';

export function ReportInsights({
  report,
  onSelect,
}: {
  report: InterviewReport;
  onSelect: (turnId: string) => void;
}) {
  const summary = report.summary;
  if (!summary) return null;
  const actions = summary.feedback_template.action_plan;
  const steps = actions.length
    ? actions.map((a) => ({ action: a.action, acceptance: a.acceptance, turn: a.turn_id }))
    : [...new Set(report.next_steps ?? [])].filter(Boolean).map((text) => {
        const [action, ...acceptance] = text.split(/[；;]\s*验收[：:]\s*/);
        return { action, acceptance: acceptance.join('；'), turn: undefined };
      });
  return (
    <div className="report-modules">
      <section className="panel report-takeaway" aria-label="本场速览">
        <div className="report-module-title">
          <span className="report-module-icon">
            <Sparkles size={28} />
          </span>
          <h2>本场速览</h2>
        </div>
        <div className="report-takeaway-bottom">
          <div className="report-overall-evaluation">
            <p className="report-takeaway-text">{summary.overview.text}</p>
          </div>
          <dl className="report-mini-stats">
            <div>
              <dt>优势亮点</dt>
              <dd>
                {summary.strengths.length}
                <small>项</small>
              </dd>
            </div>
            <div>
              <dt>优先提升</dt>
              <dd>
                {summary.improvements.length}
                <small>项</small>
              </dd>
            </div>
            <div>
              <dt>已分析</dt>
              <dd>
                {report.analysis_progress?.completed ?? report.evaluations.length}
                <small>题</small>
              </dd>
            </div>
          </dl>
        </div>
      </section>

      <div className="report-insight-columns">
        <section className="panel report-strengths" aria-label="优势亮点">
          <div className="report-module-title">
            <span className="report-module-icon">
              <CheckCircle2 size={20} />
            </span>
            <div>
              <h2>优势亮点</h2>
              <p>保留这些有效的表达与做法</p>
            </div>
          </div>
          <div className="report-insight-list">
            {summary.strengths.length ? (
              summary.strengths.map((item, i) => (
                <article className="report-insight-card" key={i}>
                  <span className="report-insight-number">{String(i + 1).padStart(2, '0')}</span>
                  <div>
                    <p>{item.text}</p>
                    {item.evidence_refs[0] && (
                      <button
                        className="report-insight-link"
                        onClick={() => onSelect(item.evidence_refs[0].turn_id)}
                      >
                        看这道题
                        <ArrowUpRight size={18} />
                      </button>
                    )}
                  </div>
                </article>
              ))
            ) : (
              <p className="report-empty-insight">本场暂无已确认的优势亮点。</p>
            )}
          </div>
        </section>
        <section className="panel report-improvements" aria-label="优先提升">
          <div className="report-module-title">
            <span className="report-module-icon">
              <Target size={20} />
            </span>
            <div>
              <h2>优先提升</h2>
              <p>从这些具体缺口开始练习</p>
            </div>
          </div>
          <div className="report-insight-list">
            {summary.improvements.length ? (
              summary.improvements.map((item, i) => (
                <article className="report-insight-card" key={`${item.turn_id}:${i}`}>
                  <span className="report-insight-number">{String(i + 1).padStart(2, '0')}</span>
                  <div>
                    <p>{item.text}</p>
                    <button className="report-insight-link" onClick={() => onSelect(item.turn_id)}>
                      看这道题
                      <ArrowUpRight size={15} />
                    </button>
                  </div>
                </article>
              ))
            ) : (
              <p className="report-empty-insight">本场暂无已确认的优先改进项。</p>
            )}
          </div>
        </section>
      </div>
      {!!steps.length && (
        <section className="panel report-practice-plan" aria-label="练习建议">
          <div className="report-module-title">
            <span className="report-module-icon">
              <Flag size={28} />
            </span>
            <h2>练习建议</h2>
          </div>

          <ol className="report-action-route">
            {steps.map((step, i) => (
              <li key={i}>
                <span className="report-route-marker">{String(i + 1).padStart(2, '0')}</span>
                <div className="report-route-content">
                  <p>{step.action}</p>
                  {step.acceptance && (
                    <div className="report-acceptance">
                      <CheckCircle2 size={20} />
                      <p>
                        <strong>验收</strong> · {step.acceptance}
                      </p>
                    </div>
                  )}
                  {step.turn && (
                    <button className="report-insight-link" onClick={() => onSelect(step.turn!)}>
                      查看相关题目
                      <ArrowUpRight size={15} />
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
