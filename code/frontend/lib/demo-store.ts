import {
  DEFAULT_PREFERENCES,
  EXPERIENCES,
  RESUMES,
  buildQuestions,
  defaultConfiguration,
  finishSession,
  hasExpired,
  reportFor,
  sampleSession,
  getJob,
  searchJobs,
  templateJd,
  CONTENT_SOURCES,
  type Configuration,
  type DataClient,
  type Preferences,
  type ResumeDocument,
  type ResumeContent,
  type Experience,
  type Session,
  type JobTarget,
  type JobBookmark,
} from '@interviewlab/core';
const KEY = 'interviewlab-demo-v2';
const LEGACY = 'interviewlab-demo-v1';
export interface DemoState {
  schema: 2;
  sessions: Session[];
  resumes: ResumeDocument[];
  experiences: Experience[];
  preferences: Preferences;
  bookmarks: JobBookmark[];
  job_targets: JobTarget[];
}
export const emptyResumeContent = (): ResumeContent => ({
  full_name: '',
  email: '',
  phone: '',
  education: '',
  skills: '',
  summary: '',
  raw_text: '',
});
function seededResume(r: ResumeDocument): ResumeDocument {
  return {
    ...r,
    is_sample: true,
    updated_at: r.created_at,
    target_job: r.id === 'resume-frontend' ? 'frontend' : 'backend',
    content: {
      ...emptyResumeContent(),
      full_name: '林同学（合成样例）',
      education: '示例大学 · 计算机科学与技术 · 本科在读',
      skills:
        r.id === 'resume-frontend' ? 'JavaScript、React、HTML/CSS、Git' : 'Java、Spring、SQL、Git',
      summary: '通过课程项目练习需求拆解、团队协作和结果验证，准备实习与校招。',
    },
  };
}
function fresh(): DemoState {
  return {
    schema: 2,
    sessions: [sampleSession()],
    resumes: RESUMES.map(seededResume),
    experiences: structuredClone(EXPERIENCES),
    preferences: { ...DEFAULT_PREFERENCES },
    bookmarks: [],
    job_targets: [],
  };
}
let fallback: DemoState | undefined;
let temporaryOnly = false;
export function migrateDemo(input: unknown): DemoState | undefined {
  if (!input || typeof input !== 'object') return;
  const state = input as Partial<DemoState> & { schema?: number };
  if (!Array.isArray(state.sessions) || !Array.isArray(state.resumes) || !state.preferences) return;
  if (
    state.schema === 2 &&
    Array.isArray(state.experiences) &&
    Array.isArray(state.bookmarks) &&
    Array.isArray(state.job_targets)
  )
    return state as DemoState;
  if (Number(state.schema) !== 1) return;
  const legacy = state as Partial<DemoState>;
  return {
    schema: 2,
    sessions: legacy.sessions!,
    preferences: legacy.preferences!,
    resumes: legacy.resumes!.map((r) => ({ ...seededResume(r), ...r })),
    experiences: structuredClone(
      EXPERIENCES.filter((e) => legacy.resumes!.some((r) => r.id === e.resume_document_id)),
    ),
    bookmarks: [],
    job_targets: [],
  };
}
export function readDemo(): DemoState {
  if (typeof window === 'undefined') return fresh();
  if (temporaryOnly && fallback) return fallback;
  try {
    const current = window.sessionStorage.getItem(KEY);
    const raw = current ?? window.sessionStorage.getItem(LEGACY);
    if (raw) {
      const input = JSON.parse(raw),
        state = migrateDemo(input);
      if (state) {
        if (!current || input.schema !== 2) {
          try {
            window.sessionStorage.setItem(KEY, JSON.stringify(state));
          } catch {
            fallback = state;
            temporaryOnly = true;
          }
        }
        return state;
      }
    }
  } catch {
    /* Storage denial/corruption leaves a clearly temporary usable workspace. */
  }
  return fallback ?? fresh();
}
export function saveDemo(state: DemoState) {
  fallback = state;
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(state));
    temporaryOnly = false;
  } catch {
    temporaryOnly = true;
  }
  window.dispatchEvent(new Event('interviewlab-change'));
}
export function storageAvailable() {
  if (temporaryOnly) return false;
  try {
    const key = `${KEY}-probe`;
    window.sessionStorage.setItem(key, '1');
    window.sessionStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}
function removeDrafts(id?: string) {
  try {
    const keys = Array.from({ length: window.sessionStorage.length }, (_, i) =>
      window.sessionStorage.key(i),
    );
    for (const key of keys)
      if (
        key &&
        (key.startsWith('interviewlab-code-') || key.startsWith('interviewlab-answer-')) &&
        (!id || key.endsWith(id))
      )
        window.sessionStorage.removeItem(key);
  } catch {}
}
export function resetDemo() {
  removeDrafts();
  try {
    window.sessionStorage.removeItem(LEGACY);
  } catch {}
  saveDemo(fresh());
}
const now = () => new Date().toISOString();
function nameChecked(name: string) {
  if (!name.trim() || name.trim().length > 100) throw new Error('名称应为 1–100 个字符。');
  return name.trim();
}
function checkResumeId(id?: string) {
  if (id && !readDemo().resumes.some((r) => r.id === id))
    throw new Error('关联简历已不可用，请重新选择。');
}
export function createResume(name: string, job = 'frontend'): ResumeDocument {
  if (!getJob(job)) throw new Error('请选择可用的目标方向。');
  const r: ResumeDocument = {
    id: crypto.randomUUID(),
    name: nameChecked(name),
    version: 1,
    is_default: false,
    storage_scope: 'library',
    parse_status: 'confirmed',
    file_type: 'text',
    created_at: now(),
    updated_at: now(),
    target_job: job,
    content: emptyResumeContent(),
    is_sample: false,
  };
  const state = readDemo();
  saveDemo({ ...state, resumes: [r, ...state.resumes] });
  return r;
}
export function saveResume(
  resume: ResumeDocument,
  experiences: Experience[],
  expectedVersion: number,
) {
  const state = readDemo(),
    previous = state.resumes.find((r) => r.id === resume.id);
  if (!previous) throw new Error('简历已被删除。');
  if (previous.version !== expectedVersion) throw new Error('简历已更新，请刷新后重新编辑。');
  if (!getJob(resume.target_job ?? 'frontend')) throw new Error('目标岗位已不可用。');
  if (experiences.some((e) => e.resume_document_id !== resume.id || !e.title.trim()))
    throw new Error('请填写经历标题，并确认经历属于当前简历。');
  if (new Set(experiences.map((e) => e.id)).size !== experiences.length)
    throw new Error('经历标识不能重复。');
  const otherIds = new Set(
    state.experiences.filter((e) => e.resume_document_id !== resume.id).map((e) => e.id),
  );
  if (experiences.some((e) => otherIds.has(e.id))) throw new Error('不能覆盖其他简历的经历。');
  const saved = {
    ...resume,
    name: nameChecked(resume.name),
    is_default: previous.is_default,
    version: previous.version + 1,
    updated_at: now(),
  };
  saveDemo({
    ...state,
    resumes: state.resumes.map((r) => (r.id === resume.id ? saved : r)),
    experiences: [
      ...state.experiences.filter((e) => e.resume_document_id !== resume.id),
      ...experiences.map((e) => ({
        ...e,
        version: (state.experiences.find((x) => x.id === e.id)?.version ?? 0) + 1,
      })),
    ],
  });
  return saved;
}
export function duplicateResume(id: string) {
  const state = readDemo(),
    source = state.resumes.find((r) => r.id === id);
  if (!source) throw new Error('简历已不可用。');
  const copy = {
    ...structuredClone(source),
    id: crypto.randomUUID(),
    name: `${source.name.slice(0, 95)} 副本`,
    version: 1,
    is_default: false,
    is_sample: false,
    created_at: now(),
    updated_at: now(),
  };
  saveDemo({
    ...state,
    resumes: [copy, ...state.resumes],
    experiences: [
      ...state.experiences,
      ...state.experiences
        .filter((e) => e.resume_document_id === id)
        .map((e) => ({ ...e, id: crypto.randomUUID(), resume_document_id: copy.id, version: 1 })),
    ],
  });
  return copy;
}
export function setDefaultResume(id: string) {
  checkResumeId(id);
  const state = readDemo();
  saveDemo({ ...state, resumes: state.resumes.map((r) => ({ ...r, is_default: r.id === id })) });
}
export function renameResume(id: string, name: string) {
  const r = readDemo().resumes.find((r) => r.id === id);
  if (!r) throw new Error('简历已不可用。');
  return saveResume({ ...r, name }, demoClient.listExperiences(id), r.version);
}
export function deleteResume(id: string) {
  const state = readDemo();
  saveDemo({
    ...state,
    resumes: state.resumes.filter((r) => r.id !== id),
    experiences: state.experiences.filter((e) => e.resume_document_id !== id),
    bookmarks: state.bookmarks.map((b) =>
      b.preferred_resume_id === id
        ? { ...b, preferred_resume_id: undefined, version: b.version + 1 }
        : b,
    ),
    job_targets: state.job_targets.map((t) =>
      t.preferred_resume_id === id
        ? { ...t, preferred_resume_id: undefined, version: t.version + 1, updated_at: now() }
        : t,
    ),
  });
}
export function toggleBookmark(id: string) {
  const state = readDemo(),
    existed = state.bookmarks.some((b) => b.template_id === id);
  if (!existed && !getJob(id)) throw new Error('岗位已不可用。');
  saveDemo({
    ...state,
    bookmarks: existed
      ? state.bookmarks.filter((b) => b.template_id !== id)
      : [...state.bookmarks, { template_id: id, notes: '', version: 1, created_at: now() }],
  });
  return !existed;
}
export function updateBookmark(
  id: string,
  changes: Pick<JobBookmark, 'notes' | 'preferred_resume_id'>,
  expectedVersion: number,
) {
  checkResumeId(changes.preferred_resume_id);
  const state = readDemo(),
    b = state.bookmarks.find((b) => b.template_id === id);
  if (!b || b.version !== expectedVersion) throw new Error('收藏已变化，请刷新后重试。');
  saveDemo({
    ...state,
    bookmarks: state.bookmarks.map((b) =>
      b.template_id === id ? { ...b, ...changes, version: b.version + 1 } : b,
    ),
  });
}
export function saveJobTarget(target: JobTarget, expectedVersion: number): JobTarget {
  const state = readDemo(),
    previous = state.job_targets.find((t) => t.id === target.id);
  if ((previous?.version ?? 0) !== expectedVersion) throw new Error('目标岗位已变化，请重新打开。');
  checkResumeId(target.preferred_resume_id);
  if (!getJob(target.job)) throw new Error('请选择可用的岗位方向。');
  if (!target.jd_text.trim() || target.jd_text.length > 10000)
    throw new Error('请填写 1–10000 字的 JD 内容。');
  if (target.source_url && !/^https?:\/\/[^\s]+$/i.test(target.source_url))
    throw new Error('来源链接应以 http:// 或 https:// 开头。');
  const saved = {
    ...target,
    title: nameChecked(target.title),
    version: expectedVersion + 1,
    created_at: previous?.created_at ?? now(),
    updated_at: now(),
  };
  saveDemo({
    ...state,
    job_targets: previous
      ? state.job_targets.map((t) => (t.id === saved.id ? saved : t))
      : [saved, ...state.job_targets],
  });
  return saved;
}
export function deleteJobTarget(id: string) {
  const state = readDemo();
  saveDemo({ ...state, job_targets: state.job_targets.filter((t) => t.id !== id) });
}
export function updatePreferences(changes: Partial<Preferences>) {
  const state = readDemo();
  saveDemo({
    ...state,
    preferences: { ...state.preferences, ...changes, version: state.preferences.version + 1 },
  });
}
export function deleteDemoSession(id: string) {
  const state = readDemo();
  removeDrafts(id);
  saveDemo({
    ...state,
    sessions: state.sessions
      .filter((s) => s.id !== id)
      .map((s) =>
        s.parent_session_id === id
          ? { ...s, parent_session_id: undefined, parent_turn_id: undefined }
          : s,
      ),
  });
}
export function newConfiguration(job?: string): Configuration {
  const state = readDemo(),
    chosenJob = job || state.preferences.default_job_direction || 'frontend';
  if (!getJob(chosenJob)) throw new Error('岗位模板未发布或已不可用。');
  const resume = state.resumes.find((r) => r.is_default);
  return {
    ...defaultConfiguration(chosenJob),
    job_template_version: getJob(chosenJob)!.version,
    jd_source: 'template',
    jd_text: templateJd(getJob(chosenJob)!),
    career_stage: 'campus',
    interaction_mode: state.preferences.interaction_mode,
    resume_document_id: resume?.id,
    resume_document_version: resume?.version,
    focus_experience_ids: state.experiences
      .filter((e) => e.resume_document_id === resume?.id && e.confirmed)
      .slice(0, 1)
      .map((e) => e.id),
  };
}
export const demoClient: DataClient = {
  listJobs: searchJobs,
  getJob,
  listResumes: () => readDemo().resumes,
  listExperiences: (id) => readDemo().experiences.filter((e) => !id || e.resume_document_id === id),
  createResume,
  saveResume,
  duplicateResume,
  renameResume,
  deleteResume,
  setDefaultResume,
  toggleBookmark,
  updateBookmark,
  saveJobTarget,
  deleteJobTarget,
  updatePreferences,
  reset: resetDemo,
  listSessions: () => readDemo().sessions,
  getSession(id) {
    const s = readDemo().sessions.find((s) => s.id === id);
    if (s && ['paused', 'in_progress'].includes(s.status) && hasExpired(s)) {
      const ended = finishSession(s);
      this.saveSession(ended);
      return ended;
    }
    return s;
  },
  createSession(config, parent) {
    const state = readDemo();
    const source = parent ? state.sessions.find((s) => s.id === parent.session_id) : undefined;
    const sourceTurn = source?.turns.find((t) => t.id === parent?.turn_id);
    if (parent && !sourceTurn) throw new Error('原回答已不可用，请重新选择重练问题。');
    const template = source?.material_snapshot.job_template ?? getJob(config.job);
    if (!template) throw new Error('岗位模板未发布或已不可用，请重新选择。');
    if (!parent && config.job_template_version && config.job_template_version !== template.version)
      throw new Error('岗位模板已更新，请重新确认配置。');
    const target =
      source?.material_snapshot.job_target ??
      state.job_targets.find((t) => t.id === config.job_target_id);
    if (
      !parent &&
      config.job_target_id &&
      (!target || target.version !== config.job_target_version || target.job !== config.job)
    )
      throw new Error('个人JD已变化，请重新选择并确认。');
    const selectedResume =
      source?.material_snapshot.resume ??
      state.resumes.find((r) => r.id === config.resume_document_id);
    if (
      !parent &&
      config.resume_document_version &&
      selectedResume?.version !== config.resume_document_version
    )
      throw new Error('简历版本已变化，请重新选择并确认经历。');
    const pool = source?.material_snapshot.experiences ?? state.experiences;
    const experiences = pool.filter(
      (e) =>
        e.confirmed &&
        config.focus_experience_ids.includes(e.id) &&
        e.resume_document_id === selectedResume?.id,
    );
    const normalized: Configuration = {
      ...structuredClone(config),
      job: template.id,
      job_template_version: template.version,
      interaction_mode: 'text_fallback',
      code_assessment_enabled: template.code_relevant && config.code_assessment_enabled,
      focus_experience_ids: experiences.map((e) => e.id),
      camera_enabled: false,
      review_media_enabled: false,
    };
    if (!selectedResume) delete normalized.resume_document_id;
    if (!parent && normalized.job_target_id && target?.jd_text !== normalized.jd_text)
      throw new Error('个人 JD 已修改，请先保存到个人 JD 再开始。');
    const questions = sourceTurn
      ? [
          {
            id: `retry-${sourceTurn.id}`,
            text: sourceTurn.text,
            knowledge_question_id: sourceTurn.knowledge_question_id,
            source_refs: sourceTurn.source_refs,
            template_version: sourceTurn.template_version,
            main_question_index: 1,
            follow_up_index: 0,
          },
        ]
      : buildQuestions(normalized);
    const session: Session = {
      id: crypto.randomUUID(),
      mode: 'mock',
      interview_type: normalized.interview_type,
      status: 'in_progress',
      configuration: normalized,
      version: 1,
      started_at: now(),
      created_at: now(),
      questions,
      turns: [],
      material_snapshot: {
        resume: selectedResume ? structuredClone(selectedResume) : undefined,
        experiences: structuredClone(experiences),
        job_template: structuredClone(template),
        knowledge_sources: structuredClone(
          source?.material_snapshot.knowledge_sources ??
            CONTENT_SOURCES.filter((s) => template.source_refs.includes(s.id)),
        ),
        job_target: target
          ? structuredClone({ ...target, jd_text: normalized.jd_text })
          : undefined,
      },
      parent_session_id: parent?.session_id,
      parent_turn_id: parent?.turn_id,
      is_sample: false,
    };
    saveDemo({ ...state, sessions: [session, ...state.sessions] });
    return session;
  },
  saveSession(session) {
    const state = readDemo(),
      current = state.sessions.find((s) => s.id === session.id);
    if (!current) throw new Error('面试已删除，不能重新保存。');
    if (current.version > session.version) throw new Error('记录已更新，请刷新后重试。');
    saveDemo({
      ...state,
      sessions: state.sessions.map((s) => (s.id === session.id ? session : s)),
    });
  },
  getReport: reportFor,
};
