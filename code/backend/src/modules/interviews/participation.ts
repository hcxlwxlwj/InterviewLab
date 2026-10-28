import type { Interview, InterviewParticipation, InterviewQuestion } from '@interviewlab/core';
import { replyAct } from './conversation';

const marker = 'participation:';
export const isParticipationQuestion = (purpose: string) => purpose.startsWith(marker);
const compact = (text: string) => text.replace(/[\s，,。.!！?？～~、]/g, '').toLowerCase();
function signal(text: string): InterviewParticipation['reason'] | null {
  const value = compact(text);
  // shortcut: conservative literal signals only; ambiguous sarcasm/nonsense needs a reviewed semantic evaluation.
  if (/^(?:你|你这个|面试官)?(?:傻逼|傻叉|废物|白痴|蠢货|滚蛋|滚)(?:吧|啊|呀|了)?$/.test(value))
    return 'disruptive_language';
  if (
    /^(?:我)?(?:就是|就|偏|根本)?(?:不配合|不回答任何问题|不想回答任何问题|什么都不回答|什么都不答|来捣乱的|就不回答)$/.test(
      value,
    ) ||
    /^(?:不管|无论)你问什么(?:我)?都不(?:回答|答)$/.test(value)
  )
    return 'explicit_non_participation';
  if (replyAct(text) === 'greeting' || /^(?:随便|无所谓|呵呵|哈哈)+$/.test(value))
    return 'repeated_non_answers';
  return null;
}
function stopRequested(text: string, confirmation: boolean) {
  const value = compact(text);
  return (
    /^(?:我)?(?:想|要)?(?:结束面试|停止面试|不面试了|不想面试了|退出面试|不继续面试了)$/.test(
      value,
    ) ||
    (confirmation && /^(?:不继续了|不继续|结束|不想继续|结束吧)$/.test(value))
  );
}
export function participationPolicy(interview: Interview): InterviewParticipation | null {
  let streak = 0;
  let latest: InterviewParticipation | null = null;
  for (const turn of interview.turns) {
    if (turn.answer_status === 'waiting') continue;
    // Skipping a question is an allowed action, not evidence of deliberate disruption.
    if (turn.answer_status !== 'answered' || !turn.answer_text) {
      streak = 0;
      latest = null;
      continue;
    }
    const text = turn.answer_text;
    const checkpoint = isParticipationQuestion(turn.purpose);
    if (stopRequested(text, checkpoint)) {
      latest = {
        level: 'ended',
        reason: 'candidate_stop',
        turn_id: turn.id,
        message: '已按你的意愿结束本场面试，已提交的回答会保留。',
      };
      break;
    }
    const reason = signal(text);
    if (!reason) {
      streak = 0;
      latest = null;
      continue;
    }
    streak++;
    const level =
      turn.purpose === marker + 'confirmation'
        ? 'ended'
        : turn.purpose === marker + 'reminder'
          ? 'confirmation'
          : reason !== 'repeated_non_answers' || streak >= 2
            ? 'reminder'
            : null;
    if (!level) continue;
    const context =
      reason === 'disruptive_language'
        ? '刚才出现了直接辱骂。'
        : reason === 'explicit_non_participation'
          ? '你明确表示不参与作答。'
          : '连续几次回复还没有进入面试内容。';
    latest = {
      level,
      reason,
      turn_id: turn.id,
      message:
        context +
        (level === 'ended'
          ? '提醒并确认继续意愿后，仍未恢复交流，本场面试已结束。已提交的回答会保留。'
          : level === 'confirmation'
            ? '如果继续，请围绕问题回答；不熟悉可以直接说明。再次出现同样情况，本场面试将结束。'
            : '可以说明不会、跳过题目或换话题。接下来请尝试回答一个与岗位相关的问题，也可以选择结束面试。'),
    };
  }
  if (
    ['completed', 'failed'].includes(interview.status) &&
    !interview.end_reason?.startsWith(marker)
  )
    return null;
  return latest;
}
export function participationQuestion(notice: InterviewParticipation): InterviewQuestion {
  return {
    stage: 'experience',
    topic: notice.level === 'confirmation' ? '继续意愿确认' : '面试交流提醒',
    purpose: marker + notice.level,
    acknowledgement:
      notice.level === 'confirmation' ? '我们先确认一下是否继续。' : '我们先回到面试交流。',
    text:
      notice.level === 'confirmation'
        ? '你还希望继续本场面试吗？可以说“继续”，或直接结束。'
        : '请说一个你接触过的岗位相关知识点；还没学过也可以直接说明。',
    knowledge_question_id: null,
    source_refs: [],
    evidence_refs: [],
  };
}
