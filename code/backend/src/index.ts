import { z } from 'zod';
import {
  DEFAULT_PREFERENCES,
  EXPERIENCES,
  JOBS,
  JOB_CATEGORIES,
  CONTENT_SOURCES,
  getJob,
  searchJobs,
  type CareerStage,
  RESUMES,
  reportFor,
  sampleSession,
  type ApiError,
  type SessionRepository,
} from '@interviewlab/core';

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
export interface AuthContext {
  owner_id: string;
}
export interface BackendServices {
  authenticate(request: Request): Promise<AuthContext>;
  sessions: SessionRepository;
}
export const API_CONTRACT = [
  'GET /job-templates',
  'GET /job-categories',
  'GET /job-templates/{id}',
  'GET /job-templates/{id}/sources',
  'GET/POST /me/bookmarks',
  'PATCH/DELETE /me/bookmarks/{id}',
  'GET/POST /job-targets',
  'GET/PATCH /job-targets/{id}',
  'GET/POST /resume-documents',
  'GET/PATCH/DELETE /resume-documents/{id}',
  'POST /resume-documents/{id}/confirm',
  'POST /resume-documents/{id}/set-default',
  'POST /resume-documents/{id}/save-to-library',
  'GET /resume-documents/{id}/preview',
  'GET /resume-documents/{id}/download',
  'GET/POST /experiences',
  'PATCH/DELETE /experiences/{id}',
  'GET/PATCH /me/preferences',
  'GET /history',
  'POST /sessions',
  'GET/PATCH/DELETE /sessions/{id}',
  'POST /sessions/{id}/start',
  'POST /sessions/{id}/pause',
  'POST /sessions/{id}/resume',
  'POST /sessions/{id}/finish',
  'POST /sessions/{id}/turns',
  'PATCH /sessions/{id}/interaction-settings',
  'GET /sessions/{id}/report',
  'POST /sessions/{id}/report/retry',
  'POST /sessions/{id}/retries',
  'POST /retry-comparisons',
  'GET /retry-comparisons/{id}',
  'POST /reports/{id}/exports',
  'GET /exports/{id}',
  'GET /sessions/{id}/code-tasks/{id}',
  'POST /code-tasks/{id}/submissions',
  'POST /code-submissions/{id}/runs',
  'GET /code-executions/{id}',
] as const;
const headers = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-InterviewLab-Mode': 'synthetic-fixture',
};
function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), { status, headers });
}
function contentJson(value: unknown) {
  return new Response(JSON.stringify(value), {
    headers: { ...headers, 'X-InterviewLab-Mode': 'curated-public-content' },
  });
}
function error(code: string, message: string, status: number) {
  const body: ApiError = { code, message, retryable: false, request_id: crypto.randomUUID() };
  return json(body, status);
}
const list = <T>(items: T[]) => ({ items, next_cursor: null });
/** Only public synthetic fixtures are exposed. There is deliberately no unauthenticated private-data backend. */
export async function handleApi(request: Request, path: string[]): Promise<Response> {
  const route = path.join('/');
  if (request.method === 'GET') {
    const session = sampleSession();
    if (route === 'health')
      return json({
        status: 'ok',
        mode: 'interface-skeleton',
        capabilities: {
          database: false,
          authentication: false,
          llm: false,
          asr: false,
          tts: false,
          code_execution: false,
        },
        contracts: API_CONTRACT,
      });
    if (route === 'job-categories') return contentJson(list(JOB_CATEGORIES));
    if (route === 'job-templates') {
      const params = new URL(request.url).searchParams,
        stage = params.get('stage');
      const limit = Number(params.get('limit') ?? 20),
        offset = Number(params.get('cursor') ?? 0);
      if (
        (stage && !['internship', 'campus'].includes(stage)) ||
        !Number.isInteger(limit) ||
        limit < 1 ||
        limit > 50 ||
        !Number.isInteger(offset) ||
        offset < 0
      )
        return error('unsupported_input', '分页或阶段参数不正确。', 400);
      const items = searchJobs({
        search: params.get('search') ?? undefined,
        category: params.get('category') ?? undefined,
        stage: stage as CareerStage | undefined,
      });
      return contentJson({
        items: items.slice(offset, offset + limit),
        next_cursor: offset + limit < items.length ? String(offset + limit) : null,
      });
    }
    if (path[0] === 'job-templates' && path[1]) {
      const job = getJob(path[1]);
      if (!job) return error('not_found', '岗位模板未发布或已不可用。', 404);
      if (path.length === 2) return contentJson(job);
      if (path.length === 3 && path[2] === 'sources')
        return contentJson(list(CONTENT_SOURCES.filter((s) => job.source_refs.includes(s.id))));
    }
    if (route === 'job-targets' || route === 'me/bookmarks') return json(list([]));
    if (route === 'resume-documents') return json(list(RESUMES));
    if (route === 'experiences') return json(list(EXPERIENCES));
    if (route === 'me/preferences') return json(DEFAULT_PREFERENCES);
    if (route === 'history') return json(list([session]));
    if (route === 'sessions/sample-interview') return json(session);
    if (route === 'sessions/sample-interview/report') return json(reportFor(session));
    return error('not_found', '未找到此合成示例。真实资源服务尚未接入。', 404);
  }
  // Check same-origin writes even while capability implementations are unavailable.
  const origin = request.headers.get('origin');
  if (!origin || origin !== new URL(request.url).origin)
    return error('forbidden', '写入请求需要同源来源。', 403);
  if (request.method === 'POST' && route === 'sessions') {
    try {
      const parsed = sessionCreateSchema.safeParse(await request.json());
      if (!parsed.success) return error('unsupported_input', '会话配置格式不正确。', 400);
    } catch {
      return error('unsupported_input', '请求需要有效的 JSON。', 400);
    }
  }
  const schema =
    request.method === 'POST' && route === 'job-targets'
      ? jobTargetSchema
      : request.method === 'POST' && route === 'me/bookmarks'
        ? bookmarkSchema
        : request.method === 'POST' &&
            route === 'resume-documents' &&
            request.headers.get('content-type')?.includes('application/json')
          ? textResumeSchema
          : undefined;
  if (schema) {
    try {
      if (!schema.safeParse(await request.json()).success)
        return error('unsupported_input', '请求字段不正确。', 400);
    } catch {
      return error('unsupported_input', '请求需要有效的 JSON。', 400);
    }
  }
  return error(
    'capability_unavailable',
    '当前仅提供接口骨架与公开合成样例；真实身份、持久化和外部服务尚未接入。',
    501,
  );
}
