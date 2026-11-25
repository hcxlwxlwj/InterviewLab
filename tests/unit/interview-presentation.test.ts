import test from 'node:test';
import assert from 'node:assert/strict';
import type { Interview, InterviewPreview } from '@interviewlab/core';
import { interviewPresentation } from '../../code/frontend/features/live-interview/interview-presentation';

const view = () =>
  ({
    configuration: { duration_minutes: 20, interview_type: 'technical_qa' },
    status: 'in_progress',
    generation_status: 'idle',
    started_at: '2026-11-25T00:00:00Z',
    turns: [
      {
        id: 'question',
        text: '具体如何验证？',
        stage: 'technical',
        answer_status: 'waiting',
        answer_text: null,
      },
    ],
  }) as Interview;

test('running presentation preserves turn labels, saved answers and the selected deadline', () => {
  const state = view();
  const before = JSON.stringify(state);
  const result = interviewPresentation(state, Date.parse(state.started_at!) + 30 * 60000, null);
  assert.equal(result.typeLabel, '专业面');
  assert.equal(result.current?.label, '专业交流');
  assert.equal(result.seconds, 22 * 60);
  assert.equal(result.interviewerStatus, '等待你的回答');
  assert.equal(result.saveLabel, '提交后保存');
  assert.equal(JSON.stringify(state), before);
});

test('pending preview and paused state retain their original display priority', () => {
  const state = view();
  state.generation_status = 'pending';
  const preview = { text: '新的问题', acknowledgement: '收到' } as InterviewPreview;
  assert.equal(interviewPresentation(state, 0, null).interviewerStatus, '正在结合你的回答…');
  const result = interviewPresentation(state, 0, preview);
  assert.equal(result.interviewerStatus, '正在提问…');
  assert.equal(result.current?.id, 'generation-preview');
  state.status = 'paused';
  assert.equal(interviewPresentation(state, 0, preview).interviewerStatus, '面试已暂停');
});

test('ended and retry sessions keep frozen elapsed time and explicit end notices', () => {
  const state = view();
  state.status = 'completed';
  state.ended_at = '2026-11-25T00:03:00Z';
  state.parent_interview_id = 'original';
  state.participation = { level: 'ended', message: '已结束' } as Interview['participation'];
  state.turns[0].answer_status = 'answered';
  const result = interviewPresentation(state, Date.parse(state.ended_at) + 60000, null);
  assert.equal(result.seconds, 180);
  assert.equal(result.current?.id, 'participation-ended');
  assert.equal(result.typeLabel, '单题重练');
  assert.equal(result.saveLabel, '回答已保存');
});
