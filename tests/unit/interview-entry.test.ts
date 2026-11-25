import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { PersonalMaterial } from '@interviewlab/core';
import SetupPage from '../../code/frontend/app/interview/setup/page';
import {
  SelectedSetupJob,
  SetupJobSelection,
  SetupResumeSelection,
} from '../../code/frontend/features/live-interview/setup-fields';

(globalThis as typeof globalThis & { React: typeof React }).React = React;

test('setup without a selected job opens the configurable navigation entry', async () => {
  for (const job of [undefined, '', '   ']) {
    const page = await SetupPage({ searchParams: Promise.resolve({ job }) });
    assert.equal(page.props.jobId, undefined);
  }
});

test('ambiguous job entries return to the job library', async () => {
  await assert.rejects(
    SetupPage({ searchParams: Promise.resolve({ job: ['frontend', 'backend'] }) }),
    (error: unknown) =>
      error instanceof Error && 'digest' in error && String(error.digest).includes(';/jobs;'),
  );
});

test('setup passes the explicitly selected job to the form without a default role', async () => {
  const page = await SetupPage({ searchParams: Promise.resolve({ job: ' ai-designer ' }) });
  assert.ok(React.isValidElement<{ jobId: string }>(page));
  assert.equal(page.props.jobId, 'ai-designer');
});

test('selected job is fixed text with a job-library action, without a role select', () => {
  const html = renderToStaticMarkup(
    React.createElement(SelectedSetupJob, { job: { id: 'ai-designer', title: 'AI 设计师' } }),
  );
  assert.match(html, /AI 设计师/);
  assert.match(html, /href="\/jobs"/);
  assert.match(html, /更换岗位/);
  assert.doesNotMatch(html, /<select|<option/);
});

test('navigation entry offers a labeled job dropdown with the selected role', () => {
  const html = renderToStaticMarkup(
    React.createElement(SetupJobSelection, {
      jobs: [
        { id: 'frontend', title: '前端工程师' },
        { id: 'ai-designer', title: 'AI 设计师' },
      ] as Parameters<typeof SetupJobSelection>[0]['jobs'],
      value: 'ai-designer',
      disabled: false,
      onChange: () => {},
    }),
  );
  assert.match(html, /<label[^>]*for="job-direction"/);
  assert.match(html, /<select id="job-direction"/);
  assert.match(html, /<option value="ai-designer" selected="">AI 设计师<\/option>/);
  assert.match(html, /<option value="frontend">前端工程师<\/option>/);
});

test('resume selection keeps optional materials and management without developer explanations', () => {
  const html = renderToStaticMarkup(
    React.createElement(SetupResumeSelection, {
      materials: [{ id: 'resume', title: '产品简历', version: 2 } as PersonalMaterial],
      value: 'resume',
      disabled: false,
      onChange: () => {},
    }),
  );
  assert.match(html, /<option value="resume" selected="">产品简历<\/option>/);
  assert.match(html, /不使用简历/);
  assert.match(html, /href="\/me\/resumes"/);
  assert.doesNotMatch(html, /本次已选|冻结|版本|多份简历|只有已确认/);
});
