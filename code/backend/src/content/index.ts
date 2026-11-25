import {
  createJobCatalog,
  type ContentSource,
  type JobTemplate,
  type SupplementalQuestion,
} from '@interviewlab/core';
import categoriesData from '../../../../docs/algorithm/content/categories.json';
import jobsData from '../../../../docs/algorithm/content/jobs.json';
import sourcesData from '../../../../docs/algorithm/content/sources.json';
import publicInterviewSupplementsData from '../../../../docs/algorithm/content/public-interview-supplements.json';
import latestRoleSupplementsData from '../../../../docs/algorithm/content/latest-role-supplements.json';
import roleTaxonomyData from '../../../../docs/algorithm/content/review/role-taxonomy-v2.json';
export { STAGE_LABELS, templateJd } from '@interviewlab/core';
export const JOB_CATEGORIES = categoriesData;
export const CONTENT_SOURCES = sourcesData as ContentSource[];
export const ROLE_TAXONOMY = roleTaxonomyData;
export const LATEST_ROLE_SUPPLEMENTS = latestRoleSupplementsData;
export const PUBLIC_INTERVIEW_SUPPLEMENTS = publicInterviewSupplementsData as unknown as {
  schema_version: string;
  taxonomy_version: string;
  classification_status: string;
  status: string;
  review_status: string;
  human_approved: boolean;
  release_eligible: boolean;
  runtime_enabled: boolean;
  preservation: {
    published_job_count: number;
    published_question_count: number;
    supplemental_question_count: number;
    jobs_json_modified: boolean;
  };
  representative_jobs: {
    job_id: string;
    job_title: string;
    primary_class_id: string;
    role_family_id: string;
    eligible_job_ids: string[];
    candidate_ids: string[];
    candidate_count: number;
  }[];
  questions: SupplementalQuestion[];
  limitations: string[];
};
const catalog = createJobCatalog(
  jobsData as JobTemplate[],
  CONTENT_SOURCES,
  PUBLIC_INTERVIEW_SUPPLEMENTS.runtime_enabled ? PUBLIC_INTERVIEW_SUPPLEMENTS.questions : [],
);
export const { ALL_JOB_TEMPLATES, JOBS, getJob, searchJobs, localKnowledgeRetriever } = catalog;
export const JOB_CLASSES = ROLE_TAXONOMY.classes.map((jobClass) => ({
  ...jobClass,
  published_count: JOBS.filter((job) => job.primary_class_id === jobClass.id).length,
}));

export { default as frontendReportReference } from '../../../../docs/algorithm/content/frontend-report-reference.json';

export { default as professionalFoundations } from '../../../../docs/algorithm/content/professional-foundations.json';
export { default as teacherAgentQuestions } from '../../../../docs/algorithm/content/teacher-agent-questions.json';
