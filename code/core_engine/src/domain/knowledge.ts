import type { InterviewType } from './interview';

export type CareerStage = 'internship' | 'campus';
export type ContentStatus = 'draft' | 'reviewed' | 'published' | 'retired';
export type KnowledgeInterviewType = InterviewType | 'business_scenario';
export type KnowledgeQuestionType =
  | 'technical'
  | 'business_scenario'
  | 'behavioral'
  | 'project'
  | 'hr';
export type QuestionReviewAction = 'keep' | 'rewrite' | 'merge' | 'adapted_from_audited_question';

export interface ContentSource {
  id: string;
  title: string;
  url: string;
  publisher: string;
  kind: 'recruitment' | 'official_documentation' | 'course_feedback' | 'public_interview';
  usage: 'reference_only';
  verification: 'page_read' | 'search_index';
  acquired_at: string;
  reviewed_at: string;
  notes: string;
  published_at?: string | null;
  freshness_date?: string | null;
  evidence_grade?: 'A' | 'B' | 'C' | 'D';
}

/** Fields shared by main catalog questions and the independent public-interview layer. */
export interface RuntimeKnowledgeQuestion {
  id: string;
  topic: string;
  text: string;
  intent: string;
  observation_points: string[];
  /** Optional versioned, platform-authored reference frozen with the interview. */
  report_reference?: {
    version: string;
    review_state: 'draft';
    limitations: string;
    cards: {
      id: string;
      topics: string[];
      title: string;
      key_points: string[];
      acceptable_alternatives: string[];
      common_errors: string[];
      boundary: string;
      source_urls: string[];
    }[];
  };
  follow_ups: string[];
  stages: CareerStage[];
  difficulty: '基础' | '进阶' | '挑战';
  source_refs: string[];
  version: number;
}

export interface KnowledgeQuestion extends RuntimeKnowledgeQuestion {
  origin: 'platform_authored';
  question_type?: KnowledgeQuestionType;
  competencies?: string[];
  interview_types?: KnowledgeInterviewType[];
  status?: 'active' | 'merged';
  merged_into?: string;
  original_text?: string;
  review_action?: QuestionReviewAction;
}

export interface SupplementalQuestion extends RuntimeKnowledgeQuestion {
  origin: 'platform_authored';
  status: 'active';
  candidate_id: string;
  job_id: string;
  primary_class_id: string;
  role_family_id: string;
  source_role_family_id: string;
  question_type: 'project' | 'behavioral' | 'hr';
  competencies: string[];
  interview_types: KnowledgeInterviewType[];
  source_ids: string[];
  source_urls: string[];
  evidence_grade: 'B';
  rewrite_rationale_zh: string;
  eligible_job_ids: string[];
  review_status: 'in_review';
  human_approved: boolean;
  release_eligible: boolean;
  runtime_enabled: boolean;
  limitations: string;
}
export interface JobTemplate {
  id: string;
  slug: string;
  title: string;
  category_id: string;
  subtitle: string;
  description: string;
  tags: string[];
  version: number;
  status: ContentStatus;
  authorship: 'platform_original' | 'public_source_original';
  review_method: string;
  stages: CareerStage[];
  responsibilities: string[];
  requirements: string[];
  preferred: string[];
  topics: string[];
  questions: KnowledgeQuestion[];
  source_refs: string[];
  created_at: string;
  reviewed_at: string;
  review_due_at: string;
  code_relevant: boolean;
  jd_note: string;
  primary_class_id?: string;
  role_family_id?: string;
  scenario_tags?: string[];
}
export interface KnowledgeQuery {
  job_id: string;
  stage?: CareerStage;
  topic?: string;
  difficulty?: KnowledgeQuestion['difficulty'];
  interview_type?: KnowledgeInterviewType;
}
export interface KnowledgeEntry {
  id: string;
  job_id: string;
  template_version: number;
  kind: 'job_profile' | 'preparation_outline';
  title: string;
  body: string;
  topics: string[];
  stages: CareerStage[];
  source_refs: string[];
  status: ContentStatus;
}
export interface KnowledgeRetriever {
  retrieve(query: KnowledgeQuery): Promise<{
    template_id: string;
    template_version: number;
    items: KnowledgeQuestion[];
    supplemental_questions: SupplementalQuestion[];
    knowledge: KnowledgeEntry[];
    sources: ContentSource[];
  }>;
}
export const STAGE_LABELS: Record<CareerStage, string> = { internship: '实习', campus: '校招' };
export interface JobSearchQuery {
  search?: string;
  category?: string;
  primary_class?: string;
  stage?: CareerStage;
}
