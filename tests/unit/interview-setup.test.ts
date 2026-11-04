import test from 'node:test';
import assert from 'node:assert/strict';
import type { InterviewConfig } from '@interviewlab/core';
import { JOBS, getJob } from '../../code/backend/src/content/index';
import { selectInterviewJob } from '../../code/frontend/features/live-interview/setup-state';
import { createAllRoleKnowledge } from '../../code/backend/src/modules/knowledge/all-roles';
import { loadConfig } from '../../code/backend/src/foundation/config';

const configuration: InterviewConfig = {
  job: 'frontend',
  career_stage: 'internship',
  interview_type: 'hr',
  difficulty: '基础',
  duration_minutes: 5,
  interviewer_style: '友好',
  interaction_mode: 'realtime_video',
  resume_ref: { id: 'selected-resume', version: 2 },
};

test('AI product designer selects campus instead of submitting an unsupported internship stage', () => {
  const job = getJob('ai-designer')!;
  const selected = selectInterviewJob(configuration, job);
  assert.equal(selected.job, 'ai-designer');
  assert.equal(selected.career_stage, 'campus');
  assert.equal(selected.interview_type, 'technical_qa');
  assert.equal(selected.interaction_mode, 'realtime_video');
  assert.deepEqual(selected.resume_ref, configuration.resume_ref);
  assert.equal(configuration.career_stage, 'internship');
});

test('switching back preserves a supported stage and retains unrelated settings', () => {
  const selected = selectInterviewJob({ ...configuration, career_stage: 'campus' }, getJob('frontend')!);
  assert.equal(selected.career_stage, 'campus');
  assert.equal(selected.duration_minutes, 5);
  assert.equal(selected.interviewer_style, '友好');
});

test('every catalog target selected from either stage produces a valid profile request', async () => {
  const knowledge = createAllRoleKnowledge(loadConfig({}));
  try {
    for (const job of JOBS) {
      for (const stage of ['internship', 'campus'] as const) {
        const selected = selectInterviewJob({ ...configuration, career_stage: stage }, job);
        assert.ok(job.stages.includes(selected.career_stage), job.id);
        const profiles = await knowledge.profiles(selected);
        assert.equal(profiles.profiles.length, 5, job.id);
      }
    }
  } finally {
    await knowledge.close();
  }
});
