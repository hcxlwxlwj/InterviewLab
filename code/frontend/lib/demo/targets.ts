import { getJob } from '@interviewlab/content';
import { type JobBookmark, type JobTarget } from '@interviewlab/core';
import { readDemo, saveDemo } from './state';
import { checkResumeId, nameChecked, now } from './validation';
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
