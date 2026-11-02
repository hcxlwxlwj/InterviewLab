import {
  DIMENSION_LABELS,
  REPORT_INDICATORS,
  REPORT_RUBRIC,
  FRONTEND_RUBRIC_VERSION,
  type Interview,
  type InterviewReport,
  type InterviewFinding,
} from '@interviewlab/core';

const escape = (value: unknown) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
const list = (items: string[]) => `<ul>${items.map((s) => `<li>${escape(s)}</li>`).join('')}</ul>`;
const findings = (items: InterviewFinding[]) =>
  items
    .map(
      (f) =>
        `<p>${escape(f.text)}</p>${f.evidence_refs.map((r) => `<blockquote>回答 v${r.revision}：“${escape(r.quote)}”</blockquote>`).join('')}`,
    )
    .join('');

/** A complete printable snapshot; all interview/model text is escaped, with no remote assets. */
export function reportExportHtml(interview: Interview, report: InterviewReport): string {
  const progress = report.analysis_progress;
  const summary = report.summary;
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>${escape(interview.job_title)} · 面试复盘报告</title><style>
  @page { size: A4; margin: 18mm; }
  * { box-sizing: border-box; } body { color: #202b46; font: 11pt/1.7 -apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif; margin: 0; }
  h1 { font-size: 24pt; } h2 { font-size: 16pt; border-bottom: 1px solid #ccd5dd; padding-bottom: 6px; margin-top: 25px; } h3 { font-size: 12pt; } h1,h2,h3,h4 { break-after: avoid; }
  p,li,blockquote { overflow-wrap: anywhere; white-space: pre-wrap; } blockquote { border-left: 3px solid #89b4b6; padding-left: 12px; color: #526275; margin: 8px 0; font-size: 9pt; }
  table { border-collapse: collapse; width: 100%; } td,th { text-align: left; padding: 8px; border: 1px solid #dce1e6; } tr { break-inside: avoid; }
  .notice { background: #fff6d8; padding: 12px; border: 1px solid #eadcae; } .muted { color: #627084; } .answer { background: #f1f5f4; padding: 12px; } footer { border-top: 1px solid #ddd; margin-top: 25px; font-size: 9pt; }
  </style></head><body><header><p>InterviewLab · 面试练习室</p><h1>${escape(interview.job_title)}<br>面试复盘报告</h1><p>结束时间：${escape(interview.ended_at ? new Date(interview.ended_at).toLocaleString('zh-CN') : '未记录')} · 报告版本 ${report.version}</p></header>
  <p class="notice">基于本场回答的 AI 辅助复盘。参考评分未经人工校准，不代表招聘结论。${report.is_partial ? '本报告为部分复盘，仅反映已完成的分析。' : ''}</p>
  <p>${progress ? `有效回答 ${progress.total} 题 · 已分析 ${progress.completed} 题 · 待处理 ${progress.pending} 题 · 失败 ${progress.failed} 题` : escape(report.coverage)}</p>
  <h2>AI 参考评分</h2><p>评分标准版本：${escape(report.analysis_metadata?.scoring_rubric_version ?? '历史规则')} · 尚未人工校准</p><p>总分：<strong>${report.overall_score === null ? '尚未生成' : `${report.overall_score} / 100`}</strong></p>
  <table><thead><tr><th>维度</th><th>参考分</th><th>依据说明</th></tr></thead><tbody>${Object.entries(
    report.dimensions,
  )
    .map(
      ([key, d]) =>
        `<tr><td>${DIMENSION_LABELS[key as keyof typeof DIMENSION_LABELS]}</td><td>${d.score === null ? (d.status === 'observed' ? '尚未生成' : '未观察') : `${d.score} / 100`}</td><td>${escape(d.explanation)}</td></tr>`,
    )
    .join('')}</tbody></table>
  <p class="muted">${report.analysis_metadata?.scoring_rubric_version === FRONTEND_RUBRIC_VERSION ? escape(REPORT_RUBRIC.rules[5]) : '评分按 0–4 档乘以 25 换算；总分为已评分维度等权平均后四舍五入。'}未观察维度不计入，不补零。没有代码考核时不评代码能力。</p>
  <h2>整场总结</h2>${summary ? `${findings([summary.overview])}<h3>主要优势</h3>${summary.strengths.length ? findings(summary.strengths) : '<p>暂无足够依据归纳优势。</p>'}<h3>优先练习目标</h3>${summary.improvements.map((f) => `${findings([f])}<p>练习目标：${escape(f.retry_goal)}</p>`).join('') || '<p>暂无已确认的优先改进项。</p>'}<h3>分析局限</h3>${list(summary.limitations)}` : `<p>${report.summary_status === 'failed' ? '总结生成失败，逐题结果仍保留。' : report.summary_status === 'not_applicable' ? '暂无足够证据生成总结。' : '总结尚未生成。'}</p>`}
  <h2>逐题复盘与原回答</h2>${interview.turns
    .map((turn) => {
      const e = report.evaluations.find(
        (v) => v.turn_id === turn.id && v.revision === turn.revision,
      );
      return `<section><h3>${turn.main_question_index}${turn.follow_up_index ? `.${turn.follow_up_index}` : ''}. ${escape(turn.text)}</h3><p class="muted">回答版本 v${turn.revision}</p><div class="answer">${escape(turn.answer_status === 'answered' ? turn.answer_text : turn.answer_status === 'skipped' ? '已跳过，不进行评价。' : '未提交回答，不进行评价。')}</div>${
        e
          ? `<h4>本题指标与行为锚点</h4>${(e.indicator_assessments ?? [])
              .map((a) => {
                const indicator = REPORT_INDICATORS.find((i) => i.id === a.indicator_id);
                return `<h4>${escape(indicator?.title ?? a.indicator_id)} · ${a.level === null ? '未观察' : `${a.level} / 4 档`}</h4><p>${escape(a.text)}</p>${a.level === null ? '' : `<p>对应锚点：${escape(indicator?.anchors[a.level])}</p>`}${a.evidence_refs.map((r) => `<blockquote>回答 v${r.revision}：“${escape(r.quote)}”</blockquote>`).join('')}`;
              })
              .join(
                '',
              )}<h4>已说明的内容</h4>${findings(e.strengths) || '<p>暂无足够依据归纳亮点。</p>'}<h4>可改进的缺口</h4>${findings(e.gaps) || '<p>没有已确认的明确缺口。</p>'}<h4>参考要点</h4>${list(e.reference_points)}<p>重练目标：${escape(e.retry_goal)}</p>${list(e.limitations)}`
          : turn.answer_status === 'answered'
            ? '<p>本题分析尚未生成，原回答已保留。</p>'
            : ''
      }</section>`;
    })
    .join(
      '',
    )}${report.analysis_metadata?.scoring_rubric_version === FRONTEND_RUBRIC_VERSION ? `<h2>评分方法与适用边界</h2><p>${escape(REPORT_RUBRIC.title)} · 专家审核与人工校准待完成。</p>${list(REPORT_RUBRIC.rules)}<h3>方法来源</h3>${list(REPORT_RUBRIC.methods.map((m) => `${m.name}：${m.role} ${m.url}`))}` : ''}<footer>InterviewLab · 报告仅供个人练习复盘。包含个人回答，请妥善保存。</footer></body></html>`;
}

/** Use the browser's local PDF renderer; no private report is uploaded or persisted by an export service. */
export async function printReport(interview: Interview, report: InterviewReport): Promise<void> {
  const frame = document.createElement('iframe');
  frame.title = '面试报告打印预览';
  frame.style.cssText = 'position:fixed;width:1px;height:1px;left:-10000px;border:0';
  document.body.appendChild(frame);
  try {
    await new Promise<void>((resolve, reject) => {
      frame.onload = () => resolve();
      frame.onerror = () => reject(new Error('报告预览加载失败，请重试。'));
      frame.srcdoc = reportExportHtml(interview, report);
    });
    const target = frame.contentWindow;
    if (!target) throw new Error('浏览器无法打开打印预览，请重试。');
    await target.document.fonts.ready;
    target.addEventListener('afterprint', () => frame.remove(), { once: true });
    target.focus();
    target.print();
    setTimeout(() => frame.remove(), 300000);
  } catch (error) {
    frame.remove();
    throw error;
  }
}
