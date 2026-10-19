import type { ContentSource, JobTemplate } from './knowledge';
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
