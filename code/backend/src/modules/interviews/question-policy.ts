import type { InterviewConfig } from '@interviewlab/core';
import { ServiceError } from '../../foundation/errors';

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
