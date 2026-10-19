import { JOBS, getJob, type JobTemplate, type ContentSource } from './catalog';
export * from './catalog';
export type InteractionMode = 'realtime_voice' | 'text_fallback';
export type InterviewType = 'technical_qa' | 'project_deep_dive' | 'hr' | 'mixed';
export type SessionStatus =
  | 'draft'
  | 'ready'
  | 'in_progress'
  | 'paused'
  | 'ending'
  | 'completed'
  | 'failed';
export type JobStatus = 'pending' | 'generating' | 'ready' | 'failed';
export type DimensionKey =
  | 'technical_knowledge'
  | 'project_communication'
  | 'coding_ability'
  | 'logical_expression';
export interface Configuration {
  job: string;
  job_template_version?: number;
  job_target_id?: string;
  job_target_version?: number;
  jd_source?: 'template' | 'custom';
  resume_document_version?: number;
  career_stage?: 'internship' | 'campus';
  interview_type: InterviewType;
  difficulty: '基础' | '进阶' | '挑战';
  jd_text: string;
  duration_minutes: 5 | 10;
  interviewer_style: '标准' | '友好' | '深入追问';
  code_assessment_enabled: boolean;
  interaction_mode: InteractionMode;
  camera_enabled: false;
  review_media_enabled: false;
  resume_document_id?: string;
  focus_experience_ids: string[];
}
export interface ResumeContent {
  full_name: string;
  email: string;
  phone: string;
  education: string;
  skills: string;
  summary: string;
  raw_text: string;
}
export interface JobTarget {
  id: string;
  title: string;
  company: string;
  job: string;
  jd_text: string;
  source_url: string;
  notes: string;
  preferred_resume_id?: string;
  source_kind: 'custom_jd' | 'template_copy';
  template_id?: string;
  template_version?: number;
  version: number;
  created_at: string;
  updated_at: string;
}
export interface JobBookmark {
  template_id: string;
  notes: string;
  preferred_resume_id?: string;
  version: number;
  created_at: string;
}
export interface ResumeDocument {
  id: string;
  name: string;
  version: number;
  is_default: boolean;
  storage_scope: 'library' | 'temporary';
  parse_status: 'uploaded' | 'parsing' | 'needs_confirmation' | 'confirmed' | 'failed';
  file_type: 'pdf' | 'docx' | 'text';
  content?: ResumeContent;
  target_job?: string;
  updated_at?: string;
  is_sample?: boolean;
  created_at: string;
  expires_at?: string;
}
export interface Experience {
  id: string;
  title: string;
  kind:
    | 'course_project'
    | 'competition'
    | 'research'
    | 'graduation_project'
    | 'internship'
    | 'other';
  personal_role: string;
  actions: string;
  technical_decisions: string;
  results: string;
  confirmed: boolean;
  version: number;
  resume_document_id?: string;
}
export interface Question {
  id: string;
  knowledge_question_id?: string;
  template_version?: number;
  source_refs?: string[];
  text: string;
  main_question_index: number;
  follow_up_index: number;
}
export interface AnswerSegment {
  id: string;
  source: 'text' | 'audio';
  text: string;
  seq: number;
  started_at: string;
  ended_at: string;
  capture_status: 'complete' | 'gap';
}
export interface Turn extends Question {
  input_mode: InteractionMode;
  answer_segments: AnswerSegment[];
  answer_text: string;
  revision: number;
  submission_id: string;
  action: 'answer' | 'clarify_question' | 'repeat_question' | 'skip';
}
export interface Session {
  id: string;
  mode: 'mock';
  interview_type: InterviewType;
  status: SessionStatus;
  configuration: Configuration;
  version: number;
  created_at: string;
  started_at: string;
  ended_at?: string;
  report_ready_at?: number;
  questions: Question[];
  turns: Turn[];
  parent_session_id?: string;
  parent_turn_id?: string;
  material_snapshot: {
    resume?: ResumeDocument;
    experiences: Experience[];
    job_template?: JobTemplate;
    job_target?: JobTarget;
    knowledge_sources?: ContentSource[];
  };
  is_sample: boolean;
  code_submissions?: {
    language: 'cpp' | 'python' | 'java';
    source_code: string;
    revision: number;
    submitted_at: string;
    execution_mode: 'simulated';
  }[];
}
export interface EvidenceRef {
  turn_id: string;
  revision: number;
  quote: string;
}
export interface Dimension {
  status: 'observed' | 'not_observed';
  score: number | null;
  explanation: string;
  evidence_refs: EvidenceRef[];
}
export interface Report {
  id: string;
  session_id: string;
  status: JobStatus;
  overall_score: number | null;
  dimensions: Record<DimensionKey, Dimension>;
  is_partial: boolean;
  is_sample: boolean;
  coverage: string;
}
export interface RetryComparison {
  original_session_id: string;
  retry_session_id: string;
  original_turn_id: string;
  original_revision: number;
  retry_revision: number;
  original_text: string;
  retry_text: string;
  input_modes: InteractionMode[];
  limitations: string[];
}
export interface Preferences {
  interaction_mode: InteractionMode;
  editor_theme: 'system' | 'light' | 'dark';
  default_job_direction: string;
  version: number;
}
export interface ApiError {
  code: string;
  message: string;
  retryable: boolean;
  request_id: string;
}
export interface PageResult<T> {
  items: T[];
  next_cursor: string | null;
}
export interface StreamEvent {
  type: string;
  session_id: string;
  turn_id?: string;
  generation_id?: string;
  seq: number;
  payload: unknown;
}
export interface ProviderResult<T> {
  value: T;
  provider: string;
  usage?: { input: number; output: number };
}
export interface ModelAdapter {
  ask(input: { session: Session; signal: AbortSignal }): Promise<ProviderResult<Question>>;
}
export interface SpeechAdapter {
  available: boolean;
  transcribe(audio: Uint8Array, signal: AbortSignal): Promise<ProviderResult<string>>;
}
export interface TtsAdapter {
  available: boolean;
  synthesize(text: string, signal: AbortSignal): AsyncIterable<Uint8Array>;
}
export interface VisionAdapter {
  available: boolean;
  observe(frames: Uint8Array[], signal: AbortSignal): Promise<ProviderResult<unknown>>;
}
export interface CodeExecutionAdapter {
  available: boolean;
  run(input: {
    language: 'cpp' | 'python' | 'java';
    source: string;
    signal: AbortSignal;
  }): Promise<unknown>;
}
export interface PrivateStorageAdapter {
  read(ownerId: string, id: string): Promise<Uint8Array>;
  delete(ownerId: string, id: string): Promise<void>;
}
export interface SessionRepository {
  get(ownerId: string, id: string): Promise<Session | null>;
  save(ownerId: string, session: Session, expectedVersion: number): Promise<void>;
}
export interface DataClient {
  listJobs: typeof import('./catalog').searchJobs;
  getJob: typeof getJob;
  listResumes(): ResumeDocument[];
  saveResume(
    resume: ResumeDocument,
    experiences: Experience[],
    expectedVersion: number,
  ): ResumeDocument;
  createResume(name: string, job?: string): ResumeDocument;
  duplicateResume(id: string): ResumeDocument;
  deleteResume(id: string): void;
  setDefaultResume(id: string): void;
  renameResume(id: string, name: string): void;
  listExperiences(resumeId?: string): Experience[];
  toggleBookmark(id: string): boolean;
  updateBookmark(
    id: string,
    changes: Pick<JobBookmark, 'notes' | 'preferred_resume_id'>,
    expectedVersion: number,
  ): void;
  saveJobTarget(target: JobTarget, expectedVersion: number): JobTarget;
  deleteJobTarget(id: string): void;
  updatePreferences(changes: Partial<Preferences>): void;
  reset(): void;
  listSessions(): Session[];
  getSession(id: string): Session | undefined;
  createSession(config: Configuration, parent?: { session_id: string; turn_id: string }): Session;
  saveSession(session: Session): void;
  getReport(session: Session, now?: number): Report;
}

export const TYPE_LABELS: Record<InterviewType, string> = {
  project_deep_dive: '项目深挖',
  technical_qa: '专业问答',
  hr: 'HR 面试',
  mixed: '综合面试',
};
export const STATUS_LABELS: Record<SessionStatus, string> = {
  draft: '配置中',
  ready: '待开始',
  in_progress: '进行中',
  paused: '已暂停',
  ending: '正在结束',
  completed: '已完成',
  failed: '已中断',
};
export const DIMENSION_LABELS: Record<DimensionKey, string> = {
  technical_knowledge: '专业知识',
  project_communication: '项目表达',
  coding_ability: '代码能力',
  logical_expression: '逻辑表达',
};
export const RESUMES: ResumeDocument[] = [
  {
    id: 'resume-frontend',
    name: '前端项目版',
    version: 1,
    is_default: true,
    storage_scope: 'library',
    parse_status: 'confirmed',
    file_type: 'pdf',
    created_at: '2026-10-15T08:00:00Z',
  },
  {
    id: 'resume-backend',
    name: '后端实习版',
    version: 2,
    is_default: false,
    storage_scope: 'library',
    parse_status: 'confirmed',
    file_type: 'pdf',
    created_at: '2026-10-16T08:00:00Z',
  },
];
export const EXPERIENCES: Experience[] = [
  {
    id: 'exp-market',
    title: '校园二手交易平台',
    kind: 'course_project',
    personal_role: '前端页面与交互开发',
    actions: '负责商品列表、搜索筛选和发布表单，与同学约定接口字段。',
    technical_decisions: '使用组件拆分复用筛选逻辑，区分服务端数据和表单状态。',
    results: '完成课程演示，并通过手工场景检查核心流程。',
    confirmed: true,
    version: 1,
    resume_document_id: 'resume-frontend',
  },
  {
    id: 'exp-schedule',
    title: '课程管理系统',
    kind: 'course_project',
    personal_role: '课表交互实现',
    actions: '实现课程筛选、时间冲突提示和空态。',
    technical_decisions: '将时间段归一后判断重叠。',
    results: '交付小组课程项目。',
    confirmed: true,
    version: 1,
    resume_document_id: 'resume-frontend',
  },
  {
    id: 'exp-library',
    title: '图书借阅管理系统',
    kind: 'course_project',
    personal_role: '借阅接口与数据库设计',
    actions: '编写借还书接口、设计借阅记录表并处理重复请求。',
    technical_decisions: '以事务保证库存更新与借阅记录一致。',
    results: '用正常与重复借阅场景验证接口。',
    confirmed: true,
    version: 1,
    resume_document_id: 'resume-backend',
  },
];
export const DEFAULT_PREFERENCES: Preferences = {
  interaction_mode: 'realtime_voice',
  editor_theme: 'system',
  default_job_direction: '',
  version: 1,
};
export function defaultConfiguration(job = 'frontend'): Configuration {
  return {
    job,
    interview_type: 'project_deep_dive',
    difficulty: '基础',
    jd_text: '',
    duration_minutes: 10,
    interviewer_style: '标准',
    code_assessment_enabled: false,
    interaction_mode: 'realtime_voice',
    camera_enabled: false,
    review_media_enabled: false,
    resume_document_id: 'resume-frontend',
    focus_experience_ids: ['exp-market'],
  };
}
export function buildQuestions(config: Configuration): Question[] {
  const project = config.focus_experience_ids.length > 0;
  let texts =
    config.interview_type === 'hr'
      ? [
          '请简单介绍自己，以及你希望从这份岗位中获得什么。',
          '请分享一次你与同学意见不一致的经历。',
          '在任务很多的时候，你如何安排优先级？',
          '请描述一次你主动学习陌生知识的经历。',
          '遇到暂时无法解决的困难，你会怎么做？',
          '你还有什么想补充的吗？',
        ]
      : project
        ? [
            '请介绍一个你参与的项目，并具体说明你负责的部分。',
            '项目中遇到的一个难点是什么？你是如何定位和处理的？',
            '你如何验证自己的实现是正确的？',
            '请谈谈项目里的一次团队协作。',
            '如果重新实现这个项目，你会优先改进什么？',
            '结合目标岗位，你认为这段经历体现了哪些能力？',
          ]
        : [
            '请介绍一下你的学习经历和目标岗位。',
            `在${JOBS.find((j) => j.id === config.job)?.title ?? '目标岗位'}中，选择一个熟悉的专业概念说明其原理。`,
            '请举例说明这个概念或方法在什么场景下适用。',
            '出现异常结果时，你通常如何定位问题？',
            '你会如何设计一个验证思路的最小实验？',
            '你下一阶段希望深入学习什么？',
          ];
  const template = getJob(config.job);
  if (!template) throw new Error('岗位模板未发布或已不可用，请重新选择岗位。');
  const technical = template.questions.slice(0, 6).map((q) => q.text);
  if (config.difficulty !== '基础')
    technical[0] +=
      config.difficulty === '进阶'
        ? '请进一步说明其中的关键原理与边界条件。'
        : '请比较一种替代方案，并说明失败场景和取舍依据。';
  if (config.interview_type === 'technical_qa') texts = technical;
  if (config.interview_type === 'mixed')
    texts = [
      texts[0],
      texts[1],
      technical[0],
      technical[1],
      '请分享一次团队协作中需要调整自己方案的经历。',
      '结合目标岗位，你还希望补充什么？',
    ];
  const questions: Question[] = [];
  texts.forEach((text, i) => {
    const knowledge = template.questions.find((q) => text.startsWith(q.text));
    questions.push({
      id: `q-${i + 1}`,
      text,
      main_question_index: i + 1,
      follow_up_index: 0,
      knowledge_question_id: knowledge?.id,
      template_version: template.version,
      source_refs: knowledge?.source_refs ?? template.source_refs,
    });
    if (
      config.interview_type === 'technical_qa' &&
      config.interviewer_style === '深入追问' &&
      knowledge &&
      i < 2
    ) {
      knowledge.follow_ups
        .slice(0, 2)
        .forEach((followUp, index) =>
          questions.push({
            id: `q-${i + 1}-${index + 1}`,
            text: followUp,
            main_question_index: i + 1,
            follow_up_index: index + 1,
            knowledge_question_id: knowledge.id,
            template_version: template.version,
            source_refs: knowledge.source_refs,
          }),
        );
    }
    if (
      project &&
      (config.interview_type === 'project_deep_dive' || config.interview_type === 'mixed') &&
      i < 2
    ) {
      questions.push({
        id: `q-${i + 1}-1`,
        text:
          i === 0
            ? '这部分工作中，哪些是你独立完成的，哪些与同学协作完成？'
            : '当时考虑过其他方案吗？为什么最终选择了这个方案？',
        main_question_index: i + 1,
        follow_up_index: 1,
      });
      if (config.interviewer_style === '深入追问')
        questions.push({
          id: `q-${i + 1}-2`,
          text: '能用一个具体的实现细节或验证过程说明吗？',
          main_question_index: i + 1,
          follow_up_index: 2,
        });
    }
  });
  return questions;
}
export function elapsedSeconds(session: Session, now = Date.now()): number {
  return Math.max(
    0,
    Math.floor(
      ((session.ended_at ? Date.parse(session.ended_at) : now) - Date.parse(session.started_at)) /
        1000,
    ),
  );
}
export function hasExpired(session: Session, now = Date.now()) {
  return elapsedSeconds(session, now) >= 720;
}
export function finishSession(session: Session, now = Date.now()): Session {
  if (session.status === 'completed' || session.status === 'failed') return session;
  return {
    ...session,
    status: 'completed',
    ended_at: new Date(now).toISOString(),
    report_ready_at: now + 1400,
    version: session.version + 1,
  };
}
export function transitionSession(
  session: Session,
  status: 'paused' | 'in_progress',
  now = Date.now(),
): Session {
  if (hasExpired(session, now) && (session.status === 'paused' || session.status === 'in_progress'))
    return finishSession(session, now);
  if (
    (session.status === 'in_progress' && status === 'paused') ||
    (session.status === 'paused' && status === 'in_progress')
  )
    return { ...session, status, version: session.version + 1 };
  throw new Error('当前状态不支持此操作');
}
export function commitAnswer(
  session: Session,
  text: string,
  action: 'answer' | 'skip',
  submissionId: string,
  now = Date.now(),
): Session {
  if (session.turns.some((t) => t.submission_id === submissionId)) return session;
  if (session.status !== 'in_progress') throw new Error('请先恢复面试再提交');
  if (hasExpired(session, now)) return finishSession(session, now);
  if (action === 'answer' && !text.trim()) throw new Error('请输入回答，或选择跳过');
  const question = session.questions[session.turns.length];
  if (!question) return finishSession(session, now);
  const stamp = new Date(now).toISOString();
  const turn: Turn = {
    ...question,
    input_mode: 'text_fallback',
    answer_text: action === 'answer' ? text.trim() : '',
    revision: 1,
    submission_id: submissionId,
    action,
    answer_segments:
      action === 'answer'
        ? [
            {
              id: `${submissionId}-segment`,
              source: 'text',
              text: text.trim(),
              seq: 1,
              started_at: stamp,
              ended_at: stamp,
              capture_status: 'complete',
            },
          ]
        : [],
  };
  const next: Session = {
    ...session,
    turns: [...session.turns, turn],
    version: session.version + 1,
  };
  return next.turns.length >= next.questions.length ? finishSession(next, now) : next;
}
export function overallScore(dimensions: Record<DimensionKey, Dimension>): number | null {
  const observed = Object.values(dimensions).filter(
    (d) => d.status === 'observed' && d.score !== null,
  );
  return observed.length
    ? Math.round(observed.reduce((sum, d) => sum + d.score!, 0) / observed.length)
    : null;
}
export function reportFor(session: Session, now = Date.now()): Report {
  const empty = (): Dimension => ({
    status: 'not_observed',
    score: null,
    explanation: '当前为交互演示，未接入专业评估服务。',
    evidence_refs: [],
  });
  const dimensions: Record<DimensionKey, Dimension> = {
    technical_knowledge: empty(),
    project_communication: empty(),
    coding_ability: empty(),
    logical_expression: empty(),
  };
  if (session.is_sample) {
    const evidence = [
      {
        turn_id: session.turns[0].id,
        revision: 1,
        quote: '我主要负责商品列表、搜索筛选和发布表单',
      },
    ];
    dimensions.technical_knowledge = {
      status: 'observed',
      score: 78,
      explanation: '示例：交代了组件划分与状态管理的基本思路。',
      evidence_refs: evidence,
    };
    dimensions.project_communication = {
      status: 'observed',
      score: 85,
      explanation: '示例：区分了本人负责的模块和同学完成的工作。',
      evidence_refs: evidence,
    };
    dimensions.logical_expression = {
      status: 'observed',
      score: 80,
      explanation: '示例：先概述职责，再描述具体行动，验证过程仍可补充。',
      evidence_refs: evidence,
    };
    dimensions.coding_ability.explanation = '本场未安排正式代码考核。';
  }
  const valid = session.turns.filter((t) => t.action === 'answer' && t.answer_text.trim()).length;
  return {
    id: `report-${session.id}`,
    session_id: session.id,
    status:
      session.status !== 'completed' && session.status !== 'failed'
        ? 'pending'
        : now < (session.report_ready_at ?? 0)
          ? 'generating'
          : 'ready',
    overall_score: valid ? overallScore(dimensions) : null,
    dimensions,
    is_partial: session.status === 'failed',
    is_sample: session.is_sample,
    coverage: valid
      ? `已记录 ${valid} 次回答，${session.turns.filter((t) => t.action === 'skip').length} 次跳过`
      : '没有已提交的有效回答，本场不评分',
  };
}
export function sampleSession(): Session {
  const configuration = { ...defaultConfiguration(), interaction_mode: 'text_fallback' as const };
  const questions = buildQuestions(configuration);
  const answers = [
    '这是一个小组课程项目。我主要负责商品列表、搜索筛选和发布表单，后端接口由另一位同学负责。我们先约定了接口字段，再拆分组件，最后用几组商品数据验证了筛选和发布流程。',
    '商品列表和发布表单由我独立实现。接口字段和错误提示是与后端同学一起讨论确定的。',
    '最初我们将筛选条件分别存储在多个组件里，切换页面后会出现不同步。我把条件收敛到页面状态，通过参数传给子组件，减少了重复状态。',
  ];
  const base: Session = {
    id: 'sample-interview',
    mode: 'mock',
    interview_type: configuration.interview_type,
    status: 'in_progress',
    configuration,
    version: 1,
    created_at: '2026-10-18T06:00:00Z',
    started_at: '2026-10-18T06:00:00Z',
    questions,
    turns: [],
    material_snapshot: { resume: RESUMES[0], experiences: [EXPERIENCES[0]] },
    is_sample: true,
  };
  let session = base;
  answers.forEach((a, i) => {
    session = commitAnswer(
      session,
      a,
      'answer',
      `sample-submission-${i}`,
      Date.parse(base.started_at) + (i + 1) * 60000,
    );
  });
  return { ...finishSession(session, Date.parse(base.started_at) + 326000), report_ready_at: 0 };
}
