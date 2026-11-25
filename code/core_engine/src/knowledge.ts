import type {
  ContentSource,
  JobSearchQuery,
  JobTemplate,
  KnowledgeEntry,
  KnowledgeInterviewType,
  KnowledgeQuestion,
  KnowledgeRetriever,
  SupplementalQuestion,
} from './domain/knowledge';
export function templateJd(job: JobTemplate): string {
  return `${job.title}\n\n岗位职责\n${job.responsibilities.join('\n')}\n\n基础要求\n${job.requirements.join('\n')}\n\n加分项\n${job.preferred.join('\n')}`;
}
export function isActiveQuestion(question: KnowledgeQuestion): boolean {
  return question.status !== 'merged';
}

/** Every authored question remains eligible for mixed interviews; explicit types add focus. */
export function questionInterviewTypes(
  question: Pick<KnowledgeQuestion, 'question_type' | 'interview_types'>,
): KnowledgeInterviewType[] {
  const explicit = question.interview_types?.length
    ? [...question.interview_types]
    : question.question_type === 'technical'
      ? ['technical_qa' as const]
      : question.question_type === 'business_scenario'
        ? ['business_scenario' as const]
        : question.question_type === 'project' || question.question_type === 'behavioral'
          ? ['project_deep_dive' as const]
          : question.question_type === 'hr'
            ? ['hr' as const]
            : ['technical_qa' as const, 'project_deep_dive' as const];
  return [...new Set<KnowledgeInterviewType>([...explicit, 'mixed'])];
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
    ...job.questions.filter(isActiveQuestion).map((q) => ({
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
export function createJobCatalog(
  templates: JobTemplate[],
  sources: ContentSource[],
  supplementalQuestions: SupplementalQuestion[] = [],
) {
  const ALL_JOB_TEMPLATES = templates;
  const JOBS = templates.filter((j) => j.status === 'published');
  const CONTENT_SOURCES = sources;
  const SUPPLEMENTAL_QUESTIONS = supplementalQuestions.filter((question) => question.runtime_enabled);
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
  function searchJobs(query: JobSearchQuery = {}) {
    const text = query.search?.trim().toLowerCase();
    return JOBS.filter(
      (j) =>
        j.status === 'published' &&
        (!query.category || j.category_id === query.category) &&
        (!query.primary_class || j.primary_class_id === query.primary_class) &&
        (!query.stage || j.stages.includes(query.stage)) &&
        (!text ||
          [j.title, j.description, ...j.tags, ...j.topics].join(' ').toLowerCase().includes(text)),
    );
  }
  const localKnowledgeRetriever: KnowledgeRetriever = {
    async retrieve(query) {
      const job = getJob(query.job_id);
      if (!job) throw new Error('岗位模板未发布或已不可用。');
      const supplementalQuestions = SUPPLEMENTAL_QUESTIONS.filter(
        (question) =>
          question.eligible_job_ids.includes(job.id) &&
          (!query.stage || question.stages.includes(query.stage)) &&
          (!query.topic || question.topic === query.topic) &&
          (!query.difficulty || question.difficulty === query.difficulty) &&
          (!query.interview_type || question.interview_types.includes(query.interview_type)),
      );
      const sourceRefs = new Set([
        ...job.source_refs,
        ...supplementalQuestions.flatMap((question) => question.source_refs),
      ]);
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
            isActiveQuestion(q) &&
            (!query.stage || q.stages.includes(query.stage)) &&
            (!query.topic || q.topic === query.topic) &&
            (!query.difficulty || q.difficulty === query.difficulty) &&
            (!query.interview_type || questionInterviewTypes(q).includes(query.interview_type)),
        ),
        supplemental_questions: supplementalQuestions,
        sources: CONTENT_SOURCES.filter((source) => sourceRefs.has(source.id)),
      };
    },
  };

  return { ALL_JOB_TEMPLATES, JOBS, getJob, searchJobs, localKnowledgeRetriever };
}
