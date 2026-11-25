import type {
  InterviewConfig,
  JobTemplate,
  PersonalMaterial,
  PersonalSettings,
} from '@interviewlab/core';

export function applyInterviewDefaults(
  configuration: InterviewConfig,
  settings: PersonalSettings,
  materials: PersonalMaterial[],
  preserved: ReadonlySet<keyof InterviewConfig>,
): InterviewConfig {
  const resume = materials.find(
    (material) =>
      material.id === settings.default_resume_id &&
      material.kind === 'resume' &&
      material.confirmed,
  );
  return {
    ...configuration,
    ...(!preserved.has('interviewer_style') && settings.interviewer_style
      ? { interviewer_style: settings.interviewer_style }
      : {}),
    ...(!preserved.has('resume_ref') && resume
      ? { resume_ref: { id: resume.id, version: resume.version } }
      : {}),
  };
}

/** Keep the current stage when supported; otherwise use the selected template's stage. */
export function selectInterviewJob(
  configuration: InterviewConfig,
  job: JobTemplate,
): InterviewConfig {
  return {
    ...configuration,
    job: job.id,
    career_stage: job.stages.includes(configuration.career_stage)
      ? configuration.career_stage
      : job.stages[0],
    interview_type: 'technical_qa',
  };
}

export function initialInterviewConfiguration(
  job: JobTemplate,
  restored: InterviewConfig | null,
): InterviewConfig {
  if (restored?.job === job.id)
    return {
      ...restored,
      career_stage: job.stages.includes(restored.career_stage)
        ? restored.career_stage
        : job.stages[0],
    };
  return selectInterviewJob(
    restored ?? {
      job: job.id,
      career_stage: 'internship',
      interview_type: 'technical_qa',
      difficulty: '基础',
      duration_minutes: 10,
      interviewer_style: '标准',
      interaction_mode: 'text_fallback',
    },
    job,
  );
}

export function interviewSetupPath(jobId?: string): string {
  return jobId ? `/interview/setup?job=${encodeURIComponent(jobId)}` : '/interview/setup';
}
