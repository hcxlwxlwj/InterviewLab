import { z } from 'zod';
import {
  INTERVIEW_MAX_ANSWER,
  type Interview,
  type InterviewConfig,
  type InterviewReport,
  type InterviewComparison,
} from '@interviewlab/core';

export const interviewConfigSchema = z
  .object({
    job: z.string().min(1).max(100),
    career_stage: z.enum(['internship', 'campus']),
    interview_type: z.enum([
      'technical_qa',
      'business_scenario',
      'project_deep_dive',
      'hr',
      'mixed',
    ]),
    difficulty: z.literal('基础'),
    duration_minutes: z.union([z.literal(5), z.literal(10)]),
    interviewer_style: z.enum(['标准', '友好', '深入追问']),
    interaction_mode: z.literal('text_fallback'),
  })
  .strict() satisfies z.ZodType<InterviewConfig>;
export const versionBody = z.object({ version: z.number().int().positive() }).strict();
export const textAnswer = z
  .string()
  .min(1)
  .max(INTERVIEW_MAX_ANSWER)
  .refine((s) => Boolean(s.trim()), '回答不能为空');
export const answerBody = versionBody.extend({ text: textAnswer });
export const actionBody = versionBody.extend({
  action: z.enum(['skip', 'repeat_question', 'clarify_question']),
});
export const finishBody = versionBody.extend({
  reason: z.enum(['user_finished', 'completed']).default('user_finished'),
  final_answer: z.object({ turn_id: z.string().uuid(), text: textAnswer }).strict().optional(),
});
export const retryGenerationBody = versionBody.extend({ fallback: z.boolean().default(false) });
export const retryBody = z
  .object({
    turn_id: z.string().uuid(),
    revision: z.number().int().positive(),
    goal: z.string().min(1).max(500),
  })
  .strict();
export const comparisonBody = z
  .object({
    original_interview_id: z.string().uuid(),
    retry_interview_id: z.string().uuid(),
    original_turn_id: z.string().uuid(),
    retry_turn_id: z.string().uuid(),
    original_revision: z.number().int().positive(),
    retry_revision: z.number().int().positive(),
  })
  .strict();
const evidence = z.object({ turn_id: z.string(), revision: z.number().int(), quote: z.string() });
const finding = z.object({ text: z.string(), evidence_refs: z.array(evidence) });
export const turnSchema = z.object({
  stage: z
    .enum(['introduction', 'experience', 'technical', 'business', 'behavioral', 'closing'])
    .optional(),
  acknowledgement: z.string().optional(),
  id: z.string(),
  text: z.string(),
  topic: z.string(),
  purpose: z.string(),
  knowledge_question_id: z.string().nullable(),
  source_refs: z.array(z.string()),
  evidence_refs: z.array(evidence),
  main_question_index: z.number().int(),
  follow_up_index: z.number().int(),
  generation_id: z.string(),
  presented_at: z.string().nullable(),
  answer_status: z.enum(['waiting', 'answered', 'skipped']),
  answer_text: z.string().nullable(),
  revision: z.number().int(),
  input_mode: z.literal('text_fallback'),
  answered_at: z.string().nullable(),
});
export const interviewSchema = z.object({
  id: z.string(),
  version: z.number().int(),
  configuration: interviewConfigSchema,
  status: z.enum(['draft', 'ready', 'in_progress', 'paused', 'ending', 'completed', 'failed']),
  created_at: z.string(),
  started_at: z.string().nullable(),
  ended_at: z.string().nullable(),
  end_reason: z.string().nullable(),
  participation: z
    .object({
      level: z.enum(['reminder', 'confirmation', 'ended']),
      reason: z.enum([
        'repeated_non_answers',
        'disruptive_language',
        'explicit_non_participation',
        'candidate_stop',
      ]),
      turn_id: z.string(),
      message: z.string(),
    })
    .nullable()
    .optional(),
  job_title: z.string(),
  plan: z.array(z.string()),
  turns: z.array(turnSchema),
  generation_id: z.string().nullable(),
  generation_status: z.enum(['idle', 'pending', 'ready', 'failed']),
  task_id: z.string().nullable(),
  clarification: z.string().nullable(),
  target_at: z.string().nullable(),
  deadline_at: z.string().nullable(),
  parent_interview_id: z.string().nullable(),
  parent_turn_id: z.string().nullable(),
  parent_revision: z.number().int().nullable(),
  retry_goal: z.string().nullable(),
}) satisfies z.ZodType<Interview>;
const dimension = z.object({
  status: z.enum(['observed', 'not_observed']),
  score: z.null(),
  evidence_refs: z.array(evidence),
  explanation: z.string(),
});
export const reportSchema = z.object({
  id: z.string(),
  interview_id: z.string(),
  version: z.number().int(),
  task_ids: z.array(z.string()),
  status: z.enum(['pending', 'generating', 'ready', 'failed']),
  scoring_status: z.literal('uncalibrated'),
  overall_score: z.null(),
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
}) satisfies z.ZodType<InterviewReport>;
export const comparisonSchema = z.object({
  id: z.string(),
  version: z.number().int(),
  task_id: z.string().nullable(),
  original_interview_id: z.string(),
  retry_interview_id: z.string(),
  original_turn_id: z.string(),
  retry_turn_id: z.string(),
  original_revision: z.number().int(),
  retry_revision: z.number().int(),
  original_text: z.string(),
  retry_text: z.string(),
  goal: z.string(),
  question: z.string(),
  status: z.enum(['pending', 'generating', 'ready', 'failed']),
  changes: z.array(finding),
  remaining_gaps: z.array(finding),
  limitations: z.array(z.string()),
}) satisfies z.ZodType<InterviewComparison>;
