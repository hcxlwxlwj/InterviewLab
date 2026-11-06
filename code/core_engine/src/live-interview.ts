import type {
  LiveInterviewType,
  KnowledgeRelease,
  InterviewMemory,
  InterviewProfiles,
  InterviewRetrieval,
} from './interview-agent';
import type { DimensionKey, SessionStatus } from './domain/interview';
import type { ContentSource, KnowledgeQuestion } from './domain/knowledge';

/** Shared DTOs for the HTTP interview workflow. */
export interface InterviewConfig {
  resume_ref?: { id: string; version: number };
  job: string;
  career_stage: 'internship' | 'campus';
  interview_type: LiveInterviewType;
  difficulty: '基础';
  /** Five minutes is retained only for reading historical sessions. */
  duration_minutes: 5 | 10 | 20 | 30;
  interviewer_style: '标准' | '友好' | '深入追问';
  interaction_mode: 'text_fallback' | 'realtime_voice' | 'realtime_video';
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
  input_mode: 'text_fallback' | 'voice';
  answered_at: string | null;
}
export interface InterviewSnapshot {
  scoring_evidence_version?: 'candidate-answer-v1';
  interview_type?: LiveInterviewType;
  runtime_version?: 'graph-v1';
  resume_analysis?: import('./agent-workflow').ResumeAnalysis;
  preparation_plan?: import('./agent-workflow').InterviewPreparationPlan;
  personal_material?: import('./personal').PersonalMaterial;
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
  preparation?: import('./agent-workflow').PreparationStatus;
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
  response_assessment?: import('./interview-response').InterviewResponseAssessment;
  response_assessments?: import('./question-scoring').AssessedResponse[];
  feedback_observations?: import('./feedback-template').FeedbackObservation[];
  /** Cumulative six-dimensional score for this main question through this answer. */
  feedback_assessments?: import('./feedback-template').FeedbackAssessment[];
  question_scoring_version?: string;
  next_steps?: string[];
  advice_status?: 'ready' | 'failed';
  scoring_rubric_version?: string;
  indicator_assessments?: import('./report-rubric').ReportIndicatorAssessment[];
  turn_id: string;
  revision: number;
  strengths: InterviewFinding[];
  gaps: InterviewFinding[];
  reference_points: string[];
  retry_goal: string;
  dimensions: DimensionKey[];
  limitations: string[];
}
export interface InterviewDimensionAssessment extends InterviewFinding {
  dimension: Exclude<DimensionKey, 'coding_ability'>;
  level: 0 | 1 | 2 | 3 | 4;
}
export interface InterviewReportSummary {
  next_steps?: string[];
  advice_status?: 'ready' | 'failed';
  feedback_template: import('./feedback-template').FeedbackTemplate;
  /** Auxiliary per-turn scoring; levels are AI estimates, not calibrated scores. */
  dimension_assessments?: InterviewDimensionAssessment[];
  overview: InterviewFinding;
  strengths: InterviewFinding[];
  improvements: (InterviewFinding & { turn_id: string; retry_goal: string })[];
  limitations: string[];
}
export interface ReportRequest {
  version: number;
  scope?: 'missing' | 'summary' | 'advice';
}
export interface InterviewReport {
  feedback_observations?: import('./feedback-template').FeedbackObservation[];
  advice_task_id?: string;
  advice_status?: 'pending' | 'ready' | 'failed';
  next_steps?: string[];
  question_scoring_version?: string;
  question_scores?: import('./question-scoring').QuestionScore[];
  feedback_assessments?: import('./feedback-template').FeedbackAssessment[];
  practice_history?: {
    interview_id: string;
    original_turn_id: string;
    ended_at: string | null;
    scoring_version: string | null;
    score: number | null;
    assessments: import('./feedback-template').FeedbackAssessment[];
    status: 'pending' | 'generating' | 'ready' | 'failed';
  }[];
  /** Latest completed retries used by this report; original interviews are immutable. */
  answer_sources?: { original_turn_id: string; retry_interview_id: string; turn: InterviewTurn }[];
  needs_refresh?: boolean;
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
    scoring_rubric_version?: string;
    input_mode: 'text_fallback';
  };
  scoring_status: 'uncalibrated' | 'experimental';
  overall_score: number | null;
  dimensions: Record<
    DimensionKey,
    {
      status: 'observed' | 'not_observed';
      score: number | null;
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
export function interviewOpening(jobTitle: string, config?: InterviewConfig): InterviewQuestion {
  return {
    stage: 'introduction',
    acknowledgement: `你好，欢迎参加${jobTitle}的面试。我们先认识一下，再聊聊你的经历和想法。`,
    text: config
      ? `请用${config.duration_minutes === 5 ? '半分钟' : '一分钟'}做个自我介绍，简要聊聊${config.interview_type === 'hr' ? '你的求职方向和相关经历' : '你的学习背景和与目标岗位相关的经历'}。`
      : '请先用一两分钟做个自我介绍，可以聊聊你的学习背景、与岗位相关的经历，以及你希望从事这个方向的原因。',
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
    !nextQuestionPosition(interview.turns, false, interview.configuration.duration_minutes) ||
    Boolean(interview.target_at && Date.now() >= Date.parse(interview.target_at))
  );
}
export const INTERVIEW_DURATIONS = [10, 20, 30] as const;
export function mainQuestionLimit(durationMinutes = 10): number {
  return durationMinutes <= 10 ? 6 : durationMinutes <= 20 ? 10 : 14;
}
export function interviewDeadline(startedAt: string, durationMinutes = 10): number {
  return Date.parse(startedAt) + (Math.max(10, durationMinutes) + 2) * 60000;
}
export function nextQuestionPosition(
  turns: InterviewTurn[],
  followUp: boolean,
  durationMinutes = 10,
) {
  const last = turns.at(-1);
  if (!last) return { main_question_index: 1, follow_up_index: 0 };
  if (followUp && last.follow_up_index < 2 && last.answer_status === 'answered')
    return {
      main_question_index: last.main_question_index,
      follow_up_index: last.follow_up_index + 1,
    };
  if (last.main_question_index >= mainQuestionLimit(durationMinutes)) return null;
  return { main_question_index: last.main_question_index + 1, follow_up_index: 0 };
}
export function evidenceMatches(ref: InterviewEvidence, turns: InterviewTurn[]): boolean {
  const turn = turns.find((t) => t.id === ref.turn_id && t.revision === ref.revision);
  return Boolean(
    ref.quote.trim() && turn?.answer_status === 'answered' && turn.answer_text?.includes(ref.quote),
  );
}

/** Route choice persists with the saved interaction mode. */
export function liveInterviewPath(interview: Pick<Interview, 'id' | 'configuration'>) {
  return `/interview/${interview.id}${interview.configuration.interaction_mode === 'realtime_video' ? '/video' : ''}`;
}
