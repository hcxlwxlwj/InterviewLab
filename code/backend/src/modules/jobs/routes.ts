import { z } from 'zod';
import type { JobTemplate, ContentSource } from '@interviewlab/core';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import type { BackendModule } from '../contracts';
import type { JobsService } from './service';
import { errorSchema, pageSchema } from '../../foundation/schemas';

const strings = z.array(z.string());
const stageSchema = z.enum(['internship', 'campus']);
const sourceSchema = z.object({
  id: z.string(),
  title: z.string(),
  url: z.string(),
  publisher: z.string(),
  kind: z.enum(['recruitment', 'official_documentation']),
  usage: z.literal('reference_only'),
  verification: z.enum(['page_read', 'search_index']),
  acquired_at: z.string(),
  reviewed_at: z.string(),
  notes: z.string(),
}) satisfies z.ZodType<ContentSource>;
const questionSchema = z.object({
  id: z.string(),
  topic: z.string(),
  text: z.string(),
  intent: z.string(),
  observation_points: strings,
  follow_ups: strings,
  stages: z.array(stageSchema),
  difficulty: z.enum(['基础', '进阶', '挑战']),
  source_refs: strings,
  origin: z.literal('platform_authored'),
  version: z.number().int().positive(),
});
export const jobSchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  category_id: z.string(),
  subtitle: z.string(),
  description: z.string(),
  tags: strings,
  version: z.number().int().positive(),
  status: z.enum(['draft', 'reviewed', 'published', 'retired']),
  authorship: z.literal('platform_original'),
  review_method: z.string(),
  stages: z.array(stageSchema),
  responsibilities: strings,
  requirements: strings,
  preferred: strings,
  topics: strings,
  questions: z.array(questionSchema),
  source_refs: strings,
  created_at: z.string(),
  reviewed_at: z.string(),
  review_due_at: z.string(),
  code_relevant: z.boolean(),
  jd_note: z.string(),
}) satisfies z.ZodType<JobTemplate>;

export function jobsModule(service: JobsService): BackendModule {
  return {
    name: 'jobs',
    async register(instance) {
      const app = instance.withTypeProvider<ZodTypeProvider>();
      app.get(
        '/job-categories',
        {
          schema: {
            tags: ['jobs'],
            response: { 200: pageSchema(z.object({ id: z.string(), title: z.string() })) },
          },
        },
        async () => ({ items: service.categories(), next_cursor: null }),
      );
      app.get(
        '/job-templates',
        {
          schema: {
            tags: ['jobs'],
            querystring: z.object({
              search: z.string().trim().max(200).optional(),
              category: z.string().max(100).optional(),
              stage: stageSchema.optional(),
              limit: z.coerce.number().int().min(1).max(50).default(20),
              cursor: z.string().min(1).max(2000).optional(),
            }),
            response: { 200: pageSchema(jobSchema), 400: errorSchema },
          },
        },
        async (request) => service.list(request.query),
      );
      app.get(
        '/job-templates/:id',
        {
          schema: {
            tags: ['jobs'],
            params: z.object({ id: z.string().min(1).max(100) }),
            response: {
              200: jobSchema.extend({ sources: z.array(sourceSchema) }),
              400: errorSchema,
              404: errorSchema,
            },
          },
        },
        async (request) => service.detail(request.params.id),
      );
    },
  };
}
