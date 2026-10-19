import { CONTENT_SOURCES, getJob, JOB_CATEGORIES, searchJobs } from '../content';
import { EXPERIENCES, reportFor, RESUMES, sampleSession } from '../content/demo';
import { DEFAULT_PREFERENCES, type CareerStage } from '@interviewlab/core';
import { API_CONTRACT } from './contracts';
import { contentJson, error, json } from './responses';
import { bookmarkSchema, jobTargetSchema, sessionCreateSchema, textResumeSchema } from './schemas';
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
