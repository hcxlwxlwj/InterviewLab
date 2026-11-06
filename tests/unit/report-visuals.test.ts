import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  FEEDBACK_DIMENSIONS,
  completeInterviewAssessments,
  type FeedbackAssessment,
  type InterviewReport,
} from '@interviewlab/core';
import {
  AbilityRadar,
  FeedbackScoreTable,
  TotalScore,
} from '../../code/frontend/features/live-interview/report-charts';

(globalThis as typeof globalThis & { React: typeof React }).React = React;
const assessments: FeedbackAssessment[] = FEEDBACK_DIMENSIONS.map((d) => ({
  dimension: d.key,
  score: 60,
  text: '回答包含对应的具体做法。',
  evidence_refs: [{ turn_id: 'answer', revision: 1, quote: '我验证了边界情况。' }],
}));

test('a whole-interview report renders all six radar axes including zero demonstrations', () => {
  const values = completeInterviewAssessments([
    { ...assessments[3], score: 60 },
    { ...assessments[1], score: 45 },
  ]);
  const html = renderToStaticMarkup(
    React.createElement(AbilityRadar, { feedback: null, assessments: values }),
  );
  assert.match(html, /<polygon/);
  for (const d of FEEDBACK_DIMENSIONS) assert.ok(html.includes(d.short));
  assert.equal(values.filter((a) => a.score === 0).length, 4);
  assert.ok(!html.includes('未考察'));
});

test('a radar omits dimensions without scores and keeps all six when the interview covers them', () => {
  const partial = renderToStaticMarkup(
    React.createElement(AbilityRadar, {
      feedback: null,
      assessments: assessments.slice(0, 3),
    }),
  );
  assert.match(partial, /能力雷达图/);
  assert.match(partial, /专业基础/);
  assert.ok(!partial.includes('岗位匹配度'));
  assert.ok(!partial.includes('未考察'));
  assert.ok(!partial.includes('证据不足'));
  const complete = renderToStaticMarkup(
    React.createElement(AbilityRadar, { feedback: null, assessments }),
  );
  for (const dimension of FEEDBACK_DIMENSIONS) assert.ok(complete.includes(dimension.short));
});

test('one observed dimension uses its real score and no invented radar vertices or empty score rows', () => {
  const selected = [assessments[4]];
  const radar = renderToStaticMarkup(
    React.createElement(AbilityRadar, { feedback: null, assessments: selected }),
  );
  assert.match(radar, /meter/);
  assert.ok(!radar.includes('<polygon'));
  const table = renderToStaticMarkup(
    React.createElement(FeedbackScoreTable, {
      report: {
        summary: null,
        feedback_assessments: selected,
        overall_score: null,
      } as InterviewReport,
    }),
  );
  assert.match(table, /岗位匹配度/);
  assert.ok(!table.includes('专业基础与知识深度'));
  assert.ok(!table.includes('未考察'));
});

test('a two-dimension report keeps its real score bars visible inside the report visual row', () => {
  const selected: FeedbackAssessment[] = [
    { ...assessments[0], score: 60 },
    { ...assessments[4], score: 65 },
  ];
  const html = renderToStaticMarkup(
    React.createElement(
      'div',
      { className: 'report-visual-row' },
      React.createElement(AbilityRadar, { feedback: null, assessments: selected }),
    ),
  );
  assert.match(html, /class="ability-bars"/);
  assert.match(html, /专业基础/);
  assert.match(html, /岗位匹配度/);
  assert.match(html, /60 \/ 100/);
  assert.match(html, /65 \/ 100/);
  assert.equal((html.match(/<meter /g) ?? []).length, 2);
  assert.ok(!html.includes('ability-chips'));
  assert.ok(!html.includes('<polygon'));

  const css = readFileSync('code/frontend/features/live-interview/report-design.css', 'utf8');
  assert.match(css, /\.ability-bars\s*\{[^}]*display:\s*grid/);
  assert.match(css, /\.ability-bars meter\s*\{[^}]*width:\s*100%/);
  const hiddenSelectors = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter(([, , rules]) => /display:\s*none/.test(rules))
    .map(([, selectors]) => selectors);
  assert.ok(hiddenSelectors.every((selector) => !selector.includes('.ability-bars')));
});

test('a completed unscorable response has no fabricated score or suggestion that analysis is still running', () => {
  const radar = renderToStaticMarkup(
    React.createElement(AbilityRadar, { feedback: null, assessments: [] }),
  );
  assert.ok(!radar.includes('<svg'));
  const total = renderToStaticMarkup(React.createElement(TotalScore, { score: null }));
  assert.match(total, /不足以形成综合评分/);
  assert.ok(!total.includes('正在生成'));
});
