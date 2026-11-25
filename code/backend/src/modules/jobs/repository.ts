import type { JobSearchQuery, JobTemplate, ContentSource } from '@interviewlab/core';
import { CONTENT_SOURCES, JOB_CATEGORIES, JOB_CLASSES, getJob, searchJobs } from '../../content';
export interface CatalogRepository {
  categories(): { id: string; title: string }[];
  jobClasses(): (typeof JOB_CLASSES)[number][];
  search(query: JobSearchQuery): JobTemplate[];
  get(id: string): JobTemplate | undefined;
  sources(refs: string[]): ContentSource[];
}
/** Published public content only; no synthetic user fixtures. */
export const publicCatalogRepository: CatalogRepository = {
  categories: () => JOB_CATEGORIES,
  jobClasses: () => JOB_CLASSES,
  search: searchJobs,
  get: getJob,
  sources: (refs) => CONTENT_SOURCES.filter((source) => refs.includes(source.id)),
};
