/** 报告专业知识入口：只接纳冻结版本内、来源可追溯的评价参考。 */
import type { InterviewSnapshot, InterviewRetrieval } from '@interviewlab/core';

export function professionalEvaluationReferences(
  snapshot: InterviewSnapshot,
  retrieval?: InterviewRetrieval,
) {
  const allowedSources = new Set(snapshot.knowledge.sources.map((s) => s.id));
  return retrieval?.release === snapshot.knowledge.content_version
    ? retrieval.chunks
        .filter(
          (c) =>
            ['professional', 'question', 'evaluation_reference'].includes(c.kind ?? '') &&
            c.source_refs.length > 0 &&
            c.source_refs.every((source) => allowedSources.has(source)),
        )
        .slice(0, 5)
    : [];
}
