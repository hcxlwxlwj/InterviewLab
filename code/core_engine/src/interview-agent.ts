import type { InterviewType } from './domain/interview';
import type { InterviewEvidence } from './live-interview';
export type LiveInterviewType = InterviewType | 'business_scenario';
export const LIVE_TYPE_LABELS: Record<LiveInterviewType, string> = {
  technical_qa: '专业面',
  business_scenario: '业务面',
  hr: 'HR 面',
  mixed: '综合面试',
  project_deep_dive: '项目深挖',
};
export const INTERVIEW_V3 = 'interview-conversation-v3';
export interface CompetencyCard {
  id: string;
  title: string;
  evidence_wanted: string;
  probe_when: string;
  stop_when: string;
  alternative: string;
}
export interface InterviewProfile {
  id: string;
  version: string;
  type: LiveInterviewType;
  label: string;
  goals: string[];
}
export interface KnowledgeChunk {
  id: string;
  card_id: string;
  release: string;
  text: string;
  source_refs: string[];
  goals: string[];
  types: LiveInterviewType[];
}
export interface KnowledgeRelease {
  id: string;
  embedding_model: string;
  dimensions: number;
  profile: InterviewProfile;
  competencies: CompetencyCard[];
}
export interface InterviewExperienceGrounding {
  description: InterviewEvidence | null;
  personal_role: InterviewEvidence | null;
}
export type InterviewReplyAct =
  | 'answer'
  | 'greeting'
  | 'acknowledgement'
  | 'decline_topic'
  | 'dont_know';
export type InterviewTopic =
  | 'personal_background'
  | 'motivation'
  | 'project'
  | 'learning_experience'
  | 'technical'
  | 'business'
  | 'collaboration'
  | 'other';
export interface InterviewTopicBoundary {
  topic: InterviewTopic;
  scope: 'topic' | 'question';
  question_id: string;
  question: string;
  evidence_ref: InterviewEvidence;
}
export interface InterviewConversationState {
  last_act: InterviewReplyAct;
  boundaries: InterviewTopicBoundary[];
}
export interface InterviewMemory {
  conversation?: InterviewConversationState;
  experience?: InterviewExperienceGrounding;
  version: number;
  focus: string | null;
  observations: {
    goal: string;
    state: 'needs_probe' | 'covered' | 'inconclusive' | 'not_applicable';
    evidence_refs: InterviewEvidence[];
    pending: string | null;
  }[];
  claims: { text: string; evidence_refs: InterviewEvidence[] }[];
  asked_intents: string[];
}
export interface InterviewMemoryDelta {
  focus: string;
  intent: string;
  observations: InterviewMemory['observations'];
  claims: InterviewMemory['claims'];
}
export interface InterviewRetrieval {
  release: string;
  chunks: KnowledgeChunk[];
  missing_reason: string | null;
  mode: 'prefetched' | 'supplemental' | 'empty';
}
export interface InterviewPreview {
  acknowledgement: string;
  text: string;
}
export interface InterviewProfiles {
  version: string;
  default_type: LiveInterviewType;
  profiles: InterviewProfile[];
}
