import { getJob } from '@interviewlab/backend/content';
import { type Experience, type ResumeDocument } from '@interviewlab/core';
import { emptyResumeContent, readDemo, saveDemo } from './state';
import { checkResumeId, nameChecked, now } from './validation';
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
  return saveResume(
    { ...r, name },
    readDemo().experiences.filter((e) => e.resume_document_id === id),
    r.version,
  );
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
