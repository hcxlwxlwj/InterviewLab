import type {
  Interview,
  InterviewTurn,
  InterviewTopic,
  InterviewConversationState,
  InterviewReplyAct,
  InterviewTopicBoundary,
} from '@interviewlab/core';
import { ServiceError } from '../../foundation/errors';
const refusal =
  /不方便|不想(?:回答|说|聊|谈|透露|介绍)|不愿(?:回答|说|聊|谈|透露)|不便(?:回答|说|聊|谈|透露)|不(?:聊|谈).{0,8}(?:这个|背景|学校|项目)|(?:这个问题|这个话题|这题).{0,6}(?:跳过|不答|保密)|换(?:个|一个)话题|涉及保密|别(?:再)?(?:问|聊|谈)(?:这个|这题)|这个不说了|跳过这个问题/;
export function replyAct(text: string): InterviewReplyAct {
  const value = text.replace(/[\s，,。.!！?？～~、]/g, '').toLowerCase();
  if (!/没有不方便|不是不方便/.test(text) && refusal.test(text)) return 'decline_topic';
  if (/^(?:你好|您好|老师好|面试官好|面试官你好|hi|hello|哈喽)+$/.test(value)) return 'greeting';
  if (
    /^(?:嗯|恩|好的|好|可以|ok|开始吧|准备好了|有|是的|对|会一点|一点点|继续|继续吧)+$/.test(value)
  )
    return 'acknowledgement';
  if (
    /^(?:我)?(?:不太|完全)?(?:不知道|不清楚|不会|不懂|没学过|没接触过|没了解过|想不起来)/.test(
      value,
    ) &&
    !/(?:但|不过|只是|然而)/.test(value)
  )
    return 'dont_know';
  return 'answer';
}
export function questionTopic(
  turn: Pick<InterviewTurn, 'text' | 'stage' | 'topic'>,
): InterviewTopic {
  const sentences = turn.text
    .split(/[。！!；;]/)
    .map((s) => s.trim())
    .filter(Boolean);
  const text = (sentences.at(-1) ?? turn.text).replace(
    /^.{0,35}(?:跳过|不展开|先放下|不再聊)[，,：:]\s*/,
    '',
  );
  if (
    /学校|学历|毕业院校|教育背景|学习背景|自我介绍|介绍.{0,5}自己/.test(text) ||
    turn.stage === 'introduction'
  )
    return 'personal_background';
  if (
    /(?:应聘|岗位|方向).{0,10}(?:原因|动机)|为什么.{0,10}(?:应聘|选择|前端)|岗位动机/.test(
      text + ' ' + turn.topic,
    )
  )
    return 'motivation';
  if (/学过|课程|练习|接触过|最近.{0,8}技术|熟悉.{0,8}(?:哪些|什么)|学习(?:过程|内容)/.test(text))
    return 'learning_experience';
  if (/项目|游戏|你负责|本人职责|你的分工/.test(text)) return 'project';
  if (turn.stage === 'technical') return 'technical';
  if (turn.stage === 'business') return 'business';
  if (turn.stage === 'behavioral') return 'collaboration';
  return 'other';
}
function namedTopic(text: string): InterviewTopic | null {
  if (/学校|学历|背景|个人信息|自我介绍/.test(text)) return 'personal_background';
  if (/应聘原因|岗位动机|选择.{0,8}原因/.test(text)) return 'motivation';
  if (/项目|游戏|实习细节/.test(text)) return 'project';
  if (/课程|练习|学过|学习经历/.test(text)) return 'learning_experience';
  return null;
}
export function conversationPolicy(interview: Interview): InterviewConversationState {
  const boundaries: InterviewTopicBoundary[] = [];
  let lastAct: InterviewReplyAct = 'answer';
  for (const turn of interview.turns) {
    if (turn.answer_status !== 'answered' || !turn.answer_text?.trim()) continue;
    const text = turn.answer_text;
    lastAct = replyAct(text);
    const reopened =
      /(?:现在|还是|可以|愿意|继续).{0,6}(?:聊|谈|介绍|说|回答).{0,12}(?:学校|背景|项目|课程|练习|原因)|(?:背景|项目|课程|练习).{0,6}(?:现在可以聊|可以继续)/.test(
        text,
      )
        ? namedTopic(text)
        : null;
    if (reopened) lastAct = 'answer';
    if (reopened) {
      for (let i = boundaries.length - 1; i >= 0; i--)
        if (boundaries[i].topic === reopened) boundaries.splice(i, 1);
    }
    if (lastAct !== 'decline_topic' || reopened) continue;
    const explicitTopic = namedTopic(text);
    const topic = explicitTopic ?? questionTopic(turn);
    const scope =
      /只(?:是)?这(?:一)?题|跳过这题|这个问题.{0,4}(?:跳过|不答)/.test(text) ||
      ['technical', 'business', 'other'].includes(topic) ||
      (topic === 'project' && !explicitTopic)
        ? ('question' as const)
        : ('topic' as const);
    const from = Math.max(0, text.search(refusal) - 30);
    const boundary: InterviewTopicBoundary = {
      topic,
      scope,
      question_id: turn.id,
      question: turn.text,
      evidence_ref: {
        turn_id: turn.id,
        revision: turn.revision,
        quote: text.slice(from, from + 240),
      },
    };
    const previous = boundaries.findIndex(
      (b) =>
        b.topic === topic && b.scope === scope && (scope === 'topic' || b.question_id === turn.id),
    );
    if (previous >= 0) boundaries.splice(previous, 1);
    boundaries.push(boundary);
  }
  return { last_act: lastAct, boundaries: boundaries.slice(-18) };
}
const topicForStep: Record<string, InterviewTopic> = {
  introduction: 'personal_background',
  alternative_experience: 'learning_experience',
  learning_basics: 'learning_experience',
  project_discovery: 'project',
  motivation: 'motivation',
};
export function blockedPreparation(step: string, state: InterviewConversationState) {
  const topic = topicForStep[step];
  return !!topic && state.boundaries.some((b) => b.scope === 'topic' && b.topic === topic);
}
export function assertConversationQuestion(
  text: string,
  state: InterviewConversationState,
  complete: boolean,
) {
  if (!complete) return;
  if (
    state.boundaries.length &&
    /如果方便|是否方便|方便.{0,6}(?:聊|介绍|说|分享)|(?:聊|介绍|说|分享).{0,10}方便吗/.test(text)
  )
    throw new ServiceError(
      'invalid_model_output',
      502,
      '应接受话题边界并直接转场，不反复征求方便与否',
    );
  const topic = questionTopic({ text, stage: undefined, topic: '' });
  if (state.boundaries.some((b) => b.scope === 'topic' && b.topic === topic))
    throw new ServiceError('invalid_model_output', 502, '不能继续索取候选人已拒绝的话题');
  if (
    state.boundaries.some(
      (b) => b.scope === 'question' && b.question.replace(/\s/g, '') === text.replace(/\s/g, ''),
    )
  )
    throw new ServiceError('invalid_model_output', 502, '当前问题已被候选人拒绝');
}
