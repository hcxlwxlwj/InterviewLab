import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { InterviewWorkspace } from '../../code/frontend/components/interview-workspace';
import { VoiceControls } from '../../code/frontend/features/live-interview/voice/controls';
import type { useInterviewVoice } from '../../code/frontend/features/live-interview/voice/use-voice';
import { RealtimeVoiceClient } from '../../code/frontend/features/live-interview/voice/client';
import { loadConfig } from '../../code/backend/src/foundation/config';
import { VideoInterviewWorkspace } from '../../code/frontend/features/video-interview/room';
import { liveInterviewPath, type InterviewConfig } from '@interviewlab/core';

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
  assert.doesNotMatch(html, /麦克风输入设备|麦克风输入音量|实时转写：/);
  assert.equal(loadConfig({}).VOICE_SILENCE_MS, 3000);
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
  } as ReturnType<typeof useInterviewVoice>;
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
  assert.doesNotMatch(html, /voice-orb|srcObject=|<video/);
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
