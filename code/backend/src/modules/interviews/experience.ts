import {
  replyAct,
  conversationPolicy,
  blockedPreparation,
  assertConversationQuestion,
} from './conversation';
import type {
  Interview,
  InterviewEvidence,
  InterviewExperienceGrounding,
  InterviewConversationState,
} from '@interviewlab/core';
import { ServiceError } from '../../foundation/errors';

const project = /项目|游戏|网站|网页|页面|系统|平台|小程序|应用|app|课程设计|毕设|个人博客/i;
const switches =
  /换(?:一)?个项目|另一个(?:项目|游戏|网站|系统|平台)|另外(?:一)?个(?:项目|游戏|网站|系统|平台)|再说一个项目|还有(?:一)?个(?:项目|游戏|网站|系统|平台)/;
const purpose =
  /玩法|玩家|用户(?:可以|需要|能够|通过)|用于|用来|目的是|目标是|解决.{1,20}(?:问题|需求)|支持.{1,25}(?:浏览|选课|下单|预约|聊天|上传|查询|闯关)|控制.{1,20}(?:角色|小球|人物)|跑酷|闯关/;
const ownership =
  /我(?:本人|自己|主要|独立)?(?:负责|承担|实现|编写|设计|开发|搭建)|(?:^|[，,；;])(?:自己|本人)(?:负责|承担|实现|编写|设计|开发|搭建)|由我|我一个人|我独立|都是我|个人项目/;
const generic = /(?:很多|多个|几个|一些|不少|各种)(?:的)?项目/;
function bareLabel(text: string) {
  const value = text.replace(/[\s。！？!?，,]/g, '');
  return /^(?:我(?:做过|做了|参与过)?|是|做了|做过)?(?:一(?:个|款))?(?:3d|2d|三维)?(?:小)?(?:游戏|项目|网站|系统|平台|小程序|应用|app)$/i.test(
    value,
  );
}
function hasDescription(quote: string) {
  if (bareLabel(quote)) return false;
  if (purpose.test(quote)) return true;
  if (generic.test(quote)) return false;
  // Conservative recovery for existing sessions: retain an actual work description,
  // not a project category or a technology name by itself.
  return (
    project.test(quote) &&
    /负责|实现|编写|设计|开发|搭建/.test(quote) &&
    !/(?:整个|全部|这个|一个)(?:的)?项目[。！]?\s*$/.test(quote) &&
    !/(?:3D|2D|三维)?小游戏/.test(quote)
  );
}
function hasRole(quote: string) {
  return ownership.test(quote) && !generic.test(quote) && !bareLabel(quote);
}
function explicitlyUnavailable(text: string) {
  if (/(?:但|不过|只是).{0,20}(?:做过|有|参与).{0,12}(?:项目|练习|课程设计)/.test(text))
    return false;
  return /(?:没有|没做过|没参与过|还没做过)[^，,。；;]{0,12}(?:任何项目|相关项目|项目经历|实际项目|项目|相关实践|相关经历)|不想.{0,6}(?:聊项目|谈项目)/.test(
    text,
  );
}
function declinesScenario(text: string) {
  return /(?:不要|别|不想|不需要|不希望).{0,12}(?:假设|情境|场景)/.test(text);
}
function requestsScenario(text: string) {
  if (declinesScenario(text)) return false;
  return /(?:请|想|希望|可以|直接|改成|换成).{0,12}(?:假设题|情境题|场景题|假设场景)|(?:假设题|情境题|场景题).{0,8}(?:吧|就行|可以)/.test(
    text,
  );
}
function openingOnly(text: string) {
  const value = text.replace(/[\s，,。.!！?？～~、]/g, '').toLowerCase();
  if (
    /^(?:你好|您好|老师好|面试官好|面试官你好|hi|hello|哈喽|嗯|恩|好的|好|可以|ok|开始吧|准备好了)+$/.test(
      value,
    )
  )
    return true;
  return (
    !/专业|学生|开发|工程师|工作|学过|学习/.test(value) &&
    /^(?:你好|您好)?我(?:叫|是)[\u4e00-\u9fffA-Za-z]{1,12}$/.test(value)
  );
}
function learningBackground(turns: Interview['turns']): InterviewEvidence | null {
  let result: InterviewEvidence | null = null;
  for (const turn of turns)
    for (const raw of turn.answer_text?.match(/[^，,。！？；;\n]+/g) ?? []) {
      const quote = raw.trim();
      if (replyAct(quote) !== 'answer') continue;
      if (/(?:没|没有|不曾|未|不).{0,4}(?:学过|学习|接触|了解|使用过)/.test(quote)) continue;
      const match =
        /(?:学过|学了|正在学|学习过|接触过|练习过|熟悉|使用过|了解|做过.{0,8}(?:练习|作业))(.+)/.exec(
          quote,
        );
      const intention =
        /(?:想|希望|打算|准备|计划).{0,4}(?:了解|学习|接触|练习|熟悉|使用|自学)/.exec(quote);
      if (intention && (!match || match.index >= intention.index)) continue;
      if (
        !match &&
        !/零基础|没学过|没接触过|完全不会/.test(quote) &&
        /学过|学习|课程|练习|接触|熟悉/.test(turn.text) &&
        !openingOnly(quote) &&
        !/^(?:没有|不知道|不会|还没有|没学过|没接触过|一点|一些|基础|有|学过|接触过|做过|是的|对|会一点|一点点)$/.test(
          quote,
        )
      ) {
        result = { turn_id: turn.id, revision: turn.revision, quote: quote.slice(0, 240) };
        continue;
      }
      if (
        !match ||
        /^(?:一点|一些|一点点|皮毛|基础|一些基础|相关知识|一些内容)[。！]?$/.test(match[1].trim())
      )
        continue;
      const from = Math.max(0, (match.index ?? 0) - 20);
      result = { turn_id: turn.id, revision: turn.revision, quote: quote.slice(from, from + 240) };
    }
  return result;
}
export interface ExperiencePolicy {
  next_step:
    | 'introduction'
    | 'alternative_experience'
    | 'project_discovery'
    | 'learning_basics'
    | 'motivation'
    | 'interview'
    | 'topic_transition';
  conversation: InterviewConversationState;
  learning_background: InterviewEvidence | null;
  experience: InterviewExperienceGrounding;
  missing: ('project_description' | 'personal_role')[];
  discovery_required: boolean;
  hypothetical_allowed: boolean;
  actual_discussion_started: boolean;
  user_requested_scenario: boolean;
}
export function experiencePolicy(interview: Interview): ExperiencePolicy {
  const answered = interview.turns.filter(
    (t) => t.answer_status === 'answered' && t.answer_text?.trim(),
  );
  let start = 0;
  answered.forEach((t, i) => {
    if (switches.test(t.answer_text!) || switches.test(t.text)) start = i;
  });
  const relevant = answered.slice(start);
  const experience: InterviewExperienceGrounding = { description: null, personal_role: null };
  let descriptionTurn = -1,
    roleTurn = -1;
  for (let i = 0; i < relevant.length; i++) {
    const turn = relevant[i];
    for (const part of turn.answer_text!.match(/[^。！？\n]+[。！？]?/g) ?? []) {
      const quote = part.trim();
      const excerpt = (trigger: RegExp): InterviewEvidence => {
        const match = quote.search(trigger);
        const from = Math.max(0, match - 40);
        return { turn_id: turn.id, revision: turn.revision, quote: quote.slice(from, from + 240) };
      };
      if (!experience.description && hasDescription(quote)) {
        experience.description = excerpt(purpose);
        descriptionTurn = i;
      }
      if (!experience.personal_role && hasRole(quote)) {
        experience.personal_role = excerpt(ownership);
        roleTurn = i;
      }
    }
  }
  const missing: ExperiencePolicy['missing'] = [];
  if (!experience.description) missing.push('project_description');
  if (!experience.personal_role) missing.push('personal_role');
  const latest = relevant.at(-1)?.answer_text ?? '';
  const mentionedProject = relevant.some(
    (t) =>
      project.test(t.answer_text!) &&
      (/做|开发|参与|负责|实现|编写|搭建/.test(t.answer_text!) ||
        bareLabel(t.answer_text!) ||
        switches.test(t.answer_text!) ||
        switches.test(t.text)),
  );
  let noExperienceIndex = -1;
  relevant.forEach((t, i) => {
    if (explicitlyUnavailable(t.answer_text!)) noExperienceIndex = i;
  });
  const userRequested = requestsScenario(latest);
  const unavailable =
    noExperienceIndex >= 0 &&
    !relevant
      .slice(noExperienceIndex + 1)
      .some((t) => project.test(t.answer_text!) && !explicitlyUnavailable(t.answer_text!));
  // Brief answers never mean the candidate has no experience. Allow extension only
  // after a baseline was established in a previous answer and actual discussion followed.
  const baselineBeforeLatest =
    !missing.length && Math.max(descriptionTurn, roleTurn) < relevant.length - 1;
  const learning = learningBackground(relevant);
  const noLearning =
    !learning &&
    relevant.some(
      (t) =>
        /零基础|什么都没学过|完全没学过|(?:没|没有|还没).{0,5}(?:学过|学习|接触).{0,12}(?:前端|相关|任何)/.test(
          t.answer_text!,
        ) ||
        (/^(?:都)?(?:没有|没学过|什么都没有)[。！]?$/.test(t.answer_text!) &&
          /学过|学习|课程|练习|接触/.test(t.text)),
    );

  const opening = answered.length > 0 && answered.every((t) => openingOnly(t.answer_text!));
  const projectDiscovery =
    mentionedProject &&
    missing.length > 0 &&
    !unavailable &&
    !userRequested &&
    interview.configuration.interview_type !== 'hr';
  const conversation = conversationPolicy(interview);
  let nextStep: ExperiencePolicy['next_step'] = userRequested
    ? 'interview'
    : opening
      ? 'introduction'
      : projectDiscovery
        ? 'project_discovery'
        : unavailable && missing.length > 0
          ? learning
            ? 'learning_basics'
            : noLearning
              ? 'motivation'
              : 'alternative_experience'
          : learning && missing.length > 0 && !mentionedProject
            ? 'learning_basics'
            : 'interview';
  if (conversation.last_act === 'decline_topic' || blockedPreparation(nextStep, conversation))
    nextStep = 'topic_transition';
  const basicsDiscussed = relevant.some(
    (t) => t.stage === 'technical' && t.answered_at !== null && t !== relevant[0],
  );
  const sufficientDiscussion = relevant.length >= 3 && !bareLabel(latest) && latest.length >= 12;
  return {
    next_step: nextStep,
    conversation,
    learning_background: learning,
    experience,
    missing,
    discovery_required: projectDiscovery && nextStep !== 'topic_transition',
    actual_discussion_started:
      nextStep === 'introduction' ||
      nextStep === 'alternative_experience' ||
      nextStep === 'topic_transition'
        ? false
        : nextStep === 'motivation'
          ? relevant.some((t) => t.stage === 'behavioral' && t.topic === '岗位动机')
          : nextStep === 'learning_basics'
            ? basicsDiscussed
            : baselineBeforeLatest || !mentionedProject || userRequested,
    hypothetical_allowed:
      !declinesScenario(latest) &&
      (userRequested ||
        (conversation.last_act === 'answer' &&
          !unavailable &&
          !opening &&
          baselineBeforeLatest &&
          sufficientDiscussion)),
    user_requested_scenario: !declinesScenario(latest) && userRequested,
  };
}
const hypothetical =
  /假设|假如|设想|如果(?:要|让|需|有|你|这)|若(?:要|需)|(?:如果|若).{0,15}(?:加入|新增|支持|扩展)|(?:加入|新增|扩展).{0,12}你会/;
const scopeQuestion =
  /什么(?:功能|玩法|项目|内容)|(?:玩法|用途|目标|功能|内容).{0,12}(?:是什么|有哪些|什么|是啥|介绍|说明)|(?:介绍|说说|描述).{0,12}(?:游戏|项目|功能)|(?:是|做|开发).{0,6}什么|(?:游戏|项目).{0,12}(?:怎么玩|做什么|用来)|主要.{0,8}(?:做什么|解决)|哪个项目|哪一个项目|面向什么|什么样的|(?:项目|游戏).{0,12}(?:介绍|讲讲|说说)|(?:选|挑).{0,12}(?:项目|游戏)/;
const roleQuestion = /负责|职责|分工|承担|个人.{0,8}(?:工作|贡献)|亲自|你做了(?:什么|哪些)/;
export function assertExperienceQuestion(
  text: string,
  policy: ExperiencePolicy,
  covered: boolean,
  complete: boolean,
) {
  if (
    hypothetical.test(text) &&
    !(policy.hypothetical_allowed && (covered || policy.user_requested_scenario))
  )
    throw new ServiceError('invalid_model_output', 502, '项目事实尚未建立，不能提前转入假设场景');
  if (!complete) return;
  assertConversationQuestion(text, policy.conversation, true);
  if (policy.next_step === 'introduction') {
    if (project.test(text) || !/介绍|学习背景|专业|学习经历|应聘|选择.{0,8}方向/.test(text))
      throw new ServiceError('invalid_model_output', 502, '打招呼尚未完成自我介绍，应先了解背景');
    return;
  }
  if (policy.next_step === 'alternative_experience') {
    if (
      !/课程|练习|作业|学过|学习|接触|其他.{0,8}(?:项目|经历)|别的.{0,8}(?:项目|经历)/.test(text) ||
      /你(?:做过|完成|参与)的(?:课程|练习|作业|其他)/.test(text)
    )
      throw new ServiceError(
        'invalid_model_output',
        502,
        '没有项目信息时应先了解可替代的学习或实践背景',
      );
    return;
  }
  if (!policy.discovery_required) return;
  const scope = policy.missing.includes('project_description') && scopeQuestion.test(text);
  const role = policy.missing.includes('personal_role') && roleQuestion.test(text);
  if (!scope && !role)
    throw new ServiceError('invalid_model_output', 502, '应先了解项目内容或本人职责');
}

export function preparingBackground(policy: ExperiencePolicy) {
  return [
    'introduction',
    'alternative_experience',
    'project_discovery',
    'motivation',
    'topic_transition',
  ].includes(policy.next_step);
}
export function knowledgeReady(policy: ExperiencePolicy) {
  return policy.next_step === 'interview';
}
