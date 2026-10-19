import { CONTENT_SOURCES, getJob, searchJobs } from '@interviewlab/backend/content';
import { reportFor } from '@interviewlab/backend/content/demo';
import {
  buildQuestions,
  defaultConfiguration,
  finishSession,
  hasExpired,
  templateJd,
  type Configuration,
  type DataClient,
  type Preferences,
  type Session,
} from '@interviewlab/core';
import {
  createResume,
  deleteResume,
  duplicateResume,
  renameResume,
  saveResume,
  setDefaultResume,
} from './resumes';
import { readDemo, removeDrafts, resetDemo, saveDemo } from './state';
import { deleteJobTarget, saveJobTarget, toggleBookmark, updateBookmark } from './targets';
import { now } from './validation';
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
      : buildQuestions(normalized, template);
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
