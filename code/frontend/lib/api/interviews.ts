import type {
  Interview,
  InterviewProfiles,
  InterviewConfig,
  InterviewReport,
  ReportRequest,
  InterviewComparison,
  JobTemplate,
  PageResult,
} from '@interviewlab/core';
import { apiRequest } from './http';
export const interviewsApi = {
  profiles: (job: string, stage: string, signal?: AbortSignal) =>
    apiRequest<InterviewProfiles>(
      `/interview-profiles?job=${encodeURIComponent(job)}&career_stage=${encodeURIComponent(stage)}`,
      { signal },
    ),
  async jobs(signal?: AbortSignal): Promise<PageResult<JobTemplate>> {
    const items: JobTemplate[] = [];
    let cursor: string | null = null;
    do {
      const query = new URLSearchParams({ limit: '50' });
      if (cursor) query.set('cursor', cursor);
      const page = await apiRequest<PageResult<JobTemplate>>(`/job-templates?${query}`, { signal });
      items.push(...page.items);
      cursor = page.next_cursor;
    } while (cursor);
    return { items, next_cursor: null };
  },
  list: (query = '', signal?: AbortSignal) =>
    apiRequest<PageResult<Interview>>(`/interviews${query}`, { signal }),
  read: (id: string, signal?: AbortSignal) =>
    apiRequest<Interview>(`/interviews/${id}`, { signal }),
  create: (configuration: InterviewConfig, key: string) =>
    apiRequest<Interview>('/interviews', {
      method: 'POST',
      body: configuration,
      idempotencyKey: key,
    }),
  command: (id: string, action: string, body: unknown, key: string) =>
    apiRequest<Interview>(`/interviews/${id}/${action}`, {
      method: 'POST',
      body,
      idempotencyKey: key,
    }),
  remove: (id: string, version: number, key: string) =>
    apiRequest<void>(`/interviews/${id}`, {
      method: 'DELETE',
      body: { version },
      idempotencyKey: key,
    }),
  report: (id: string, signal?: AbortSignal) =>
    apiRequest<InterviewReport>(`/interviews/${id}/report`, { signal }),
  retryReport: (
    id: string,
    version: number,
    key: string,
    scope: ReportRequest['scope'] = 'missing',
  ) =>
    apiRequest<InterviewReport>(`/interviews/${id}/report`, {
      method: 'POST',
      body: { version, scope },
      idempotencyKey: key,
    }),
  retry: (id: string, body: { turn_id: string; revision: number; goal: string }, key: string) =>
    apiRequest<Interview>(`/interviews/${id}/retries`, {
      method: 'POST',
      body,
      idempotencyKey: key,
    }),
  comparison: (id: string, signal?: AbortSignal) =>
    apiRequest<InterviewComparison>(`/comparisons/${id}`, { signal }),
  compare: (
    body: {
      original_interview_id: string;
      retry_interview_id: string;
      original_turn_id: string;
      retry_turn_id: string;
      original_revision: number;
      retry_revision: number;
    },
    key: string,
  ) =>
    apiRequest<InterviewComparison>('/comparisons', { method: 'POST', body, idempotencyKey: key }),
  retryComparison: (id: string, version: number, key: string) =>
    apiRequest<InterviewComparison>(`/comparisons/${id}/retry`, {
      method: 'POST',
      body: { version },
      idempotencyKey: key,
    }),
};
