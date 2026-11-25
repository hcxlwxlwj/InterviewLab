import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Interview, InterviewPreview } from '@interviewlab/core';
import {
  InterviewProgressNotice,
  InterviewGenerationNotice,
} from '../../code/frontend/features/live-interview/interview-notices';

(globalThis as typeof globalThis & { React: typeof React }).React = React;
const view = {
  configuration: { duration_minutes: 20 },
  participation: { message: '请继续说明本人负责的部分' },
  retry_goal: '解释验证过程',
  generation_status: 'failed',
  turns: [{ answer_status: 'waiting' }],
} as Interview;

test('progress notices retain continuation, participation and the selected hard deadline', () => {
  const html = renderToStaticMarkup(
    React.createElement(InterviewProgressNotice, {
      view,
      continuation: true,
      targetReached: true,
      canContinue: false,
      onContinue: () => {},
      canExtend: false,
      onExtend: () => {},
      onFinish: () => {},
    }),
  );
  assert.match(html, /按已保存的回答继续提问/);
  assert.match(html, /disabled/);
  assert.match(html, /请继续说明本人负责的部分/);
  assert.match(html, /解释验证过程/);
  assert.match(html, /继续 5 分钟/);
  assert.match(html, /结束并查看报告/);
  assert.match(html, /22 分钟（含暂停和断线）后会自动封存/);
});

test('reaching the target time offers an extension and counts it into the hard deadline', () => {
  const extended = {
    ...view,
    extension_minutes: 5,
    generation_status: 'idle',
    turns: [{ answer_status: 'answered' }],
  } as Interview;
  const html = renderToStaticMarkup(
    React.createElement(InterviewProgressNotice, {
      view: extended,
      continuation: true,
      targetReached: true,
      canContinue: false,
      onContinue: () => {},
      canExtend: true,
      onExtend: () => {},
      onFinish: () => {},
    }),
  );
  assert.match(html, /继续 5 分钟/);
  assert.match(html, /结束并查看报告/);
  assert.match(html, /已到设定的 25 分钟/);
  assert.match(html, /27 分钟（含暂停和断线）后会自动封存/);
  assert.doesNotMatch(html, /<button class="text-link" disabled="">继续 5 分钟/);
});

test('generation failures offer independent retry and preserve the waiting question', () => {
  const html = renderToStaticMarkup(
    React.createElement(InterviewGenerationNotice, {
      view,
      preview: null,
      blocked: true,
      onRetry: () => {},
    }),
  );
  assert.match(html, /已保存的回答仍保留/);
  assert.match(html, /重试生成/);
  assert.match(html, /保留原题继续作答/);
  assert.equal((html.match(/disabled/g) ?? []).length, 2);
});

test('pending previews remain escaped and do not show the generic waiting message', () => {
  const html = renderToStaticMarkup(
    React.createElement(InterviewGenerationNotice, {
      view: { ...view, generation_status: 'pending' },
      preview: { text: '<当前问题>', acknowledgement: '已收到你的回答' } as InterviewPreview,
      blocked: false,
      onRetry: () => {},
    }),
  );
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /&lt;当前问题&gt;/);
  assert.doesNotMatch(html, /面试官正在结合你的陈述思考/);
});
