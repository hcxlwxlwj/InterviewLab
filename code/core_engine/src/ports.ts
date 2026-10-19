import type {
  Configuration,
  Experience,
  JobBookmark,
  JobTarget,
  Preferences,
  Question,
  Report,
  ResumeDocument,
  Session,
} from './domain/interview';
import type { JobSearchQuery, JobTemplate } from './domain/knowledge';
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
  listJobs(query?: JobSearchQuery): JobTemplate[];
  getJob(id: string): JobTemplate | undefined;
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
