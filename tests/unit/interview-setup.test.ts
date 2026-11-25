import test from 'node:test';
import assert from 'node:assert/strict';
import type { InterviewConfig, PersonalMaterial, PersonalSettings } from '@interviewlab/core';
import { JOBS, getJob } from '../../code/backend/src/content/index';
import {
  applyInterviewDefaults,
  initialInterviewConfiguration,
  interviewSetupPath,
  selectInterviewJob,
} from '../../code/frontend/features/live-interview/setup-state';
import { createAllRoleKnowledge } from '../../code/backend/src/modules/knowledge/all-roles';
import { loadConfig } from '../../code/backend/src/foundation/config';

const configuration: InterviewConfig = {
  job: 'frontend',
  career_stage: 'internship',
  interview_type: 'hr',
  difficulty: '基础',
  duration_minutes: 10,
  interviewer_style: '友好',
  interaction_mode: 'realtime_video',
  resume_ref: { id: 'selected-resume', version: 2 },
};

const settings: PersonalSettings = {
  display_name: '',
  bio: '',
  target_role: '',
  practice_minutes: 10,
  interviewer_style: '深入追问',
  default_resume_id: 'default-resume',
};
const materials: PersonalMaterial[] = [
  {
    id: 'default-resume',
    kind: 'resume',
    version: 3,
    title: 'Default resume',
    text: '',
    confirmed: true,
    created_at: '2026-11-24T00:00:00Z',
  },
];

test('account defaults fill a new untouched setup without changing unrelated fields', () => {
  const selected = applyInterviewDefaults(configuration, settings, materials, new Set());
  assert.deepEqual(selected, {
    ...configuration,
    interviewer_style: '深入追问',
    resume_ref: { id: 'default-resume', version: 3 },
  });
  assert.equal(configuration.interviewer_style, '友好');
});

test('late defaults preserve edited fields individually, including an explicitly cleared resume', () => {
  const editedStyle = applyInterviewDefaults(
    configuration,
    settings,
    materials,
    new Set(['interviewer_style']),
  );
  assert.equal(editedStyle.interviewer_style, '友好');
  assert.equal(editedStyle.resume_ref?.id, 'default-resume');
  const clearedResume = applyInterviewDefaults(
    { ...configuration, resume_ref: undefined },
    settings,
    materials,
    new Set(['resume_ref']),
  );
  assert.equal(clearedResume.resume_ref, undefined);
  assert.equal(clearedResume.interviewer_style, '深入追问');
});

test('restored setups retain both their selected resume version and a deliberate no-resume choice', () => {
  const preserved = new Set<keyof InterviewConfig>(['resume_ref', 'interviewer_style']);
  for (const restored of [configuration, { ...configuration, resume_ref: undefined }]) {
    assert.deepEqual(applyInterviewDefaults(restored, settings, materials, preserved), restored);
  }
});

test('an unconfirmed default material cannot be selected for a new setup', () => {
  const selected = applyInterviewDefaults(
    { ...configuration, resume_ref: undefined },
    settings,
    [{ ...materials[0], confirmed: false }],
    new Set(),
  );
  assert.equal(selected.resume_ref, undefined);
});

test('missing defaults and a confirmed experience never replace a resume choice', () => {
  const withoutStyle = { ...settings, interviewer_style: undefined };
  const experience = { ...materials[0], kind: 'experience' as const };
  for (const available of [[], [experience]]) {
    assert.deepEqual(
      applyInterviewDefaults(configuration, withoutStyle, available, new Set()),
      configuration,
    );
  }
});

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
  const selected = selectInterviewJob(
    { ...configuration, career_stage: 'campus' },
    getJob('frontend')!,
  );
  assert.equal(selected.career_stage, 'campus');
  assert.equal(selected.duration_minutes, 10);
  assert.equal(selected.interviewer_style, '友好');
});

test('a job entry overrides an older setup while preserving unrelated user choices', () => {
  const job = getJob('ai-designer')!;
  const selected = initialInterviewConfiguration(job, configuration);
  assert.equal(selected.job, job.id);
  assert.equal(selected.career_stage, 'campus');
  assert.equal(selected.interview_type, 'technical_qa');
  assert.equal(selected.interaction_mode, configuration.interaction_mode);
  assert.deepEqual(selected.resume_ref, configuration.resume_ref);
  assert.equal(configuration.job, 'frontend');
  assert.deepEqual(
    initialInterviewConfiguration(getJob('frontend')!, configuration),
    configuration,
  );
});

test('restoring the same job normalizes an unsupported stage without losing its settings', () => {
  const job = getJob('ai-designer')!;
  const restored = { ...configuration, job: job.id };
  const selected = initialInterviewConfiguration(job, restored);
  assert.deepEqual(selected, { ...restored, career_stage: 'campus' });
  assert.equal(restored.career_stage, 'internship');
  assert.equal(selected.interview_type, 'hr');
  assert.deepEqual(selected.resume_ref, configuration.resume_ref);
});

test('setup recovery retains a known job and allows selection for an unknown target', () => {
  assert.equal(interviewSetupPath('frontend'), '/interview/setup?job=frontend');
  assert.equal(interviewSetupPath('role/中文'), '/interview/setup?job=role%2F%E4%B8%AD%E6%96%87');
  assert.equal(interviewSetupPath(), '/interview/setup');
  assert.equal(interviewSetupPath(''), '/interview/setup');
  const fresh = initialInterviewConfiguration(getJob('ai-designer')!, null);
  assert.equal(fresh.job, 'ai-designer');
  assert.equal(fresh.career_stage, 'campus');
  assert.equal(fresh.interaction_mode, 'text_fallback');
});

test('every catalog target selected from either stage produces a valid profile request', async () => {
  const knowledge = createAllRoleKnowledge(loadConfig({}));
  try {
    for (const job of JOBS) {
      for (const stage of ['internship', 'campus'] as const) {
        const selected = selectInterviewJob({ ...configuration, career_stage: stage }, job);
        assert.ok(job.stages.includes(selected.career_stage), job.id);
        const profiles = await knowledge.profiles(selected);
        assert.equal(profiles.profiles.length, 4, job.id);
      }
    }
  } finally {
    await knowledge.close();
  }
});
