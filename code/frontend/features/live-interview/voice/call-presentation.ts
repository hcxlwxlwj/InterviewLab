import type { useInterviewVoice } from './use-voice';

export type VoiceState = ReturnType<typeof useInterviewVoice>;

export function callState(voice: VoiceState, ended: boolean) {
  const states = [
    ['ended', ended],
    ['connecting', voice.connecting],
    ['idle', !voice.active],
    ['muted', voice.muted],
    ['hold', voice.hold],
    ['speaking', voice.playing],
    ['hearing', voice.talking],
    ['thinking', voice.thinking],
  ] as const;
  return states.find(([, enabled]) => enabled)?.[0] ?? 'listening';
}

const labels = {
  ended: '本场通话已结束',
  connecting: '正在连接…',
  idle: '语音通话待连接',
  muted: '麦克风已静音',
  hold: '慢慢想，我在这里',
  speaking: '面试官正在说话',
  hearing: '正在听你说',
  thinking: '正在思考你的回答',
  listening: '我在听，你可以直接说话',
};

export function callLabel(voice: VoiceState, state: ReturnType<typeof callState>) {
  return state === 'idle' && voice.sessionStatus === 'ready' ? '准备好，就开始聊吧' : labels[state];
}

function activeCallHint(voice: VoiceState) {
  if (voice.muted) return '取消静音后继续说话';
  if (voice.hold) return '准备好后点一下“继续接话”';
  if (voice.playing) return '麦克风已自动暂停，听完后再回答';
  if (voice.thinking) return '想到新的内容，也可以继续补充';
  const silence = Math.round((voice.capabilities?.silence_ms ?? 3000) / 1000);
  return `说完停顿约 ${silence} 秒，我会接着问`;
}

export function callHint(voice: VoiceState, ended: boolean, preferred: boolean) {
  if (voice.active) return activeCallHint(voice);
  if (ended) return '已提交的讲话内容保存在面试记录中';
  if (!preferred) return '开启麦克风，直接说出你的回答';
  return voice.sessionStatus === 'ready'
    ? '点击右上角开始面试，允许麦克风后直接进入通话'
    : '语音已断开，可重新连接继续回答';
}
