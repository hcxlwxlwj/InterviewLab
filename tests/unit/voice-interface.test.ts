import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { InterviewWorkspace } from '../../code/frontend/components/interview-workspace';
import { VoiceControls } from '../../code/frontend/features/live-interview/voice/controls';
import {
  routeVoiceTranscript,
  type UnsubmittedVoiceSupplement,
  type useInterviewVoice,
} from '../../code/frontend/features/live-interview/voice/use-voice';
import { RealtimeVoiceClient } from '../../code/frontend/features/live-interview/voice/client';
import { loadConfig } from '../../code/backend/src/foundation/config';
import { VideoInterviewWorkspace } from '../../code/frontend/features/video-interview/room';
import { liveInterviewPath, type InterviewConfig, type Interview } from '@interviewlab/core';

// The repo's JSX-preserve compilation uses the classic React factory in Node tests.
(globalThis as typeof globalThis & { React: typeof React }).React = React;
const noop = () => {};
const workspace = {
  jobTitle: '前端开发',
  typeLabel: '专业面',
  interviewerLabel: 'AI 面试官',
  interviewerStatus: '等待回答',
  seconds: 0,
  durationMinutes: 5,
  turns: [],
  draft: '这段讲话必须保留',
  maxAnswer: 4000,
  canAnswer: true,
  paused: false,
  ended: false,
  saveLabel: '已保存',
  interviewerNote: '围绕真实经历交流',
  recordsHref: '/me/interviews',
  onText: noop,
  onSubmit: noop,
  onSkip: noop,
  onRepeat: noop,
  onPause: noop,
  onFinish: noop,
};
test('call mode removes the composer and chat log; switching back to text renders the same retained draft', () => {
  const call = renderToStaticMarkup(
    React.createElement(InterviewWorkspace, {
      ...workspace,
      voiceView: true,
      voiceActive: true,
      workspace: React.createElement('section', { 'aria-label': '语音通话' }, '通话中'),
    }),
  );
  assert.doesNotMatch(call, /<textarea|answer-composer|aria-label="面试对话记录"/);
  assert.match(call, /语音通话/);
  const text = renderToStaticMarkup(
    React.createElement(InterviewWorkspace, { ...workspace, voiceView: false }),
  );
  assert.match(text, /<textarea/);
  assert.match(text, /这段讲话必须保留/);
});
test('call UI has a voice orb, 3-second automatic turn hint, real mute control and collapsed saved transcripts', () => {
  const voice = {
    display: true,
    active: true,
    connecting: false,
    sessionStatus: 'in_progress',
    capabilities: { silence_ms: 3000 },
    turns: [],
    draft: '尚未提交的转写',
    error: '',
    switchToText: noop,
    toggleMute: noop,
    toggleHold: noop,
    stop: noop,
    interrupt: noop,
    commit: noop,
    repeat: noop,
  } as unknown as ReturnType<typeof useInterviewVoice>;
  const html = renderToStaticMarkup(React.createElement(VoiceControls, { voice, disabled: false }));
  assert.match(html, /voice-orb/);
  assert.match(html, /停顿约 3 秒/);
  assert.match(html, /aria-label="静音麦克风"/);
  assert.match(html, /<details class="voice-call-transcript">/);
  assert.doesNotMatch(html, /<details[^>]* open/);
  assert.match(html, /尚未提交的转写/);
  assert.match(html, /让我想想/);
  assert.match(html, /切回文字/);
  assert.doesNotMatch(html, /我说完了|停止播报|重听|挂断语音/);
  assert.doesNotMatch(html, /麦克风输入设备|麦克风输入音量|实时转写：/);
  assert.equal(loadConfig({}).VOICE_SILENCE_MS, 1800);
});

test('a late transcript keeps its original question and complete text without changing the current draft', () => {
  const view = {
    turns: [
      { id: 'old-question', text: '你当时如何验证缓存？' },
      { id: 'new-question', text: '你选择岗位的依据是什么？' },
    ],
  } as Pick<Interview, 'turns'>;
  let draft = '这是当前新题的输入';
  let supplement: UnsubmittedVoiceSupplement | undefined;
  const onDraft = (text: string) => {
    draft = text;
  };
  const preserve = (value: UnsubmittedVoiceSupplement) => {
    supplement = value;
  };
  for (const [text, final] of [
    ['我还补充了', false],
    ['我还补充了缓存失效的边界情况。\n原有数据也会重新验证。', true],
  ] as const) {
    routeVoiceTranscript(
      { type: 'transcript', turn_id: 'old-question', text, final },
      view,
      onDraft,
      preserve,
    );
    assert.equal(draft, '这是当前新题的输入');
    assert.deepEqual(supplement, {
      turn_id: 'old-question',
      question: '你当时如何验证缓存？',
      text,
    });
  }
  routeVoiceTranscript(
    { type: 'transcript', turn_id: null, text: '暂时无法归属的补充', final: true },
    view,
    onDraft,
    preserve,
  );
  assert.equal(draft, '这是当前新题的输入');
  assert.equal(supplement?.text, '暂时无法归属的补充');
  routeVoiceTranscript(
    { type: 'transcript', turn_id: 'new-question', text: '这是新题的有效转写', final: true },
    view,
    onDraft,
    preserve,
  );
  assert.equal(draft, '这是新题的有效转写');
});

test('unsubmitted old-question speech stays visible and copyable in both call and text recovery views', () => {
  for (const display of [true, false]) {
    const voice = {
      display,
      active: true,
      sessionStatus: 'in_progress',
      capabilities: { available: true },
      draft: '新题草稿',
      turns: [],
      error: '',
      supplements: [
        { turn_id: 'old', question: '原来的问题？', text: '完整补充第一行。\n第二行有 <原文>。' },
      ],
      dismissSupplement: noop,
    } as unknown as ReturnType<typeof useInterviewVoice>;
    const html = renderToStaticMarkup(
      React.createElement(VoiceControls, { voice, disabled: false }),
    );
    assert.match(html, /aria-label="未提交的语音补充"/);
    assert.match(html, /原来的问题？/);
    assert.match(html, /完整补充第一行。\n第二行有 &lt;原文&gt;。/);
    assert.match(html, /复制补充/);
    assert.match(html, /关闭补充提示/);
    assert.match(html, /这段内容未加入当前回答/);
  }
});
test('mute toggles the actual microphone track and ends local speech activity without closing the call', () => {
  const track = { enabled: true };
  const activity: boolean[] = [];
  const client = new RealtimeVoiceClient('test', noop, noop, noop, (value) => activity.push(value));
  Object.assign(client, { media: { getAudioTracks: () => [track] } });
  client.setMuted(true);
  assert.equal(track.enabled, false);
  assert.deepEqual(activity, [false]);
  client.setMuted(false);
  assert.equal(track.enabled, true);
});

test('video room renders a separate call layout without acquiring camera or replacing the voice orb', () => {
  const voice = {
    active: false,
    connecting: false,
    capabilities: { available: true },
    supplements: [{ turn_id: 'old', question: '旧题问题？', text: '视频中的完整旧题补充' }],
    dismissSupplement: noop,
  } as unknown as ReturnType<typeof useInterviewVoice>;
  const html = renderToStaticMarkup(
    React.createElement(VideoInterviewWorkspace, { ...workspace, voice, onStart: noop }),
  );
  assert.match(html, /独立视频面试房间/);
  assert.match(html, /video-room-sidebar/);
  assert.match(html, /interviewer-portrait-mouth/);
  assert.match(html, /数字人 · 中文男声/);
  assert.match(html, /开启摄像头/);
  assert.match(html, /共享屏幕/);
  assert.match(html, /摄像头未开启/);
  assert.match(html, /仅在本机预览/);
  assert.match(html, /视频中的完整旧题补充/);
  assert.match(html, /复制补充/);
  assert.doesNotMatch(html, /voice-orb|srcObject=|<video/);

  // The video room shares the same notice slot and duration budget as the text/voice rooms.
  const timeDecision = renderToStaticMarkup(
    React.createElement(VideoInterviewWorkspace, {
      ...workspace,
      voice,
      onStart: noop,
      durationMinutes: 15,
      notice: React.createElement(
        'div',
        { className: 'notice' },
        '继续 5 分钟',
        React.createElement('button', {}, '结束并查看报告'),
      ),
    }),
  );
  assert.match(timeDecision, /继续 5 分钟/);
  assert.match(timeDecision, /结束并查看报告/);
  assert.match(timeDecision, /15:00/);

  for (const interaction_mode of ['text_fallback', 'realtime_voice', 'realtime_video'] as const) {
    const path = liveInterviewPath({
      id: 'test-id',
      configuration: { interaction_mode } as InterviewConfig,
    });
    assert.equal(
      path,
      `/interview/test-id${interaction_mode === 'realtime_video' ? '/video' : ''}`,
    );
  }
});

test('ready voice room directs users to the start button and has no separate enable-voice step', () => {
  const voice = {
    display: true,
    active: false,
    connecting: false,
    sessionStatus: 'ready',
    capabilities: { available: true, silence_ms: 3000 },
    turns: [],
    draft: '',
    error: '',
  } as unknown as ReturnType<typeof useInterviewVoice>;
  const html = renderToStaticMarkup(
    React.createElement(VoiceControls, { voice, disabled: true, preferred: true }),
  );
  assert.match(html, /点击右上角开始面试/);
  assert.match(html, /麦克风权限/);
  assert.doesNotMatch(html, /开启实时语音|连接语音<|开启麦克风进入通话/);
});

test('voice mode retains clarification and skip actions for the current question', () => {
  const html = renderToStaticMarkup(React.createElement(InterviewWorkspace, {
    ...workspace,
    voiceView: true,
    current: { id: 'current', label: '第1题', text: '说明你的验证方法', status: 'waiting', answer: null },
    onClarify: noop,
  }));
  assert.match(html, /澄清题意/);
  assert.match(html, /跳过本题/);
  assert.doesNotMatch(html, /再看一遍题目/);
});

test('voice mode retains generation recovery controls outside its hidden conversation log', () => {
  const html = renderToStaticMarkup(
    React.createElement(InterviewWorkspace, {
      ...workspace,
      voiceView: true,
      conversationNotice: React.createElement('button', {}, '重试生成'),
    }),
  );
  assert.match(html, /重试生成/);
  assert.doesNotMatch(html, /aria-label="面试对话记录"/);
});

test('call status preserves mute, hold, playback and speech precedence while keeping recovery controls', () => {
  const cases = [
    {
      flags: { muted: true, hold: true, playing: true },
      state: 'muted',
      label: '麦克风已静音',
      hint: '取消静音后继续说话',
    },
    {
      flags: { hold: true, playing: true },
      state: 'hold',
      label: '慢慢想，我在这里',
      hint: '准备好后点一下“继续接话”',
    },
    {
      flags: { playing: true, talking: true },
      state: 'speaking',
      label: '面试官正在说话',
      hint: '麦克风已自动暂停，听完后再回答',
    },
    {
      flags: { talking: true, thinking: true },
      state: 'hearing',
      label: '正在听你说',
      hint: '想到新的内容，也可以继续补充',
    },
    {
      flags: { thinking: true },
      state: 'thinking',
      label: '正在思考你的回答',
      hint: '想到新的内容，也可以继续补充',
    },
    { flags: {}, state: 'listening', label: '我在听，你可以直接说话', hint: '说完停顿约 3 秒' },
  ];
  for (const { flags, state, label, hint } of cases) {
    const voice = {
      display: true,
      active: true,
      sessionStatus: 'in_progress',
      connecting: false,
      muted: false,
      hold: false,
      playing: false,
      talking: false,
      thinking: false,
      capabilities: { available: true, silence_ms: 3000 },
      turns: [],
      draft: '',
      error: '',
      ...flags,
    } as unknown as ReturnType<typeof useInterviewVoice>;
    const html = renderToStaticMarkup(
      React.createElement(VoiceControls, { voice, disabled: false }),
    );
    assert.ok(html.includes(`voice-call-${state}`));
    assert.ok(html.includes(label));
    assert.ok(html.includes(hint));
    assert.match(html, /挂断语音，保留面试和记录|切回文字/);
    assert.match(html, /aria-pressed="(?:true|false)"/);
  }
});

test('ended calls retain saved transcripts and drafts without offering a new connection', () => {
  for (const sessionStatus of ['completed', 'failed']) {
    const voice = {
      display: true,
      active: false,
      sessionStatus,
      capabilities: { available: true },
      error: '服务暂不可用',
      turns: [{ id: 'turn', text: '原问题', answer_text: '已保存的回答' }],
      draft: '尚未提交的补充',
    } as unknown as ReturnType<typeof useInterviewVoice>;
    const html = renderToStaticMarkup(
      React.createElement(VoiceControls, { voice, disabled: false, preferred: true }),
    );
    assert.match(html, /本场通话已结束/);
    assert.match(html, /原问题|已保存的回答/);
    assert.match(html, /尚未提交的补充/);
    assert.match(html, /role="alert"/);
    assert.doesNotMatch(html, /连接语音<|voice-call-consent|voice-call-buttons/);
    assert.match(html, /切回文字/);
  }
});
