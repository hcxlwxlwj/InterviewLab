import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { PathnameContext } from 'next/dist/shared/lib/hooks-client-context.shared-runtime';
import type { PersonalMaterial } from '@interviewlab/core';
import { getJob } from '../../code/backend/src/content/index';
import { SessionProvider } from '../../code/frontend/components/session-provider';
import { InterviewSetupPage } from '../../code/frontend/components/interview-setup';
import { InterviewFlowProvider } from '../../code/frontend/features/live-interview/flow-provider';
import {
  useSetupConfiguration,
  type SetupConfiguration,
  type SetupConfigurationOptions,
} from '../../code/frontend/features/live-interview/setup-controller';
import { initialInterviewConfiguration } from '../../code/frontend/features/live-interview/setup-state';
import { SetupPanels } from '../../code/frontend/features/live-interview/setup-panels';
import { SetupSummary } from '../../code/frontend/features/live-interview/setup-summary';

(globalThis as typeof globalThis & { React: typeof React }).React = React;
const job = getJob('ai-designer')!;
const noop = () => {};
const material: PersonalMaterial = {
  id: 'resume',
  kind: 'resume',
  version: 2,
  title: '作品与研究',
  text: '',
  confirmed: true,
  created_at: '2026-11-26T00:00:00Z',
};

function model(patch: Partial<SetupConfiguration> = {}): SetupConfiguration {
  return {
    config: initialInterviewConfiguration(job, null),
    change: noop,
    selectJob: noop,
    selectResume: noop,
    materials: [material],
    materialError: '',
    profiles: {
      value: {
        version: 'test',
        default_type: 'technical_qa',
        profiles: [
          { id: 'technical', version: 'test', type: 'technical_qa', label: '专业面', goals: [] },
        ],
      },
      error: '',
      refresh: async () => {},
      accept: noop,
      refreshing: false,
    },
    busy: false,
    blocked: false,
    selected: job,
    canStart: true,
    submit: noop,
    waiting: false,
    preparing: false,
    ...patch,
  };
}

function panels(configuration: SetupConfiguration, fixedJob: boolean) {
  return renderToStaticMarkup(
    React.createElement(SetupPanels, {
      model: configuration,
      initialJob: job,
      jobs: [job],
      fixedJob,
      catalogError: '',
    }),
  );
}

function summary(configuration: SetupConfiguration) {
  return renderToStaticMarkup(React.createElement(SetupSummary, { model: configuration }));
}

test('setup panels distinguish a fixed job entry from the navigation dropdown', () => {
  const fixed = panels(model(), true);
  const navigation = panels(model(), false);
  assert.doesNotMatch(fixed, /id="job-direction"/);
  assert.match(fixed, new RegExp(job.title));
  assert.match(fixed, /href="\/jobs"/);
  assert.match(navigation, /id="job-direction"/);
  for (const heading of ['面试方向', '面试设置', '面试简历', '作答方式']) {
    assert.match(fixed, new RegExp(heading));
  }
  assert.match(fixed, /name="career-stage"[^>]*checked=""[^>]*value="campus"/);
  assert.doesNotMatch(fixed, /name="career-stage"[^>]*value="internship"/);
});

test('setup keeps material errors distinct from an empty optional resume list', () => {
  const empty = panels(model({ materials: [] }), false);
  assert.match(empty, /还没有已确认简历/);
  assert.match(empty, /不使用简历/);
  const failed = panels(model({ materials: [], materialError: '简历读取失败' }), false);
  assert.match(failed, /role="alert">简历读取失败/);
  assert.doesNotMatch(failed, /还没有已确认简历/);
  const selected = panels(
    model({ config: { ...model().config, resume_ref: { id: material.id, version: 2 } } }),
    false,
  );
  assert.match(selected, /value="resume" selected=""/);
  assert.doesNotMatch(selected, /本次已选|冻结|版本 v/);
});

test('all answer modes retain the matching privacy guidance and summary label', () => {
  for (const [mode, label, guidance] of [
    ['text_fallback', '文字作答', '麦克风未采集'],
    ['realtime_voice', '语音面试', '准备时授权麦克风'],
    ['realtime_video', '视频面试', '画面不上传、不录像'],
  ] as const) {
    const configuration = model({ config: { ...model().config, interaction_mode: mode } });
    const fields = panels(configuration, true);
    assert.match(fields, new RegExp(guidance));
    assert.match(fields, /不保存音视频/);
    assert.match(summary(configuration), new RegExp(label));
  }
});

test('unavailable selections and profile errors remain visible and cannot start', () => {
  const base = model();
  const invalid = model({
    selected: undefined,
    blocked: true,
    canStart: false,
    profiles: { ...base.profiles, value: null, error: '岗位配置读取失败' },
  });
  const html = panels(invalid, false);
  assert.match(html, /所选岗位已不可用，请重新选择/);
  assert.match(html, /岗位配置读取失败/);
  assert.match(html, /<fieldset[^>]*disabled=""/);
  const side = summary(invalid);
  assert.match(side, /请选择岗位/);
  assert.match(side, /<button[^>]*disabled=""/);
});

test('summary preserves ready and busy start states', () => {
  assert.doesNotMatch(summary(model()), /<button[^>]*disabled=""/);
  const busy = summary(model({ canStart: false, busy: true }));
  assert.match(busy, /正在准备…/);
  assert.match(busy, /<button[^>]*disabled=""/);
});

function withProviders(child: React.ReactNode) {
  const unexpectedNavigation = () => {
    throw new Error('SSR must not navigate');
  };
  const router = {
    back: unexpectedNavigation,
    forward: unexpectedNavigation,
    refresh: unexpectedNavigation,
    push: unexpectedNavigation,
    replace: unexpectedNavigation,
    prefetch: noop,
    bfcacheId: 'test',
  };
  return React.createElement(
    AppRouterContext.Provider,
    { value: router },
    React.createElement(
      PathnameContext.Provider,
      { value: '/interview/setup' },
      React.createElement(
        SessionProvider,
        null,
        React.createElement(InterviewFlowProvider, null, child),
      ),
    ),
  );
}

test('real setup hook initializes a supported job and waits for profiles before starting', () => {
  let current: SetupConfiguration | undefined;
  const options: SetupConfigurationOptions = {
    initialJob: job,
    jobs: [job],
    fixedJob: true,
    catalogError: '',
  };
  function Probe() {
    current = useSetupConfiguration(options);
    return React.createElement(SetupSummary, { model: current });
  }
  const html = renderToStaticMarkup(withProviders(React.createElement(Probe)));
  assert.ok(current);
  assert.equal(current.config.job, job.id);
  assert.equal(current.config.career_stage, 'campus');
  assert.equal(current.canStart, false);
  assert.match(html, /<button[^>]*disabled=""/);
});

test('real setup hook keeps its known job configuration while a catalog error blocks start', () => {
  let current: SetupConfiguration | undefined;
  function Probe() {
    current = useSetupConfiguration({
      initialJob: job,
      jobs: [job],
      fixedJob: false,
      catalogError: '网络错误',
    });
    return React.createElement(InterviewSetupPage, {
      title: '配置模拟面试',
      children: React.createElement(SetupSummary, { model: current }),
    });
  }
  const html = renderToStaticMarkup(withProviders(React.createElement(Probe)));
  assert.ok(current);
  assert.equal(current.config.job, job.id);
  assert.equal(current.blocked, true);
  assert.equal(current.canStart, false);
  assert.match(html, /配置模拟面试/);
  assert.match(html, /设备默认关闭/);
});
