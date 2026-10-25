/** Public contracts shared by real services. No framework, storage or provider dependencies. */
export type MemberRole = 'student' | 'content_maintainer' | 'operator';
export interface RequestIdentity {
  owner_id: string;
  roles: MemberRole[];
}
/** Public session view. Credentials and session tokens never cross this DTO. */
export interface AuthSession {
  user: { id: string; name: string; email: string };
  roles: MemberRole[];
  expires_at: string;
}
export interface SignInInput {
  email: string;
  password: string;
  rememberMe?: boolean;
}
export interface VersionRef {
  id: string;
  version: number;
}
export interface RevisionRef {
  id: string;
  revision: number;
}
export type TaskStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';
export interface TaskView {
  id: string;
  type: string;
  status: TaskStatus;
  input_digest: string;
  attempts: number;
  max_attempts: number;
  result_ref: VersionRef | null;
  error_code: string | null;
  created_at: string;
  updated_at: string;
}
export interface TaskAccepted {
  task_id: string;
  status: TaskStatus;
}
export interface InternalEvent<T = unknown> {
  event_id: string;
  type: string;
  schema_version: number;
  owner_id: string;
  resource: VersionRef;
  occurred_at: string;
  request_id: string;
  payload: T;
}
export type ModuleName = 'accounts' | 'resumes' | 'jobs' | 'interviews' | 'reports' | 'knowledge';
export interface CapabilityView {
  database: boolean;
  worker: boolean;
  authentication: boolean;
  llm: boolean;
  private_storage: boolean;
}
