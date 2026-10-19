import type {
  CareerStage,
  ContentSource,
  JobTemplate,
  KnowledgeEntry,
  KnowledgeRetriever,
} from './domain/knowledge';
export function templateJd(job: JobTemplate): string {
  return `${job.title}\n\n岗位职责\n${job.responsibilities.join('\n')}\n\n基础要求\n${job.requirements.join('\n')}\n\n加分项\n${job.preferred.join('\n')}`;
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

/** Pure registry: callers supply versioned public content; no file or network access. */
export function createJobCatalog(templates: JobTemplate[], sources: ContentSource[]) {
  const ALL_JOB_TEMPLATES = templates;
  const JOBS = templates.filter((j) => j.status === 'published');
  const CONTENT_SOURCES = sources;
  const aliases: Record<string, string> = {
    java: 'backend',
    'java-backend': 'backend',
    'machine-learning': 'algorithm',
    'software-testing': 'testing',
  };
  function getJob(id: string): JobTemplate | undefined {
    return JOBS.find(
      (j) => j.status === 'published' && (j.id === (aliases[id] ?? id) || j.slug === id),
    );
  }
  function searchJobs(query: { search?: string; category?: string; stage?: CareerStage } = {}) {
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
  const localKnowledgeRetriever: KnowledgeRetriever = {
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

  return { ALL_JOB_TEMPLATES, JOBS, getJob, searchJobs, localKnowledgeRetriever };
}
