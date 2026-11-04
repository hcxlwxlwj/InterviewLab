import type { InterviewConfig, JobTemplate } from '@interviewlab/core';

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
