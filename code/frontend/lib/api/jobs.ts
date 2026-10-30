import type { ContentSource, JobTemplate, PageResult } from '@interviewlab/core';
import { apiRequest } from './http';
export const jobsApi = {
  categories: (signal?: AbortSignal) =>
    apiRequest<PageResult<{ id: string; title: string }>>('/job-categories', { signal }),
  list: (query: string, signal?: AbortSignal) =>
    apiRequest<PageResult<JobTemplate>>(`/job-templates?${query}`, { signal }),
  read: (id: string, signal?: AbortSignal) =>
    apiRequest<JobTemplate & { sources: ContentSource[] }>(
      `/job-templates/${encodeURIComponent(id)}`,
      { signal },
    ),
};
