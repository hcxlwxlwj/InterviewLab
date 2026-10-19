import { readDemo } from './state';
export const now = () => new Date().toISOString();
export function nameChecked(name: string) {
  if (!name.trim() || name.trim().length > 100) throw new Error('名称应为 1–100 个字符。');
  return name.trim();
}
export function checkResumeId(id?: string) {
  if (id && !readDemo().resumes.some((r) => r.id === id))
    throw new Error('关联简历已不可用，请重新选择。');
}
