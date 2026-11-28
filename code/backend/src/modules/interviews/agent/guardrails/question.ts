import {
  evidenceMatches,
  type InterviewQuestion,
  type InterviewSnapshot,
  type InterviewTurn,
} from '@interviewlab/core';
import { ServiceError } from '../../../../foundation/errors';

export function assertQuestion(
  question: InterviewQuestion,
  snapshot: InterviewSnapshot,
  turns: InterviewTurn[],
) {
  const item = snapshot.knowledge.questions.find((q) => q.id === question.knowledge_question_id);
  if (question.knowledge_question_id && !item)
    throw new ServiceError('invalid_model_output', 502, '模型引用了不可用题目');
  const allowed = new Set(snapshot.knowledge.sources.map((s) => s.id));
  if (
    question.source_refs.some((id) => !allowed.has(id)) ||
    question.evidence_refs.some((ref) => !evidenceMatches(ref, turns))
  )
    throw new ServiceError('invalid_model_output', 502, '模型引用校验失败');
  if (turns.some((t) => t.text.replace(/\s/g, '') === question.text.replace(/\s/g, '')))
    throw new ServiceError('invalid_model_output', 502, '模型重复提问');
  if (question.stage && (question.text.match(/[?？]/g)?.length ?? 0) > 1)
    throw new ServiceError('invalid_model_output', 502, '每轮只提出一个问题');
  // Catch common unsolicited feedback in an interviewer bridge. Semantic quality
  // still needs review; exact evidence validation cannot establish neutrality.
  if (
    question.acknowledgement &&
    /(?:有效|合理|正确).{0,4}(?:方案|手段|方法|选择)|(?:方案|做法|思路|逻辑|验证|表达).{0,6}(?:有效|合理|正确|清晰|完整|充分|扎实)|(?:很|非常)(?:好|清晰|全面|扎实)|回答.{0,6}(?:完整|清楚|优秀)/.test(
      question.acknowledgement,
    )
  )
    throw new ServiceError('invalid_model_output', 502, '面试承接语不能评价回答或方案');
}
