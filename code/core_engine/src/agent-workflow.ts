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
  goals: { goal: string; focus: string; material_refs: MaterialEvidence[] }[];
  limitations: string[];
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
