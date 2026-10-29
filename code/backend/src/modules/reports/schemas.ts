import { z } from 'zod';
import type { InterviewReport, ReportRequest } from '@interviewlab/core';
import { summaryOutput } from './analysis';
const evidence = z.object({ turn_id: z.string(), revision: z.number().int(), quote: z.string() });
const finding = z.object({ text: z.string(), evidence_refs: z.array(evidence) });
export const reportRequestBody = z
  .object({
    version: z.number().int().positive(),
    scope: z.enum(['missing', 'summary']).optional(),
  })
  .strict() satisfies z.ZodType<ReportRequest>;
const dimension = z.object({
  status: z.enum(['observed', 'not_observed']),
  score: z.number().int().min(0).max(100).nullable(),
  evidence_refs: z.array(evidence),
  explanation: z.string(),
});
export const reportSchema = z.object({
  id: z.string(),
  interview_id: z.string(),
  version: z.number().int(),
  task_ids: z.array(z.string()),
  status: z.enum(['pending', 'generating', 'ready', 'failed']),
  scoring_status: z.enum(['uncalibrated', 'experimental']),
  overall_score: z.number().int().min(0).max(100).nullable(),
  dimensions: z.object({
    technical_knowledge: dimension,
    project_communication: dimension,
    coding_ability: dimension,
    logical_expression: dimension,
  }),
  evaluations: z.array(
    z.object({
      turn_id: z.string(),
      revision: z.number().int(),
      strengths: z.array(finding),
      gaps: z.array(finding),
      reference_points: z.array(z.string()),
      retry_goal: z.string(),
      dimensions: z.array(
        z.enum([
          'technical_knowledge',
          'project_communication',
          'coding_ability',
          'logical_expression',
        ]),
      ),
      limitations: z.array(z.string()),
    }),
  ),
  missing_turn_ids: z.array(z.string()),
  is_partial: z.boolean(),
  coverage: z.string(),
  analysis_progress: z
    .object({
      total: z.number().int().nonnegative(),
      completed: z.number().int().nonnegative(),
      failed: z.number().int().nonnegative(),
      pending: z.number().int().nonnegative(),
    })
    .optional(),
  summary_status: z
    .enum(['pending', 'generating', 'ready', 'failed', 'not_applicable', 'not_requested'])
    .optional(),
  summary: summaryOutput.nullable().optional(),
  analysis_metadata: z
    .object({
      model: z.string(),
      prompt_version: z.string(),
      rubric_version: z.string(),
      schema_version: z.string(),
      scoring_rubric_version: z.string().optional(),
      input_mode: z.literal('text_fallback'),
    })
    .optional(),
}) satisfies z.ZodType<InterviewReport>;
