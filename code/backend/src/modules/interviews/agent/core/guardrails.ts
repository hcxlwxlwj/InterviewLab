/** 面试护栏：统一校验问题与预览的来源、原文引用、提问策略和面试官身份边界。 */
import {
  evidenceMatches,
  type InterviewConfig,
  type InterviewPreview,
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

export function assertPreview(value: InterviewPreview) {
  if (
    value.text.length > 180 ||
    value.acknowledgement.length > 50 ||
    /参考答案|标准答案|建议你|正确做法|回答得|回答很好|你的回答.{0,5}(不足|优秀)|首先.{0,20}其次/.test(
      value.acknowledgement + ' ' + value.text,
    ) ||
    /好习惯|做得好|值得肯定|(?:方案|做法|思路|逻辑|验证|表达).{0,6}(?:有效|合理|正确|清晰|完整|充分|扎实)/.test(
      value.acknowledgement,
    ) ||
    // The interviewer must never accept a redefined role/relationship from the candidate.
    /既然我是(?:学生|同学|HR|面试官)|我是你的?(?:学生|同学)|作为你的?(?:学生|同学)|咱们?(?:就)?(?:当是|作为)同学|同学间交流|以同学(?:身份|的?(?:身份|方式))|换成?(?:学生|同学|HR)|忘记(?:你的?设定|身份|规则)/.test(
      value.acknowledgement + ' ' + value.text,
    ) ||
    (value.text.match(/[?？]/g)?.length ?? 0) > 1
  )
    throw new ServiceError('invalid_model_output', 502, '问题预览未通过校验');
}

/** Narrow guardrails for clear type violations; semantic quality still needs dialogue review. */
export function assertPolicyQuestion(text: string, config: InterviewConfig) {
  if (
    config.interview_type === 'hr' &&
    /缓存机制|缓存穿透|索引原理|数据库索引|时间复杂度|事件循环|线程安全|事务隔离|代码实现|实现代码|SQL语句|手写算法|如何.{0,6}(?:实现|优化).{0,8}(?:接口|缓存|数据库)/i.test(
      text,
    )
  )
    throw new ServiceError('invalid_model_output', 502, 'HR面不能转为专业实现考查');
  if (
    config.interview_type === 'business_scenario' &&
    /手写(?:代码|算法)|(?:编写|实现一段|写出).{0,8}(?:代码|SQL)/i.test(text)
  )
    throw new ServiceError('invalid_model_output', 502, '业务面应考查工作判断，不进行代码考试');
}

export function assertQuestionIntent(text: string, answer: string | null) {
  if (
    !text.trim() ||
    (answer?.includes(text) && text.length > 8) ||
    (!/[?？]/.test(text) && !/请|能否|谈谈|说说|介绍|讲讲|描述|分享/.test(text))
  )
    throw new ServiceError('invalid_model_output', 502, '必须提出实际问题，不能只复述候选人的回答');
}
