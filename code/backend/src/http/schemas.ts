import { getJob } from '@interviewlab/content';
import { z } from 'zod';
export const configurationSchema = z.object({
  job: z.string().refine((id) => !!getJob(id), '岗位模板不可用'),
  job_template_version: z.number().int().positive().optional(),
  job_target_id: z.string().optional(),
  job_target_version: z.number().int().positive().optional(),
  jd_source: z.enum(['template', 'custom']).optional(),
  career_stage: z.enum(['internship', 'campus']).optional(),
  resume_document_version: z.number().int().positive().optional(),
  interview_type: z.enum(['technical_qa', 'project_deep_dive', 'hr', 'mixed']),
  difficulty: z.enum(['基础', '进阶', '挑战']),
  jd_text: z.string().max(10000),
  duration_minutes: z.union([z.literal(5), z.literal(10)]),
  interviewer_style: z.enum(['标准', '友好', '深入追问']),
  code_assessment_enabled: z.boolean(),
  interaction_mode: z.enum(['realtime_voice', 'text_fallback']),
  camera_enabled: z.literal(false),
  review_media_enabled: z.literal(false),
  resume_document_id: z.string().optional(),
  focus_experience_ids: z.array(z.string()).max(10),
});
export const sessionCreateSchema = z.object({
  mode: z.literal('mock'),
  configuration: configurationSchema,
  idempotency_key: z.string().min(1).max(128),
});
export const turnSchema = z.object({
  action: z.enum(['answer', 'clarify_question', 'repeat_question', 'skip']),
  text: z.string().max(20000).optional(),
  version: z.number().int().positive(),
  idempotency_key: z.string().min(1),
});
export const textResumeSchema = z.object({
  name: z.string().trim().min(1).max(100),
  source_type: z.literal('text'),
  target_job: z.string().refine((id) => !!getJob(id)),
  content: z.object({
    full_name: z.string().max(100),
    email: z.string().max(200),
    phone: z.string().max(50),
    education: z.string().max(12000),
    skills: z.string().max(12000),
    summary: z.string().max(12000),
    raw_text: z.string().max(12000),
  }),
});
export const jobTargetSchema = z.object({
  title: z.string().trim().min(1).max(100),
  company: z.string().max(100),
  job: z.string().refine((id) => !!getJob(id)),
  jd_text: z.string().trim().min(1).max(10000),
  source_url: z.union([
    z.literal(''),
    z
      .string()
      .url()
      .refine((url) => /^https?:/.test(url)),
  ]),
  notes: z.string().max(1000),
  source_kind: z.enum(['custom_jd', 'template_copy']),
  template_id: z.string().optional(),
  template_version: z.number().int().positive().optional(),
  preferred_resume_id: z.string().optional(),
  version: z.number().int().nonnegative(),
});
export const bookmarkSchema = z.object({
  template_id: z.string().refine((id) => !!getJob(id)),
  notes: z.string().max(1000).default(''),
  preferred_resume_id: z.string().optional(),
  version: z.number().int().nonnegative(),
});
