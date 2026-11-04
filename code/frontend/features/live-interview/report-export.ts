import {
  FEEDBACK_DIMENSIONS,
  feedbackScore,
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
  const feedback = summary?.feedback_template;
  const templateTotal = feedbackScore(feedback);
  const templateHtml = `<h2>五、评分汇总</h2><table><thead><tr><th>评价维度</th><th>权重</th><th>得分</th><th>具体行为依据</th></tr></thead><tbody>${FEEDBACK_DIMENSIONS.map(
    (d) => {
      const a = feedback?.assessments.find((a) => a.dimension === d.key);
      return `<tr><td>${escape(d.label)}</td><td>${d.weight}</td><td>${a?.score == null ? '尚未生成' : `${Math.round(((a.score * d.weight) / 100) * 10) / 10} / ${d.weight}`}</td><td>${escape(a?.text ?? '评分尚未生成')}${a?.evidence_refs.map((r) => `<blockquote>回答 v${r.revision}：“${escape(r.quote)}”</blockquote>`).join('') ?? ''}</td></tr>`;
    },
  ).join(
    '',
  )}</tbody></table><p>综合分：${templateTotal.score === null ? `暂不计算（已评价权重 ${templateTotal.coverage}/100）` : `${templateTotal.score}/100（已评价权重 ${templateTotal.coverage}/100，按六维权重加权）`}。证据不足的维度按20分计入，表示本场展示不足。</p>`;

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
  <h2>一、总体印象</h2>${summary ? `${findings([summary.overview])}<h3>二、做得好的地方（具体行为）</h3>${summary.strengths.length ? findings(summary.strengths) : '<p>暂无足够依据归纳优势。</p>'}<h3>三、需要提升的地方（具体、可操作）</h3>${summary.improvements.map((f) => `${findings([f])}<p>练习目标：${escape(f.retry_goal)}</p>`).join('') || '<p>暂无已确认的优先改进项。</p>'}<h3>分析局限</h3>${list(summary.limitations)}` : `<p>${report.summary_status === 'failed' ? '总结生成失败，逐题结果仍保留。' : report.summary_status === 'not_applicable' ? '暂无足够证据生成总结。' : '总结尚未生成。'}</p>`}
  <h2>四、针对性改进建议</h2>${feedback?.action_plan.map((a) => `<h3>${{ short_term: '短期（1周）', medium_term: '中期（1月）', long_term: '长期（持续练习）' }[a.horizon]}</h3><p>${escape(a.action)}</p><p>验收方式：${escape(a.acceptance)}</p>`).join('') || '<p>暂无行动计划。</p>'}
  ${templateHtml}
  <h2>六、下一步期待</h2><p>${escape(feedback?.next_expectation ?? '围绕已确认目标重练并比较回答。')}</p>
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
    )}${report.analysis_metadata?.scoring_rubric_version === FRONTEND_RUBRIC_VERSION ? `<h2>评分方法与适用边界</h2><p>逐题指标版本：${escape(report.analysis_metadata?.scoring_rubric_version)}</p><p>${escape(REPORT_RUBRIC.title)} · 专家审核与人工校准待完成。</p>${list(REPORT_RUBRIC.rules)}<h3>方法来源</h3>${list(REPORT_RUBRIC.methods.map((m) => `${m.name}：${m.role} ${m.url}`))}` : ''}<footer>InterviewLab · 报告仅供个人练习复盘。包含个人回答，请妥善保存。</footer></body></html>`;
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
