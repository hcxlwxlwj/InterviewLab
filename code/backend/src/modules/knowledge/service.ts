import { Pool } from 'pg';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import type {
  InterviewConfig,
  InterviewKnowledge,
  InterviewKnowledgeProvider,
  InterviewProfile,
  InterviewRetrieval,
  KnowledgeChunk,
  InterviewMemory,
} from '@interviewlab/core';
import type { BackendConfig } from '../../foundation/config';
import { ServiceError } from '../../foundation/errors';
import { localInterviewKnowledge } from '../interviews/knowledge';

const goal = z
  .object({
    id: z.string(),
    title: z.string(),
    evidence_wanted: z.string(),
    probe_when: z.string(),
    stop_when: z.string(),
    alternative: z.string(),
  })
  .strict();
const types = z.enum(['technical_qa', 'business_scenario', 'hr', 'mixed', 'project_deep_dive']);
const profile = z
  .object({
    id: z.string(),
    version: z.string(),
    type: types,
    label: z.string(),
    goals: z.array(z.string()),
  })
  .strict();
const source = z
  .object({
    id: z.string(),
    title: z.string(),
    url: z.url().refine((v) => {
      const u = new URL(v);
      return ['https:', 'http:'].includes(u.protocol) && !u.username && !u.password;
    }, 'HTTP source required'),
    publisher: z.string(),
    section: z.string(),
    reviewed_at: z.string().nullable(),
    acquired_at: z.string(),
    usage_basis: z.string(),
  })
  .strict();
const card = z
  .object({
    id: z.string(),
    title: z.string(),
    text: z.string().min(20).max(3000),
    source_refs: z.array(z.string()).min(1),
    goals: z.array(z.string()),
    types: z.array(types),
    job: z.literal('frontend'),
    stages: z.array(z.enum(['internship', 'campus'])),
    difficulty: z.literal('基础'),
  })
  .strict();
const question = z
  .object({
    id: z.string(),
    topic: z.string(),
    text: z.string(),
    goals: z.array(z.string()),
    types: z.array(types),
    source_refs: z.array(z.string()),
    origin: z.literal('platform_authored'),
    follow_up_trigger: z.string(),
  })
  .strict();
export const seedSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]+$/),
    review_state: z.enum(['draft', 'reviewed']),
    reviewer: z.string().nullable(),
    embedding_model: z.literal('ecnu-embedding-small'),
    dimensions: z.literal(1024),
    sources: z.array(source),
    competencies: z.array(goal),
    profiles: z.array(profile),
    cards: z.array(card).min(20),
    questions: z.array(question).min(16),
  })
  .strict();
export type KnowledgeSeed = z.infer<typeof seedSchema>;
export async function readKnowledgeSeed(
  path = fileURLToPath(
    new URL('../../../../../docs/algorithm/content/frontend-agent.json', import.meta.url),
  ),
) {
  const seed = seedSchema.parse(JSON.parse(await readFile(path, 'utf8')));
  const ids = new Set(seed.sources.map((x) => x.id)),
    goals = new Set(seed.competencies.map((x) => x.id));
  for (const c of [...seed.cards, ...seed.questions])
    if (c.source_refs.some((x) => !ids.has(x)) || c.goals.some((x) => !goals.has(x)))
      throw new Error('Invalid knowledge references');
  if (new Set(seed.cards.map((x) => x.id)).size !== seed.cards.length)
    throw new Error('Duplicate card');
  if (
    seed.review_state === 'reviewed' &&
    (!seed.reviewer || seed.sources.some((x) => !x.reviewed_at))
  )
    throw new Error('Missing human review');
  return seed;
}
export function tokens(text: string): string[] {
  const synonyms: Record<string, string> = {
    react: 'react',
    effect: '副作用',
    useeffect: '副作用',
    state: '状态',
    cache: '缓存',
    abort: '取消',
    fetch: '请求',
    a11y: '可访问性',
    性能: '速度',
    指标: '测量',
    验证: '测量',
    沟通: '协作',
    反馈: '学习',
  };
  const terms = Array.from(
    new Intl.Segmenter('zh', { granularity: 'word' }).segment(text.toLowerCase()),
  )
    .filter((x) => x.isWordLike)
    .map((x) => x.segment);
  const stop = new Set([
    '的',
    '了',
    '是',
    '和',
    '与',
    '在',
    '我',
    '你',
    '这',
    '一个',
    '什么',
    '怎样',
    '如何',
    '怎么',
    '是否',
    '没有',
    '可以',
    '需要',
    '进行',
    '详细',
    '介绍',
    '内容',
    '问题',
    '时',
    '后',
    '中',
    '对',
    '及',
    '不',
    '就',
    '也',
    '有',
    '做',
    '用',
    '说',
    '应',
    '会',
    '本',
    '并',
    '要',
    '把',
    '为',
    '等',
    '将',
    '从',
    '或',
    '能',
    '都',
    '其',
    '不能',
    '可能',
    '相关',
    '具体',
    '实际',
    '了解',
    '方法',
  ]);
  return [
    ...new Set(
      terms
        .filter((t) => t.length > 1 && !stop.has(t))
        .flatMap((x) => [x, synonyms[x]].filter(Boolean)),
    ),
  ];
}
export async function embed(
  config: BackendConfig,
  input: string[],
  signal?: AbortSignal,
): Promise<number[][]> {
  if (!config.LLM_API_KEY) throw new ServiceError('capability_unavailable', 501, '向量模型未配置');
  if (input.join('').length > 6000) throw new Error('Embedding batch too large');
  const res = await fetch(`${config.LLM_BASE_URL!.replace(/\/$/, '')}/embeddings`, {
    method: 'POST',
    redirect: 'error',
    signal: AbortSignal.any([AbortSignal.timeout(10000), ...(signal ? [signal] : [])]),
    headers: { authorization: `Bearer ${config.LLM_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({ model: config.EMBEDDING_MODEL, input, encoding_format: 'float' }),
  });
  if (!res.ok) throw new ServiceError('embedding_error', 502, '向量服务不可用', true);
  const raw = await res.text();
  if (raw.length > 2000000) throw new Error('Oversized embedding');
  const result = z
    .object({
      data: z
        .array(
          z.object({
            index: z.number().int().nonnegative(),
            embedding: z.array(z.number().finite()).length(1024),
          }),
        )
        .length(input.length),
    })
    .parse(JSON.parse(raw));
  const ordered = result.data.sort((a, b) => a.index - b.index);
  if (ordered.some((x, i) => x.index !== i || !x.embedding.some((n) => n !== 0)))
    throw new Error('Invalid embedding indices');
  return ordered.map((x) => x.embedding);
}
export function createKnowledgeService(config: BackendConfig) {
  const pool = config.KNOWLEDGE_DATABASE_URL
    ? new Pool({
        connectionString: config.KNOWLEDGE_DATABASE_URL,
        max: 3,
        statement_timeout: 2000,
        connectionTimeoutMillis: 2000,
        idleTimeoutMillis: 10000,
      })
    : null;
  pool?.on('error', () => {});
  const cache = new Map<string, Promise<InterviewRetrieval>>();
  async function seedFor(id?: string): Promise<KnowledgeSeed | null> {
    if (!pool) return null;
    const rows = await pool.query<{ body: KnowledgeSeed }>(
      `SELECT body FROM knowledge_releases WHERE ($1::text IS NULL AND active OR id=$1) AND (status='published' OR ($2 AND status='draft')) ORDER BY created_at DESC LIMIT 1`,
      [id ?? null, config.KNOWLEDGE_PREVIEW],
    );
    return rows.rows[0] ? seedSchema.parse(rows.rows[0].body) : null;
  }
  async function read(c: InterviewConfig): Promise<InterviewKnowledge> {
    if (c.job !== 'frontend' || c.interview_type === 'project_deep_dive' || !pool)
      return localInterviewKnowledge.read(c);
    const seed = await seedFor();
    if (!seed) throw new ServiceError('knowledge_unavailable', 503, '没有可用的面试知识版本');
    const selected = seed.profiles.find((p) => p.type === c.interview_type);
    if (!selected) throw new ServiceError('unsupported_input', 400, '面试类型不可用');
    return {
      content_version: seed.id,
      agent_release: {
        id: seed.id,
        embedding_model: seed.embedding_model,
        dimensions: seed.dimensions,
        profile: selected,
        competencies: seed.competencies,
      },
      questions: seed.questions
        .filter((q) => q.types.includes(c.interview_type))
        .map((q) => ({
          id: q.id,
          topic: q.topic,
          text: q.text,
          intent: q.goals.join(','),
          observation_points: q.goals.map(
            (g) => seed.competencies.find((x) => x.id === g)!.evidence_wanted,
          ),
          follow_ups: [q.follow_up_trigger],
          stages: ['internship', 'campus'],
          difficulty: '基础',
          source_refs: q.source_refs,
          origin: 'platform_authored',
          version: 1,
        })),
      sources: seed.sources.map((s) => ({
        id: s.id,
        title: s.title,
        url: s.url,
        publisher: s.publisher,
        kind: 'official_documentation',
        usage: 'reference_only',
        verification: 'search_index',
        acquired_at: s.acquired_at,
        reviewed_at: s.reviewed_at ?? s.acquired_at,
        notes: `${s.section}; ${seed.review_state === 'draft' ? '联调草案，尚未经人工审核；' : ''}${s.usage_basis}`,
      })),
      missing_reason:
        seed.review_state === 'draft' ? '联调知识草案，尚未经人工审核，不代表正式专业标准' : null,
    };
  }
  function key(c: InterviewConfig, k: InterviewKnowledge, focus: string[]) {
    return JSON.stringify([
      k.content_version,
      config.EMBEDDING_MODEL,
      c.career_stage,
      c.interview_type,
      focus,
    ]);
  }
  async function retrieve(
    c: InterviewConfig,
    k: InterviewKnowledge,
    focus: string[],
    query: string,
    signal?: AbortSignal,
  ): Promise<InterviewRetrieval> {
    if (!pool || !k.agent_release)
      return {
        release: k.content_version,
        chunks: [],
        missing_reason: '知识检索未启用',
        mode: 'empty',
      };
    const queryKey = checksum([
      k.content_version,
      config.EMBEDDING_MODEL,
      c.job,
      c.career_stage,
      c.interview_type,
      focus,
      query,
    ]);
    const cached = await pool.query<{ result: InterviewRetrieval }>(
      'SELECT result FROM knowledge_query_cache WHERE key=$1',
      [queryKey],
    );
    if (cached.rowCount) return cached.rows[0].result;
    const [vector] = await embed(config, [query], signal);
    const ts = tokens(query);
    const rows = await pool.query<{
      id: string;
      card_id: string;
      release: string;
      text: string;
      source_refs: string[];
      goals: string[];
      types: KnowledgeChunk['types'];
      distance: number;
    }>(
      `SELECT id,card_id,release,text,source_refs,goals,types,embedding <=> $1::vector AS distance FROM knowledge_chunks WHERE release=$2 AND job=$3 AND $4=ANY(stages) AND $5=ANY(types) AND goals && $6::text[] ORDER BY embedding <=> $1::vector LIMIT 20`,
      [JSON.stringify(vector), k.content_version, c.job, c.career_stage, c.interview_type, focus],
    );
    const lexical = await pool.query<(typeof rows.rows)[number]>(
      `SELECT id,card_id,release,text,source_refs,goals,types,0 AS distance FROM knowledge_chunks WHERE release=$1 AND job=$2 AND $3=ANY(stages) AND $4=ANY(types) AND goals && $5::text[] AND terms && $6::text[] ORDER BY cardinality(ARRAY(SELECT unnest(terms) INTERSECT SELECT unnest($6::text[]))) DESC,id LIMIT 20`,
      [k.content_version, c.job, c.career_stage, c.interview_type, focus, ts],
    );
    const ranked = new Map<string, { chunk: KnowledgeChunk; score: number }>();
    // Versioned threshold is calibrated by the retrieval evaluation command.
    const release = await pool.query<{ threshold: number }>(
      'SELECT threshold FROM knowledge_releases WHERE id=$1',
      [k.content_version],
    );
    const threshold = release.rows[0]?.threshold ?? 0.48;
    for (const list of [rows.rows.filter((x) => Number(x.distance) <= threshold), lexical.rows])
      list.forEach((x, i) => {
        const old = ranked.get(x.id);
        ranked.set(x.id, {
          chunk: {
            id: x.id,
            card_id: x.card_id,
            release: x.release,
            text: x.text,
            source_refs: x.source_refs,
            goals: x.goals,
            types: x.types,
          },
          score: (old?.score ?? 0) + 1 / (60 + i + 1),
        });
      });
    const chunks = [...ranked.values()]
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map((x) => x.chunk);
    const result: InterviewRetrieval = {
      release: k.content_version,
      chunks,
      mode: chunks.length ? 'prefetched' : 'empty',
      missing_reason: chunks.length ? null : '没有可靠且适用的知识片段',
    };
    await pool.query(
      'INSERT INTO knowledge_query_cache(key,release,result) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',
      [queryKey, k.content_version, result],
    );
    return result;
  }
  function focusFor(k: InterviewKnowledge, memory?: InterviewMemory | null) {
    const goals = k.agent_release?.profile.goals ?? [];
    return [
      ...new Set([
        ...(memory?.focus ? [memory.focus] : []),
        ...goals.filter(
          (g) =>
            !memory?.observations.some(
              (x) => x.goal === g && ['covered', 'not_applicable'].includes(x.state),
            ),
        ),
      ]),
    ].slice(0, 2);
  }
  function prefetch(c: InterviewConfig, k: InterviewKnowledge, memory?: InterviewMemory | null) {
    const focus = focusFor(k, memory),
      id = key(c, k, focus);
    if (!k.agent_release || cache.has(id)) return;
    if (cache.size >= 100) cache.delete(cache.keys().next().value!);
    const query = focus
      .map((g) => {
        const v = k.agent_release!.competencies.find((x) => x.id === g);
        return `${v?.title} ${v?.evidence_wanted}`;
      })
      .join(' ');
    const pending = retrieve(c, k, focus, query).catch(() => ({
      release: k.content_version,
      chunks: [],
      missing_reason: '知识预取失败',
      mode: 'empty' as const,
    }));
    cache.set(id, pending);
  }
  async function context(
    c: InterviewConfig,
    k: InterviewKnowledge,
    memory: InterviewMemory | null,
    answer: string,
    signal: AbortSignal,
  ) {
    const contextStarted = performance.now();
    prefetch(c, k, memory);
    const focus = focusFor(k, memory);
    const pending = cache.get(key(c, k, focus))!;
    // A slow cold lookup cannot consume the normal interview latency budget.
    let timer: ReturnType<typeof setTimeout> | undefined;
    const empty: InterviewRetrieval = {
      release: k.content_version,
      chunks: [],
      missing_reason: '知识准备超出实时预算，使用通用流程',
      mode: 'empty',
    };
    let result = await Promise.race([
      pending,
      new Promise<InterviewRetrieval>((r) => {
        timer = setTimeout(() => r(empty), 300);
      }),
    ]);
    clearTimeout(timer);
    if (signal.aborted) throw new ServiceError('task_cancelled', 409, '生成已取消');
    const terms = tokens(answer);
    const technical = [
      '缓存',
      '状态',
      '闭包',
      '副作用',
      '异步',
      '请求',
      '表单',
      '可访问性',
      '性能',
      '焦点',
      '原型',
      '用户',
      '协作',
      '反馈',
      '动机',
    ];
    const keywords = technical.filter((t) => terms.includes(t));
    if (
      c.interview_type !== 'hr' &&
      performance.now() - contextStarted < 300 &&
      keywords.length &&
      !result.chunks.some((c) => keywords.some((t) => c.text.includes(t)))
    ) {
      const controller = new AbortController();
      let budget: ReturnType<typeof setTimeout> | undefined;
      const supplement = retrieve(
        c,
        k,
        focus,
        keywords.join(' '),
        AbortSignal.any([signal, controller.signal]),
      )
        .then((v) => (v.chunks.length ? { ...v, mode: 'supplemental' as const } : result))
        .catch(() => result);
      result = await Promise.race([
        supplement,
        new Promise<InterviewRetrieval>((r) => {
          budget = setTimeout(
            () => {
              controller.abort();
              r(result);
            },
            Math.max(0, 300 - (performance.now() - contextStarted)),
          );
        }),
      ]);
      clearTimeout(budget);
    }
    return {
      ...result,
      chunks: [...result.chunks].sort(
        (a, b) =>
          tokens(b.text).filter((t) => terms.includes(t)).length -
          tokens(a.text).filter((t) => terms.includes(t)).length,
      ),
    };
  }
  return {
    enabled: Boolean(pool),
    read,
    prefetch,
    context,
    search: retrieve,
    async profiles(c: Pick<InterviewConfig, 'job' | 'career_stage'>) {
      const seed = c.job === 'frontend' ? await seedFor() : null;
      const profiles: InterviewProfile[] =
        seed?.profiles ??
        (['technical_qa', 'project_deep_dive', 'hr', 'mixed'] as const).map((type) => ({
          id: type,
          version: 'legacy-v2',
          type,
          label: {
            technical_qa: '专业问答',
            project_deep_dive: '项目深挖',
            hr: 'HR 面',
            mixed: '综合面试',
          }[type],
          goals: [],
        }));
      return { version: seed?.id ?? 'legacy-v2', default_type: 'technical_qa' as const, profiles };
    },
    close: async () => {
      await pool?.end();
    },
  } satisfies InterviewKnowledgeProvider & Record<string, unknown>;
}
export type KnowledgeService = ReturnType<typeof createKnowledgeService>;
export const checksum = (value: unknown) =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex');
