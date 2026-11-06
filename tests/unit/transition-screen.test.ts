import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import {
  TransitionScreen,
  type TransitionScreenProps,
} from '../../code/frontend/features/live-interview/transition-screen';

(globalThis as typeof globalThis & { React: typeof React }).React = React;

const props: TransitionScreenProps = {
  kind: 'preparing',
  title: '正在准备你的面试',
  description: '正在准备岗位资料',
  steps: [
    { label: '检查设备', state: 'done' },
    { label: '准备岗位与简历', state: 'active' },
    { label: '规划面试', state: 'pending' },
    { label: '进入房间', state: 'pending' },
  ],
};

test('transition progress represents actual completed stages and announces the current phase', () => {
  const html = renderToStaticMarkup(React.createElement(TransitionScreen, props));
  assert.match(html, /role="dialog"/);
  assert.match(html, /aria-modal="true"/);
  assert.match(html, /aria-valuenow="1"/);
  assert.match(html, /aria-valuemax="4"/);
  assert.match(html, /width:25%/);
  assert.match(html, /role="status"/);
  assert.match(html, /正在准备岗位资料/);
  assert.ok(!html.includes('99%'));
});

test('the visible layout has one title, one status and no verbose stage list or repeated helper copy', () => {
  const html = renderToStaticMarkup(
    React.createElement(TransitionScreen, {
      ...props,
      detail: '详细的采集、计时和恢复说明仅供辅助技术读取',
      context: '专业面 · 10 分钟',
    }),
  );
  assert.equal((html.match(/<h1\b/g) ?? []).length, 1);
  assert.equal((html.match(/role="status"/g) ?? []).length, 1);
  assert.ok(!html.includes('<ol'));
  assert.ok(!html.includes('interview-transition__eyebrow'));
  assert.ok(!html.includes('interview-transition__footnote'));
  assert.ok(!html.includes('interview-transition__detail'));
  assert.match(html, /专业面 · 10 分钟/);
});

test('measured answer progress is clamped while unknown progress is indeterminate', () => {
  const measured = renderToStaticMarkup(
    React.createElement(TransitionScreen, {
      ...props,
      kind: 'analysis',
      progress: { value: 8, max: 3 },
    }),
  );
  assert.match(measured, /aria-valuenow="3"/);
  assert.match(measured, /aria-valuemax="3"/);
  const unknown = renderToStaticMarkup(
    React.createElement(TransitionScreen, { ...props, steps: [] }),
  );
  assert.ok(!unknown.includes('aria-valuenow'));
});

test('failure UI preserves real progress, escapes content and renders recovery actions', () => {
  const html = renderToStaticMarkup(
    React.createElement(TransitionScreen, {
      ...props,
      error: '<设备不可用>',
      context: '前端开发 · 专业面 · 20分钟',
      children: React.createElement('button', null, '重试设备'),
    }),
  );
  assert.match(html, /role="alert"/);
  assert.match(html, /&lt;设备不可用&gt;/);
  assert.match(html, /重试设备/);
  assert.match(html, /aria-valuenow="1"/);
  assert.ok(!html.includes('interview-transition__shimmer'));
});

test('animation is viewport sized, scrollable and fully disabled for reduced motion', () => {
  const css = readFileSync('code/frontend/features/live-interview/transition-screen.css', 'utf8');
  assert.match(css, /height: 100dvh/);
  assert.match(css, /overflow: auto/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /animation: none !important/);
  assert.match(css, /@keyframes transition-morph/);
  assert.match(css, /@keyframes transition-surface/);
  assert.match(css, /@keyframes transition-float/);
  assert.ok(!css.includes('animation-play-state: paused'));
});
