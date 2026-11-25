import {
  interviewDurationMinutes,
  LIVE_TYPE_LABELS,
  type Interview,
  type InterviewPreview,
} from '@interviewlab/core';
import type { WorkspaceTurn } from '../../components/interview-workspace';

const STAGES = {
  introduction: '自我介绍',
  experience: '经历交流',
  technical: '专业交流',
  business: '业务交流',
  behavioral: '动机与协作',
  closing: '面试收尾',
};

function workspaceTurns(view: Interview): WorkspaceTurn[] {
  return view.turns.map((turn) => ({
    id: turn.id,
    text: turn.text,
    label: turn.stage
      ? STAGES[turn.stage]
      : `主问题 ${turn.main_question_index}${turn.follow_up_index ? ` · 追问 ${turn.follow_up_index}` : ''}`,
    acknowledgement: turn.acknowledgement,
    status: turn.answer_status,
    answer: turn.answer_text,
    inputMode: turn.input_mode,
  }));
}

function interviewerStatus(view: Interview, preview: InterviewPreview | null) {
  if (view.status === 'paused') return '面试已暂停';
  if (['completed', 'failed'].includes(view.status)) return '本场交流已结束';
  if (view.generation_status === 'pending') return preview ? '正在提问…' : '正在结合你的回答…';
  if (view.turns.at(-1)?.answer_status === 'waiting') return '等待你的回答';
  if (view.generation_status === 'failed') return '生成失败，可重试';
  return '准备开始';
}

function currentQuestion(
  view: Interview,
  turns: WorkspaceTurn[],
  preview: InterviewPreview | null,
): WorkspaceTurn | undefined {
  if (preview)
    return {
      id: 'generation-preview',
      text: preview.text,
      label: '面试官正在提问',
      acknowledgement: preview.acknowledgement,
      status: 'waiting',
      answer: null,
    };
  if (['completed', 'failed'].includes(view.status) && view.participation?.level === 'ended')
    return {
      id: 'participation-ended',
      text: '本场面试已结束。',
      label: '结束说明',
      status: 'answered',
      answer: null,
    };
  return turns.at(-1);
}

function elapsedSeconds(view: Interview, now: number) {
  if (!view.started_at) return 0;
  const terminal = view.status === 'completed' || view.status === 'failed';
  const end = terminal && view.ended_at ? Date.parse(view.ended_at) : now;
  return Math.min(
    (Math.max(10, interviewDurationMinutes(view)) + 2) * 60,
    Math.max(0, Math.floor((end - Date.parse(view.started_at)) / 1000)),
  );
}

/** Project the authority state into presentation without changing interview or timing rules. */
export function interviewPresentation(
  view: Interview,
  now: number,
  preview: InterviewPreview | null,
) {
  const turns = workspaceTurns(view);
  return {
    turns,
    current: currentQuestion(view, turns, preview),
    interviewerStatus: interviewerStatus(view, preview),
    seconds: elapsedSeconds(view, now),
    typeLabel: view.parent_interview_id
      ? '单题重练'
      : LIVE_TYPE_LABELS[view.configuration.interview_type],
    saveLabel: view.turns.some((turn) => turn.answer_status === 'answered')
      ? '回答已保存'
      : '提交后保存',
  };
}
