import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FEEDBACK_DIMENSIONS,
  missingFeedbackDimensions,
  type InterviewMemory,
} from '@interviewlab/core';

test('feedback labels match the agreed six dimensions', () => {
  assert.deepEqual(
    FEEDBACK_DIMENSIONS.map((d) => d.short),
    ['专业基础', '项目理解', '逻辑思维', '表达沟通', '岗位匹配度', '综合素质'],
  );
});
test('interview coverage requires evidence and does not mistake missing or declined topics for observed answers', () => {
  const memory: InterviewMemory = {
    version: 1,
    focus: null,
    observations: [],
    claims: [],
    asked_intents: [],
  };
  assert.equal(missingFeedbackDimensions(memory, false).length, 6);
  assert.equal(missingFeedbackDimensions(memory, true).length, 5);
  const ref = { turn_id: 'turn', revision: 1, quote: '具体行动' };
  memory.observations = [
    { goal: 'contribution', state: 'covered', evidence_refs: [], pending: null },
    { goal: 'motivation', state: 'not_applicable', evidence_refs: [ref], pending: null },
  ];
  assert.equal(missingFeedbackDimensions(memory, true).length, 5);
  memory.observations = [
    'understanding',
    'contribution',
    'tradeoffs',
    'motivation',
    'learning',
  ].map((goal) => ({ goal, state: 'inconclusive', evidence_refs: [ref], pending: null }));
  // Inconclusive describes an observed but weak answer; it is not an invented positive score.
  assert.deepEqual(missingFeedbackDimensions(memory, true), []);
});
