export type CareerStage = 'internship' | 'campus';
export type ContentStatus = 'draft' | 'reviewed' | 'published' | 'retired';
export interface ContentSource {
  id: string;
  title: string;
  url: string;
  publisher: string;
  kind: 'recruitment' | 'official_documentation';
  usage: 'reference_only';
  verification: 'page_read' | 'search_index';
  acquired_at: string;
  reviewed_at: string;
  notes: string;
}
export interface KnowledgeQuestion {
  id: string;
  topic: string;
  text: string;
  intent: string;
  observation_points: string[];
  follow_ups: string[];
  stages: CareerStage[];
  difficulty: '基础' | '进阶' | '挑战';
  source_refs: string[];
  origin: 'platform_authored';
  version: number;
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
  authorship: 'platform_original';
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
}
export interface KnowledgeQuery {
  job_id: string;
  stage?: CareerStage;
  topic?: string;
  difficulty?: KnowledgeQuestion['difficulty'];
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
    knowledge: KnowledgeEntry[];
    sources: ContentSource[];
  }>;
}
export const STAGE_LABELS: Record<CareerStage, string> = { internship: '实习', campus: '校招' };
export interface JobSearchQuery {
  search?: string;
  category?: string;
  stage?: CareerStage;
}
