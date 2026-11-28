/** 报告工作记忆：为本次分析建立带回答版本的原文证据目录，不写入跨会话记忆。 */
import type { InterviewTurn, InterviewEvidence, InterviewEvaluation } from '@interviewlab/core';

export function evaluationAnswerEvidence(group: InterviewTurn[], currentTurnId: string) {
  const catalog = new Map<string, InterviewEvidence>();
  const currentIds = new Set<string>();
  for (const [i, t] of group.entries()) {
    const sentences = (t.answer_text ?? '').match(/[^。！？；\n]+[。！？；]?/gu) ?? [];
    let n = 0;
    for (const sentence of sentences)
      for (let j = 0; j < sentence.length; j += 180) {
        const quote = sentence.slice(j, j + 180);
        if (!quote.trim()) continue;
        const id = `g${i}-${n++}`;
        catalog.set(id, { turn_id: t.id, revision: t.revision, quote });
        if (t.id === currentTurnId) currentIds.add(id);
      }
  }
  return { catalog, currentIds };
}

/** 仅索引已校验的逐题优势与缺口，供整场总结按证据编号引用。 */
export function summaryEvidenceMemory(evaluations: InterviewEvaluation[]) {
  const catalog = new Map<string, InterviewEvidence>();
  const indexed = evaluations.map((e, index) => {
    const encode = (items: InterviewEvaluation['strengths'], kind: string) =>
      items.map((f, j) => ({
        text: f.text,
        evidence_ids: f.evidence_refs.map((ref, k) => {
          const id = `e${index}-${kind}${j}-${k}`;
          catalog.set(id, ref);
          return id;
        }),
      }));
    return {
      turn_id: e.turn_id,
      revision: e.revision,
      dimensions: e.dimensions,
      strengths: encode(e.strengths, 's'),
      gaps: encode(e.gaps, 'g'),
      retry_goal: e.retry_goal,
      limitations: e.limitations,
    };
  });
  return { catalog, indexed };
}
