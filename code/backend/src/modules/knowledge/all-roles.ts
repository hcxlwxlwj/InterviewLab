import { Pool } from 'pg';
import type {
  InterviewConfig,
  InterviewKnowledge,
  InterviewKnowledgeRuntime,
  InterviewMemory,
  InterviewRetrieval,
  KnowledgeChunk,
} from '@interviewlab/core';
import { getJob, teacherAgentQuestions } from '../../content/index';
import type { BackendConfig } from '../../foundation/config';
import { ServiceError } from '../../foundation/errors';
import { structuredInterviewKnowledge } from '../interviews/knowledge';
import { COMPETENCIES, catalogProfile, catalogSources, catalogTerms as tokens } from './catalog';
import { embed } from './embedding';

export function createAllRoleKnowledge(config: BackendConfig): InterviewKnowledgeRuntime & {
  close(): Promise<void>;
  search(
    c: InterviewConfig,
    k: InterviewKnowledge,
    goals: string[],
    query: string,
    signal?: AbortSignal,
  ): Promise<InterviewRetrieval>;
} {
  const pool = config.KNOWLEDGE_DATABASE_URL
    ? new Pool({
        connectionString: config.KNOWLEDGE_DATABASE_URL,
        max: 3,
        statement_timeout: 2500,
        connectionTimeoutMillis: 2000,
      })
    : null;
  pool?.on('error', () => {});
  const prefetched = new Map<string, Promise<InterviewRetrieval>>();
  const empty = (k: InterviewKnowledge, reason: string): InterviewRetrieval => ({
    release: k.content_version,
    chunks: [],
    missing_reason: reason,
    mode: 'empty',
  });
  async function read(c: InterviewConfig): Promise<InterviewKnowledge> {
    const base = await structuredInterviewKnowledge.read(c);
    const release = pool
      ? await pool
          .query<{
            id: string;
            sources: InterviewKnowledge['sources'] | null;
            job_lineage: { version: number } | null;
          }>(
            `SELECT id,manifest->'sources' AS sources,(SELECT j FROM jsonb_array_elements(coalesce(manifest->'lineage','[]')) j WHERE j->>'job'=$2) AS job_lineage FROM knowledge_v2_releases WHERE active AND (status='published' OR ($1 AND status='draft'))`,
            [config.KNOWLEDGE_PREVIEW, getJob(c.job)?.id ?? c.job],
          )
          .catch(() => null)
      : null;
    const active = release?.rows[0];
    const id =
      active?.job_lineage && active.job_lineage.version !== getJob(c.job)?.version
        ? undefined
        : active?.id;
    return {
      ...base,
      content_version: id ?? base.content_version,
      agent_release: {
        id: id ?? base.content_version,
        embedding_model: config.EMBEDDING_MODEL,
        dimensions: 1024,
        competencies: COMPETENCIES,
        profile: catalogProfile(c.interview_type),
      },
      sources: (id && active?.sources ? active.sources : catalogSources).filter(
        (s) =>
          base.sources.some((b) => b.id === s.id) ||
          s.id.startsWith(`foundation-${getJob(c.job)?.category_id}-`) ||
          (id &&
            c.career_stage === 'campus' &&
            teacherAgentQuestions.some(
              (set) => set.source.id === s.id && set.job === getJob(c.job)?.id,
            )),
      ),
      missing_reason: id
        ? '岗位与原创问题已索引；专业摘要覆盖有限，非专家校准标准。'
        : '当前岗位版本的全岗位向量索引不可用，使用冻结的岗位与原创问题。',
    };
  }
  const focus = (k: InterviewKnowledge, m?: InterviewMemory | null) => {
    const goals = k.agent_release?.profile.goals ?? [];
    return [
      ...new Set([
        ...(m?.focus ? [m.focus] : []),
        ...goals.filter(
          (g) =>
            !m?.observations.some(
              (o) => o.goal === g && ['covered', 'not_applicable'].includes(o.state),
            ),
        ),
      ]),
    ].slice(0, 2);
  };
  const key = (c: InterviewConfig, k: InterviewKnowledge, goals: string[]) =>
    JSON.stringify([
      k.content_version,
      c.job,
      c.career_stage,
      c.interview_type,
      goals,
      k.agent_release?.embedding_model,
    ]);
  async function retrieve(
    c: InterviewConfig,
    k: InterviewKnowledge,
    goals: string[],
    query: string,
    signal?: AbortSignal,
  ): Promise<InterviewRetrieval> {
    if (!pool || !k.content_version.startsWith('all-roles-'))
      return empty(k, '全岗位向量索引尚未准备');
    if (k.agent_release?.embedding_model !== config.EMBEDDING_MODEL)
      return empty(k, '冻结的嵌入模型当前不可用');
    const [vector] = await embed(config, [query.slice(0, 1200)], signal);
    const args = [
      k.content_version,
      getJob(c.job)?.id ?? c.job,
      c.career_stage,
      c.interview_type,
      goals,
      JSON.stringify(vector),
      tokens(query),
    ];
    // Applicability is filtered before ranking. Questions and methods are never treated as answer keys.
    const result = await pool.query<{
      id: string;
      card_id: string;
      kind: KnowledgeChunk['kind'];
      body: string;
      source_refs: string[];
      evidence_level: KnowledgeChunk['evidence_level'];
      goals: string[];
      types: KnowledgeChunk['types'];
      distance: number;
      lexical: number;
    }>(
      `WITH applicable AS (
        SELECT c.*,b.goals,b.types,v.embedding,cardinality(ARRAY(SELECT unnest(c.terms) INTERSECT SELECT unnest($7::text[]))) AS lexical
        FROM knowledge_v2_chunks c JOIN knowledge_v2_bindings b ON b.release=c.release AND b.chunk_id=c.id
        JOIN knowledge_v2_vectors v ON v.hash=c.hash AND v.model=c.model
        JOIN knowledge_v2_releases r ON r.id=c.release
        WHERE c.release=$1 AND c.kind <> 'evaluation_reference' AND b.job=$2 AND $3=ANY(b.stages) AND $4=ANY(b.types) AND b.goals && $5::text[]
        AND (r.status IN ('published','retired') OR ($8 AND r.status='draft'))
      ), semantic AS (SELECT id,embedding <=> $6::vector AS distance FROM applicable ORDER BY embedding <=> $6::vector LIMIT 20),
      lexical AS (SELECT id FROM applicable WHERE lexical>0 ORDER BY lexical DESC,id LIMIT 20)
      SELECT a.id,a.card_id,a.kind,a.body,a.source_refs,a.evidence_level,a.goals,a.types,
        a.embedding <=> $6::vector AS distance,a.lexical FROM applicable a
      WHERE a.id IN (SELECT id FROM semantic WHERE distance<=0.48 UNION SELECT id FROM lexical)`,
      [...args, config.KNOWLEDGE_PREVIEW],
    );
    if (signal?.aborted) throw new ServiceError('task_cancelled', 409, '检索已取消');
    const scores = new Map<string, number>();
    for (const list of [
      result.rows.filter((r) => r.distance <= 0.48).sort((a, b) => a.distance - b.distance),
      result.rows
        .filter((r) => r.lexical > 0)
        .sort((a, b) => b.lexical - a.lexical || a.id.localeCompare(b.id)),
    ])
      list.slice(0, 20).forEach((r, i) => scores.set(r.id, (scores.get(r.id) ?? 0) + 1 / (61 + i)));
    const chunks = result.rows
      .sort((a, b) => (scores.get(b.id) ?? 0) - (scores.get(a.id) ?? 0))
      .slice(0, 5)
      .map(
        (r): KnowledgeChunk => ({
          id: r.id,
          card_id: r.card_id,
          release: k.content_version,
          text: r.body,
          source_refs: r.source_refs,
          goals: r.goals,
          types: r.types,
          kind: r.kind,
          evidence_level: r.evidence_level,
        }),
      );
    return {
      release: k.content_version,
      chunks,
      missing_reason: chunks.length ? null : '没有适用的可靠片段',
      mode: chunks.length ? 'prefetched' : 'empty',
    };
  }
  function prefetch(c: InterviewConfig, k: InterviewKnowledge, m?: InterviewMemory | null) {
    const goals = focus(k, m),
      id = key(c, k, goals);
    if (prefetched.has(id)) return;
    if (prefetched.size >= 100) prefetched.delete(prefetched.keys().next().value!);
    // Only public goal/role text enters this shared cache, never resume or answer content.
    const query = [
      getJob(c.job)?.title,
      ...COMPETENCIES.filter((g) => goals.includes(g.id)).map((g) => g.evidence_wanted),
    ].join(' ');
    prefetched.set(
      id,
      retrieve(c, k, goals, query).catch(() => empty(k, '知识预取失败，使用岗位上下文')),
    );
  }
  return {
    enabled: true,
    read,
    prefetch,
    search: retrieve,
    async profiles(c) {
      const job = getJob(c.job);
      if (!job || !job.stages.includes(c.career_stage))
        throw new ServiceError('unsupported_input', 400, '岗位或阶段不可用');
      return {
        version: 'all-roles-v1',
        default_type: 'technical_qa',
        profiles: (Object.keys(PROFILE_TYPES) as InterviewConfig['interview_type'][]).map(
          catalogProfile,
        ),
      };
    },
    async context(c, k, m, answer, signal) {
      prefetch(c, k, m);
      let timer: ReturnType<typeof setTimeout> | undefined;
      const started = performance.now();
      let result = await Promise.race([
        prefetched.get(key(c, k, focus(k, m)))!,
        new Promise<InterviewRetrieval>((r) => {
          timer = setTimeout(() => r(empty(k, '知识预取超出实时预算')), 300);
        }),
      ]);
      clearTimeout(timer);
      const keywords = tokens(answer).slice(0, 12);
      if (c.interview_type !== 'hr' && keywords.length && performance.now() - started < 300) {
        const controller = new AbortController();
        try {
          const extra = await Promise.race([
            retrieve(
              c,
              k,
              focus(k, m),
              keywords.join(' '),
              AbortSignal.any([signal, controller.signal]),
            ),
            new Promise<InterviewRetrieval>((r) => {
              timer = setTimeout(
                () => {
                  controller.abort();
                  r(result);
                },
                Math.max(0, 300 - (performance.now() - started)),
              );
            }),
          ]);
          if (extra.chunks.length) result = { ...extra, mode: 'supplemental' };
        } catch {
          /* Retain usable public prefetch when private-query retrieval fails. */
        } finally {
          clearTimeout(timer);
          controller.abort();
        }
      }
      if (signal.aborted) throw new ServiceError('task_cancelled', 409, '检索已取消');
      return result;
    },
    close: async () => {
      await pool?.end();
    },
  };
}
const PROFILE_TYPES = {
  technical_qa: 1,
  business_scenario: 1,
  hr: 1,
  mixed: 1,
};
