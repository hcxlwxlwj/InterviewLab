import { z } from 'zod';
import type { ApiError, TaskAccepted, TaskView, VersionRef } from '@interviewlab/core';
export const errorSchema = z.object({
  code: z.string(),
  message: z.string(),
  retryable: z.boolean(),
  request_id: z.string(),
}) satisfies z.ZodType<ApiError>;
export const versionRefSchema = z.object({
  id: z.string().min(1),
  version: z.number().int().positive(),
}) satisfies z.ZodType<VersionRef>;
export const taskStatusSchema = z.enum(['queued', 'running', 'succeeded', 'failed', 'cancelled']);
export const taskAcceptedSchema = z.object({
  task_id: z.string().uuid(),
  status: taskStatusSchema,
}) satisfies z.ZodType<TaskAccepted>;
export const taskViewSchema = z.object({
  id: z.string().uuid(),
  type: z.string(),
  status: taskStatusSchema,
  input_digest: z.string(),
  attempts: z.number().int().nonnegative(),
  max_attempts: z.number().int().positive(),
  result_ref: versionRefSchema.nullable(),
  error_code: z.string().nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
}) satisfies z.ZodType<TaskView>;
export const pageSchema = <T extends z.ZodType>(item: T) =>
  z.object({
    items: z.array(item),
    next_cursor: z.string().nullable(),
  });
