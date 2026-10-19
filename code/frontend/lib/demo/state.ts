import { EXPERIENCES, RESUMES, sampleSession } from '@interviewlab/content/demo';
import {
  DEFAULT_PREFERENCES,
  type Experience,
  type JobBookmark,
  type JobTarget,
  type Preferences,
  type ResumeContent,
  type ResumeDocument,
  type Session,
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
export function removeDrafts(id?: string) {
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
