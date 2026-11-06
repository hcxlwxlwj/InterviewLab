import { createHash } from 'node:crypto';
import { LIVE_TYPE_LABELS } from '@interviewlab/core';
import type {
  CompetencyCard,
  InterviewConfig,
  InterviewProfile,
  KnowledgeChunk,
  InterviewRoleContext,
} from '@interviewlab/core';
import {
  JOBS,
  CONTENT_SOURCES,
  getJob,
  templateJd,
  frontendReportReference,
} from '../../content/index';
import { ServiceError } from '../../foundation/errors';
import { professionalFoundations as professional } from '../../content/index';

export const CATALOG_FORMAT = 'all-roles-v1';
export const TOKENIZER_VERSION = 'catalog-terms-v1';
const segmenter = new Intl.Segmenter('zh', { granularity: 'word' });
const stopwords = new Set(
  '的 了 是 和 与 在 我 你 这 那 一个 什么 怎样 如何 怎么 是否 请 可以 主要 具体 the a an of to in and or is are i you'.split(
    ' ',
  ),
);
/** Shared by build and query; no frontend-specific keyword allowlist or synonym rewriting. */
export function catalogTerms(text: string): string[] {
  return [
    ...new Set(
      Array.from(segmenter.segment(text.toLowerCase()))
        .filter(
          (x) =>
            x.isWordLike &&
            !stopwords.has(x.segment) &&
            (x.segment.length > 1 || /^[a-z]$/.test(x.segment)),
        )
        .map((x) => x.segment),
    ),
  ].slice(0, 160);
}
export const COMPETENCIES: CompetencyCard[] = [
  ['contribution', '本人职责', '解释本人参与范围及实际行动'],
  ['understanding', '岗位专业理解', '解释岗位相关概念、方法及适用边界'],
  ['verification', '验证依据', '说明如何检查结果、发现问题与验证改进'],
  ['tradeoffs', '方案取舍', '说明约束、备选方案和选择依据'],
  ['business', '业务目标', '说明用户任务、优先级及结果边界'],
  ['collaboration', '协作沟通', '说明具体协作行动与职责边界'],
  ['learning', '学习反思', '说明学习、反馈及主动验证的具体行动'],
  ['motivation', '岗位动机', '解释岗位理解、选择依据及准备过程'],
  ['availability', '求职安排', '了解到岗时间、地点意向和实习安排；不按早晚或时长评价能力'],
  ['expectations', '求职期望', '了解薪资期望和求职关注点；只记录，不评价期望高低'],
].map(([id, title, evidence_wanted]) => ({
  id,
  title,
  evidence_wanted,
  probe_when: '当前回答中有相关线索，但关键依据尚不清楚',
  stop_when: '已经说明，或用户明确表示未做过、不会、拒绝该话题',
  alternative: '尊重边界，选择尚未覆盖的适用目标',
}));
export const PROFILE_GOALS: Record<InterviewConfig['interview_type'], string[]> = {
  technical_qa: [
    'understanding',
    'contribution',
    'verification',
    'tradeoffs',
    'learning',
    'motivation',
  ],
  project_deep_dive: ['contribution', 'tradeoffs', 'verification', 'collaboration'],
  business_scenario: [
    'business',
    'contribution',
    'tradeoffs',
    'understanding',
    'verification',
    'learning',
    'motivation',
    'collaboration',
  ],
  hr: ['motivation', 'availability', 'expectations', 'collaboration', 'learning', 'contribution'],
  mixed: COMPETENCIES.map((c) => c.id),
};
export function catalogProfile(type: InterviewConfig['interview_type']): InterviewProfile {
  return {
    id: type,
    type,
    version: CATALOG_FORMAT,
    label: LIVE_TYPE_LABELS[type],
    goals: PROFILE_GOALS[type],
  };
}
export function planningRoleContext(config: InterviewConfig): InterviewRoleContext {
  const job = getJob(config.job);
  if (!job || !job.stages.includes(config.career_stage))
    throw new ServiceError('unsupported_input', 400, '岗位或招聘阶段不可用');
  return {
    job_id: job.id,
    job_title: job.title,
    job_version: job.version,
    description: job.description,
    responsibilities: [...job.responsibilities],
    requirements: [...job.requirements],
    topics: [...job.topics],
    source_refs: [...job.source_refs],
    usage: 'role_requirements_not_candidate_evidence',
  };
}
export interface CatalogDocument {
  id: string;
  kind: NonNullable<KnowledgeChunk['kind']>;
  text: string;
  source_refs: string[];
  evidence_level: NonNullable<KnowledgeChunk['evidence_level']>;
  bindings: {
    job: string;
    stages: string[];
    types: InterviewConfig['interview_type'][];
    goals: string[];
  }[];
}
export const contentHash = (value: unknown) =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex');
/** One authored record, many applicability bindings. Original catalog IDs are never replaced. */
export function buildCatalog(): CatalogDocument[] {
  const documents: CatalogDocument[] = [];
  const allTypes = Object.keys(PROFILE_GOALS) as InterviewConfig['interview_type'][];
  for (const job of JOBS) {
    const binding = {
      job: job.id,
      stages: job.stages,
      types: allTypes,
      goals: COMPETENCIES.map((c) => c.id),
    };
    documents.push({
      id: `${job.id}:profile:${job.version}`,
      kind: 'job_profile',
      text: templateJd(job),
      source_refs: job.source_refs,
      evidence_level: 'platform_authored',
      bindings: [binding],
    });
    for (const q of job.questions)
      documents.push({
        id: q.id,
        kind: 'question',
        evidence_level: 'platform_authored',
        source_refs: q.source_refs,
        text: `${q.topic}：${q.text}\n提问目的：${q.intent}\n观察方向：${q.observation_points.join('；')}\n追问线索：${q.follow_ups.join('；')}\n平台原创提问素材，不是标准答案或已验证能力证据。`,
        bindings: [
          { ...binding, stages: q.stages, types: ['technical_qa', 'project_deep_dive', 'mixed'] },
        ],
      });
  }
  for (const card of professional)
    documents.push({
      id: card.id,
      kind: 'professional',
      text: `${card.title}：${card.summary}\n适用边界：${card.boundary}`,
      source_refs: [card.id],
      evidence_level: 'source_summary',
      bindings: JOBS.filter((j) => j.category_id === card.family).map((j) => ({
        job: j.id,
        stages: j.stages,
        types: ['technical_qa', 'project_deep_dive', 'business_scenario', 'mixed'],
        goals: ['understanding', 'verification', 'tradeoffs'],
      })),
    });
  for (const card of frontendReportReference.cards)
    documents.push({
      id: card.id,
      kind: 'evaluation_reference',
      evidence_level: 'platform_authored',
      text: `${card.title}：${card.key_points.join('；')}。边界：${card.boundary}。平台参考草案，未经专家校准。`,
      source_refs: CONTENT_SOURCES.filter((source) => card.source_urls.includes(source.url)).map(
        (source) => source.id,
      ),
      bindings: [
        {
          job: 'frontend',
          stages: ['internship'],
          types: allTypes,
          goals: ['understanding', 'verification'],
        },
      ],
    });
  documents.push({
    id: 'interview-method-evidence-v1',
    kind: 'interview_method',
    source_refs: [],
    evidence_level: 'platform_authored',
    text: '围绕当前岗位和候选人实际陈述，每轮只了解一个信息点。先了解本人职责与行动，再追问选择依据和验证过程。已说明的信息不重复索取，拒绝话题不推断为能力不足，没有商业指标不自动判差。',
    bindings: JOBS.map((j) => ({
      job: j.id,
      stages: j.stages,
      types: allTypes,
      goals: COMPETENCIES.map((c) => c.id),
    })),
  });
  return documents;
}
export function catalogManifest(documents = buildCatalog()) {
  const lineage = JOBS.map((j) => ({
    job: j.id,
    version: j.version,
    status: j.status,
    authorship: j.authorship,
    review_method: j.review_method,
    reviewed_at: j.reviewed_at,
    review_due_at: j.review_due_at,
    source_refs: j.source_refs,
    question_ids: j.questions.map((q) => q.id),
  }));
  return {
    format: CATALOG_FORMAT,
    jobs: JOBS.length,
    questions: JOBS.reduce((n, j) => n + j.questions.length, 0),
    families: [...new Set(JOBS.map((j) => j.category_id))],
    documents: documents.length,
    tokenizer: TOKENIZER_VERSION,
    lineage,
    sources: catalogSources,
    checksum: contentHash({
      format: CATALOG_FORMAT,
      tokenizer: TOKENIZER_VERSION,
      documents,
      lineage,
      sources: catalogSources,
    }),
    coverage: [...new Set(JOBS.map((j) => j.category_id))].map((family) => ({
      family,
      jobs: JOBS.filter((j) => j.category_id === family).length,
      professional_cards: professional.filter((c) => c.family === family).length,
      limitation: '基础资料摘要，非细分岗位完整知识体系；未经专家校准',
    })),
  };
}
export const professionalSources = professional.map((c) => ({
  id: c.id,
  title: c.title,
  url: c.url,
  publisher: c.publisher,
  kind: 'official_documentation' as const,
  usage: 'reference_only' as const,
  verification: 'page_read' as const,
  acquired_at: '2026-11-04',
  reviewed_at: '2026-11-04',
  notes: '官方资料的团队摘要；页面核对不等于专家审核或完整岗位覆盖。',
}));
export const catalogSources = [...CONTENT_SOURCES, ...professionalSources];
