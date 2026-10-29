import type {
  LiveInterviewType,
  KnowledgeRelease,
  InterviewMemory,
  InterviewProfiles,
  InterviewRetrieval,
} from './interview-agent';
import type { DimensionKey, SessionStatus } from './domain/interview';
import type { ContentSource, KnowledgeQuestion } from './domain/knowledge';

/** Real HTTP DTOs. The synchronous demo Session remains a separate contract. */
export interface InterviewConfig {
  job: string;
  career_stage: 'internship' | 'campus';
  interview_type: LiveInterviewType;
  difficulty: '基础';
  duration_minutes: 5 | 10;
  interviewer_style: '标准' | '友好' | '深入追问';
  interaction_mode: 'text_fallback';
}
export interface InterviewKnowledge {
  agent_release?: KnowledgeRelease;
  content_version: string;
  questions: KnowledgeQuestion[];
  sources: ContentSource[];
  missing_reason: string | null;
}
export interface InterviewKnowledgeProvider {
  read(config: InterviewConfig): Promise<InterviewKnowledge>;
}
/** Framework-free port for a replaceable published knowledge runtime. */
export interface InterviewKnowledgeRuntime extends InterviewKnowledgeProvider {
  readonly enabled: boolean;
  profiles(config: Pick<InterviewConfig, 'job' | 'career_stage'>): Promise<InterviewProfiles>;
  prefetch(
    config: InterviewConfig,
    knowledge: InterviewKnowledge,
    memory?: InterviewMemory | null,
  ): void;
  context(
    config: InterviewConfig,
    knowledge: InterviewKnowledge,
    memory: InterviewMemory | null,
    answer: string,
    signal: AbortSignal,
  ): Promise<InterviewRetrieval>;
}
export interface InterviewEvidence {
  turn_id: string;
  revision: number;
  quote: string;
}
export interface InterviewQuestion {
  /** Optional on historical v1 questions. */
  stage?: 'introduction' | 'experience' | 'technical' | 'business' | 'behavioral' | 'closing';
  acknowledgement?: string;
  text: string;
  topic: string;
  purpose: string;
  knowledge_question_id: string | null;
  source_refs: string[];
  evidence_refs: InterviewEvidence[];
}
export interface InterviewTurn extends InterviewQuestion {
  id: string;
  main_question_index: number;
  follow_up_index: number;
  generation_id: string;
  presented_at: string | null;
  answer_status: 'waiting' | 'answered' | 'skipped';
  answer_text: string | null;
  revision: number;
  input_mode: 'text_fallback';
  answered_at: string | null;
}
export interface InterviewSnapshot {
  job_title: string;
  knowledge: InterviewKnowledge;
  prompt_version: string;
  rubric_version: string;
  model: string;
}
/** Observable participation feedback; never a personality or hiring judgement. */
export interface InterviewParticipation {
  level: 'reminder' | 'confirmation' | 'ended';
  reason:
    | 'repeated_non_answers'
    | 'disruptive_language'
    | 'explicit_non_participation'
    | 'candidate_stop';
  turn_id: string;
  message: string;
}
export interface Interview {
  id: string;
  version: number;
  configuration: InterviewConfig;
  status: SessionStatus;
  created_at: string;
  started_at: string | null;
  ended_at: string | null;
  end_reason: string | null;
  participation?: InterviewParticipation | null;
  job_title: string;
  plan: string[];
  turns: InterviewTurn[];
  generation_id: string | null;
  generation_status: 'idle' | 'pending' | 'ready' | 'failed';
  task_id: string | null;
  clarification: string | null;
  target_at: string | null;
  deadline_at: string | null;
  parent_interview_id: string | null;
  parent_turn_id: string | null;
  parent_revision: number | null;
  retry_goal: string | null;
}
export interface InterviewFinding {
  text: string;
  evidence_refs: InterviewEvidence[];
}
export interface InterviewEvaluation {
  turn_id: string;
  revision: number;
  strengths: InterviewFinding[];
  gaps: InterviewFinding[];
  reference_points: string[];
  retry_goal: string;
  dimensions: DimensionKey[];
  limitations: string[];
}
export interface InterviewReportSummary {
  overview: InterviewFinding;
  strengths: InterviewFinding[];
  improvements: (InterviewFinding & { turn_id: string; retry_goal: string })[];
  limitations: string[];
}
export interface ReportRequest {
  version: number;
  scope?: 'missing' | 'summary';
}
export interface InterviewReport {
  id: string;
  interview_id: string;
  version: number;
  task_ids: string[];
  status: 'pending' | 'generating' | 'ready' | 'failed';
  /** Optional for reports produced before the text review upgrade. */
  analysis_progress?: { total: number; completed: number; failed: number; pending: number };
  summary_status?:
    | 'pending'
    | 'generating'
    | 'ready'
    | 'failed'
    | 'not_applicable'
    | 'not_requested';
  summary?: InterviewReportSummary | null;
  analysis_metadata?: {
    model: string;
    prompt_version: string;
    rubric_version: string;
    schema_version: string;
    input_mode: 'text_fallback';
  };
  scoring_status: 'uncalibrated';
  overall_score: null;
  dimensions: Record<
    DimensionKey,
    {
      status: 'observed' | 'not_observed';
      score: null;
      evidence_refs: InterviewEvidence[];
      explanation: string;
    }
  >;
  evaluations: InterviewEvaluation[];
  missing_turn_ids: string[];
  is_partial: boolean;
  coverage: string;
}
export interface InterviewComparison {
  id: string;
  version: number;
  task_id: string | null;
  original_interview_id: string;
  retry_interview_id: string;
  original_turn_id: string;
  retry_turn_id: string;
  original_revision: number;
  retry_revision: number;
  original_text: string;
  retry_text: string;
  goal: string;
  question: string;
  status: 'pending' | 'generating' | 'ready' | 'failed';
  changes: InterviewFinding[];
  remaining_gaps: InterviewFinding[];
  limitations: string[];
}
export const INTERVIEW_PROMPT_VERSION = 'interview-conversation-v2';
export const INTERVIEW_RUBRIC_VERSION = 'evidence-uncalibrated-v1';
export const INTERVIEW_MAX_ANSWER = 4000;
export function interviewOpening(jobTitle: string): InterviewQuestion {
  return {
    stage: 'introduction',
    acknowledgement: `你好，欢迎参加${jobTitle}的面试。我们先认识一下，再聊聊你的经历和想法。`,
    text: '请先用一两分钟做个自我介绍，可以聊聊你的学习背景、与岗位相关的经历，以及你希望从事这个方向的原因。',
    topic: '自我介绍',
    purpose: '了解候选人背景，从当场陈述中寻找后续交流线索',
    knowledge_question_id: null,
    source_refs: [],
    evidence_refs: [],
  };
}
/** Always retain the introduction and latest answers; older excerpts have explicit bounds. */
export function interviewConversationHistory(turns: InterviewTurn[]) {
  return turns.map((turn, index) => {
    const limit = index === 0 || index >= turns.length - 3 ? INTERVIEW_MAX_ANSWER : 800;
    return {
      ...turn,
      answer_text: turn.answer_text?.slice(0, limit) ?? null,
      answer_truncated: (turn.answer_text?.length ?? 0) > limit,
    };
  });
}
export function canSuggestInterviewFinish(interview: Interview): boolean {
  return (
    interview.turns.filter((turn) => turn.answer_status === 'answered').length >= 3 ||
    !nextQuestionPosition(interview.turns, false) ||
    Boolean(interview.target_at && Date.now() >= Date.parse(interview.target_at))
  );
}
export function interviewDeadline(startedAt: string): number {
  return Date.parse(startedAt) + 720000;
}
export function nextQuestionPosition(turns: InterviewTurn[], followUp: boolean) {
  const last = turns.at(-1);
  if (!last) return { main_question_index: 1, follow_up_index: 0 };
  if (followUp && last.follow_up_index < 2 && last.answer_status === 'answered')
    return {
      main_question_index: last.main_question_index,
      follow_up_index: last.follow_up_index + 1,
    };
  if (last.main_question_index >= 6) return null;
  return { main_question_index: last.main_question_index + 1, follow_up_index: 0 };
}
export function evidenceMatches(ref: InterviewEvidence, turns: InterviewTurn[]): boolean {
  const turn = turns.find((t) => t.id === ref.turn_id && t.revision === ref.revision);
  return Boolean(
    ref.quote.trim() && turn?.answer_status === 'answered' && turn.answer_text?.includes(ref.quote),
  );
}
