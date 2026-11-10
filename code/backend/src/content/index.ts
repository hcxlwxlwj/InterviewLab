import { createJobCatalog, type ContentSource, type JobTemplate } from '@interviewlab/core';
import categoriesData from '../../../../docs/algorithm/content/categories.json';
import jobsData from '../../../../docs/algorithm/content/jobs.json';
import sourcesData from '../../../../docs/algorithm/content/sources.json';
export { STAGE_LABELS, templateJd } from '@interviewlab/core';
export const JOB_CATEGORIES = categoriesData;
export const CONTENT_SOURCES = sourcesData as ContentSource[];
export const { ALL_JOB_TEMPLATES, JOBS, getJob, searchJobs, localKnowledgeRetriever } =
  createJobCatalog(jobsData as JobTemplate[], CONTENT_SOURCES);

export { default as frontendReportReference } from '../../../../docs/algorithm/content/frontend-report-reference.json';

export { default as professionalFoundations } from '../../../../docs/algorithm/content/professional-foundations.json';
export { default as teacherAgentQuestions } from '../../../../docs/algorithm/content/teacher-agent-questions.json';
