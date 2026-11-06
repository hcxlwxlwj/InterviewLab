/** Private workflow artifacts are deliberately separate from answer evidence and public DTOs. */
export const GRAPH_RUNTIME = 'graph-v1';
export interface MaterialEvidence {
  material_id: string;
  version: number;
  field: string;
  quote: string;
}
export interface ResumeAnalysis {
  facts: {
    kind: 'experience' | 'skill' | 'role' | 'action' | 'result';
    text: string;
    evidence: MaterialEvidence;
  }[];
  clarification_points: string[];
}
export interface InterviewPreparationPlan {
  role_context?: InterviewRoleContext;
  policy?: ReturnType<typeof import('./interview-policy').interviewPolicy>;
  goals: { goal: string; focus: string; material_refs: MaterialEvidence[] }[];
  limitations: string[];
}
/** Frozen public role requirements describe the job, never the candidate's performance. */
export interface InterviewRoleContext {
  job_id: string;
  job_title: string;
  job_version: number;
  description: string;
  responsibilities: string[];
  requirements: string[];
  topics: string[];
  source_refs: string[];
  usage: 'role_requirements_not_candidate_evidence';
}
export interface PreparationStatus {
  status: 'waiting_material' | 'pending' | 'ready' | 'failed' | 'fallback';
  task_id: string | null;
  error_code: string | null;
}
export interface MaterialAnalysisStatus {
  status: 'pending' | 'ready' | 'failed' | 'unavailable';
  task_id: string | null;
}
