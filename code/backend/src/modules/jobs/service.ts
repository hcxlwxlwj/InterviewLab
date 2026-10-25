import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { JobSearchQuery, JobTemplate, PageResult } from '@interviewlab/core';
import type { CatalogRepository } from './repository';
import { ServiceError } from '../../foundation/errors';
const cursorSchema = z.object({ after: z.string(), fingerprint: z.string() });
export function createJobsService(repository: CatalogRepository) {
  return {
    categories: () => repository.categories(),
    list(query: JobSearchQuery & { limit: number; cursor?: string }): PageResult<JobTemplate> {
      const items = [...repository.search(query)].sort((a, b) => a.id.localeCompare(b.id, 'en'));
      const fingerprint = createHash('sha256')
        .update(
          JSON.stringify({
            search: query.search ?? '',
            category: query.category ?? '',
            stage: query.stage ?? '',
            items: items.map((item) => [item.id, item.version]),
          }),
        )
        .digest('hex');
      let start = 0;
      if (query.cursor) {
        try {
          const cursor = cursorSchema.parse(
            JSON.parse(Buffer.from(query.cursor, 'base64url').toString('utf8')),
          );
          const index = items.findIndex((item) => item.id === cursor.after);
          if (cursor.fingerprint !== fingerprint || index < 0) throw new Error('Invalid cursor');
          start = index + 1;
        } catch {
          throw new ServiceError(
            'unsupported_input',
            400,
            'Cursor is invalid or no longer matches this query',
          );
        }
      }
      const page = items.slice(start, start + query.limit);
      return {
        items: page,
        next_cursor:
          start + query.limit < items.length
            ? Buffer.from(
                JSON.stringify({ after: page[page.length - 1].id, fingerprint }),
              ).toString('base64url')
            : null,
      };
    },
    detail(id: string) {
      const job = repository.get(id);
      if (!job) throw new ServiceError('not_found', 404, 'Published job not found');
      return { ...job, sources: repository.sources(job.source_refs) };
    },
  };
}
export type JobsService = ReturnType<typeof createJobsService>;
