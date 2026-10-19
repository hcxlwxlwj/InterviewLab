import jobsData from '../../../content/jobs.json';
import categoriesData from '../../../content/categories.json';
import sourcesData from '../../../content/sources.json';

export type CareerStage = 'internship' | 'campus';
export type ContentStatus = 'draft' | 'reviewed' | 'published' | 'retired';
export interface ContentSource {
  id: string;
  title: string;
  url: string;
  publisher: string;
  kind: 'recruitment' | 'official_documentation';
  usage: 'reference_only';
  verification: 'page_read' | 'search_index';
  acquired_at: string;
  reviewed_at: string;
  notes: string;
}
export interface KnowledgeQuestion {
  id: string;
  topic: string;
  text: string;
  intent: string;
  observation_points: string[];
  follow_ups: string[];
  stages: CareerStage[];
  difficulty: '基础' | '进阶' | '挑战';
  source_refs: string[];
  origin: 'platform_authored';
  version: number;
}
export interface JobTemplate {
  id: string;
  slug: string;
  title: string;
  category_id: string;
  subtitle: string;
  description: string;
  tags: string[];
  version: number;
  status: ContentStatus;
  authorship: 'platform_original';
  review_method: string;
  stages: CareerStage[];
  responsibilities: string[];
  requirements: string[];
  preferred: string[];
  topics: string[];
  questions: KnowledgeQuestion[];
  source_refs: string[];
  created_at: string;
  reviewed_at: string;
  review_due_at: string;
  code_relevant: boolean;
  jd_note: string;
}
export const JOB_CATEGORIES = categoriesData;
export const CONTENT_SOURCES = sourcesData as ContentSource[];
export const ALL_JOB_TEMPLATES = jobsData as JobTemplate[];
export const JOBS = ALL_JOB_TEMPLATES.filter((j) => j.status === 'published');
export const STAGE_LABELS: Record<CareerStage, string> = { internship: '实习', campus: '校招' };
const aliases: Record<string, string> = {
  java: 'backend',
  'java-backend': 'backend',
  'machine-learning': 'algorithm',
  'software-testing': 'testing',
};
export function getJob(id: string): JobTemplate | undefined {
  return JOBS.find(
    (j) => j.status === 'published' && (j.id === (aliases[id] ?? id) || j.slug === id),
  );
}
export function templateJd(job: JobTemplate): string {
  return `${job.title}\n\n岗位职责\n${job.responsibilities.join('\n')}\n\n基础要求\n${job.requirements.join('\n')}\n\n加分项\n${job.preferred.join('\n')}`;
}
export function searchJobs(
  query: { search?: string; category?: string; stage?: CareerStage } = {},
) {
  const text = query.search?.trim().toLowerCase();
  return JOBS.filter(
    (j) =>
      j.status === 'published' &&
      (!query.category || j.category_id === query.category) &&
      (!query.stage || j.stages.includes(query.stage)) &&
      (!text ||
        [j.title, j.description, ...j.tags, ...j.topics].join(' ').toLowerCase().includes(text)),
  );
}
export interface KnowledgeQuery {
  job_id: string;
  stage?: CareerStage;
  topic?: string;
  difficulty?: KnowledgeQuestion['difficulty'];
}
export interface KnowledgeEntry {
  id: string;
  job_id: string;
  template_version: number;
  kind: 'job_profile' | 'preparation_outline';
  title: string;
  body: string;
  topics: string[];
  stages: CareerStage[];
  source_refs: string[];
  status: ContentStatus;
}
/** Structured retrieval view of original content, never user resumes or pasted private JDs. */
export function knowledgeEntries(job: JobTemplate): KnowledgeEntry[] {
  const common = {
    job_id: job.id,
    template_version: job.version,
    stages: job.stages,
    status: job.status,
  };
  return [
    {
      ...common,
      id: `${job.id}-profile-v${job.version}`,
      kind: 'job_profile',
      title: job.title,
      body: templateJd(job),
      topics: job.topics,
      source_refs: job.source_refs,
    },
    ...job.questions.map((q) => ({
      ...common,
      id: `${q.id}-outline-v${job.version}`,
      kind: 'preparation_outline' as const,
      title: q.topic,
      body: `${q.intent}。准备观察方向：${q.observation_points.join('、')}。追问：${q.follow_ups.join('；')}。此提纲不是完整标准答案或对用户的评价。`,
      topics: [q.topic],
      stages: q.stages,
      source_refs: q.source_refs,
    })),
  ];
}
export interface KnowledgeRetriever {
  retrieve(query: KnowledgeQuery): Promise<{
    template_id: string;
    template_version: number;
    items: KnowledgeQuestion[];
    knowledge: KnowledgeEntry[];
    sources: ContentSource[];
  }>;
}
export const localKnowledgeRetriever: KnowledgeRetriever = {
  async retrieve(query) {
    const job = getJob(query.job_id);
    if (!job) throw new Error('岗位模板未发布或已不可用。');
    return {
      template_id: job.id,
      template_version: job.version,
      knowledge: knowledgeEntries(job).filter(
        (e) =>
          (!query.stage || e.stages.includes(query.stage)) &&
          (!query.topic || e.topics.includes(query.topic)) &&
          (!query.difficulty || query.difficulty === '基础'),
      ),
      items: job.questions.filter(
        (q) =>
          (!query.stage || q.stages.includes(query.stage)) &&
          (!query.topic || q.topic === query.topic) &&
          (!query.difficulty || q.difficulty === query.difficulty),
      ),
      sources: CONTENT_SOURCES.filter((s) => job.source_refs.includes(s.id)),
    };
  },
};
