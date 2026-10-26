import test from 'node:test';
import assert from 'node:assert/strict';
import type { Interview } from '@interviewlab/core';
import { newInterviewState } from '../../code/backend/src/modules/interviews/repository';
import {
  participationPolicy,
  participationQuestion,
} from '../../code/backend/src/modules/interviews/participation';

function interview(): Interview {
  const v = newInterviewState('synthetic', {
    job: 'frontend',
    career_stage: 'internship',
    interview_type: 'technical_qa',
    difficulty: '基础',
    duration_minutes: 10,
    interviewer_style: '标准',
    interaction_mode: 'text_fallback',
  }).view;
  v.status = 'in_progress';
  return v;
}
function reply(v: Interview, answer: string, purpose = '了解实际经历') {
  const i = v.turns.length;
  v.turns.push({
    text: '你接触过哪些前端技术？',
    topic: '岗位交流',
    purpose,
    knowledge_question_id: null,
    source_refs: [],
    evidence_refs: [],
    id: `turn-${i}`,
    main_question_index: 1,
    follow_up_index: i % 3,
    generation_id: 'synthetic',
    presented_at: null,
    answer_status: 'answered',
    answer_text: answer,
    revision: 1,
    input_mode: 'text_fallback',
    answered_at: null,
  });
  return participationPolicy(v);
}
test('a single greeting, short valid answer, lack of knowledge or privacy refusal never penalises participation', () => {
  for (const text of [
    '你好',
    '不知道',
    '我不会CSS',
    '不方便',
    '项目涉及保密，不想说',
    '有',
    '是的',
    'BFC',
    '我被人骂了傻逼',
    '你问的问题不合理',
  ]) {
    const v = interview();
    assert.equal(reply(v, text), null, text);
  }
  const v = interview();
  for (const text of ['不方便', '没有项目', '不知道', '不会']) assert.equal(reply(v, text), null);
});
test('repeated greetings escalate only after a delivered reminder and confirmation', () => {
  const v = interview();
  assert.equal(reply(v, '你好'), null);
  const reminder = reply(v, '你好')!;
  assert.equal(reminder.level, 'reminder');
  const confirm = reply(v, '随便', participationQuestion(reminder).purpose)!;
  assert.equal(confirm.level, 'confirmation');
  const end = reply(v, '无所谓', participationQuestion(confirm).purpose)!;
  assert.equal(end.level, 'ended');
  assert.equal(end.turn_id, v.turns.at(-1)!.id);
});
test('explicit refusal to participate and direct insults get a boundary first, not an instant termination', () => {
  for (const text of ['我不配合', '我就不回答', '不管你问什么我都不回答', '你这个傻逼']) {
    const v = interview();
    const reminder = reply(v, text)!;
    assert.equal(reminder.level, 'reminder', text);
    const confirm = reply(v, text, participationQuestion(reminder).purpose)!;
    assert.equal(confirm.level, 'confirmation');
    assert.equal(reply(v, text, participationQuestion(confirm).purpose)?.level, 'ended');
  }
});
test('resuming, not knowing and declining a particular topic reset escalation', () => {
  for (const text of ['继续', '我学过HTML', '不知道', '这题不方便回答']) {
    const v = interview();
    const reminder = reply(v, '我不配合')!;
    const confirm = reply(v, '我不配合', participationQuestion(reminder).purpose)!;
    assert.equal(reply(v, text, participationQuestion(confirm).purpose), null);
    assert.equal(reply(v, '你好'), null);
  }
});
test('skip is permitted and does not accumulate a misconduct label', () => {
  const v = interview();
  reply(v, '你好');
  reply(v, '随便');
  v.turns.at(-1)!.answer_status = 'skipped';
  v.turns.at(-1)!.answer_text = null;
  assert.equal(participationPolicy(v), null);
});
test('end is explicit, survives reload, and ordinary completed interviews have no warning', () => {
  const v = interview();
  const notice = reply(v, '结束面试')!;
  assert.equal(notice.reason, 'candidate_stop');
  v.status = 'completed';
  v.end_reason = 'participation:candidate_stop';
  assert.deepEqual(participationPolicy(JSON.parse(JSON.stringify(v))), notice);
  v.end_reason = 'user_finished';
  assert.equal(participationPolicy(v), null);
  const other = interview();
  assert.equal(reply(other, '如果我不会，是否会结束面试？'), null);
});
