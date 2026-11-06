/** Contextual answer eligibility is distinct from length, correctness and participation. */
export const RESPONSE_ACTS = [
  'answer',
  'greeting',
  'acknowledgement',
  'decline_topic',
  'dont_know',
  'clarification_request',
  'off_topic',
] as const;
export const RESPONSE_ELIGIBILITY = ['answer', 'non_answer'] as const;
export const RESPONSE_RELEVANCE = ['responsive', 'partial', 'nonresponsive'] as const;
export const RESPONSE_SUFFICIENCY = [
  'sufficient',
  'needs_detail',
  'not_demonstrated',
  'not_applicable',
] as const;
export const RESPONSE_CONTINUATION = ['can_elaborate', 'at_limit', 'not_applicable'] as const;
export interface InterviewResponseAssessment {
  response_eligibility: (typeof RESPONSE_ELIGIBILITY)[number];
  act: (typeof RESPONSE_ACTS)[number];
  relevance: (typeof RESPONSE_RELEVANCE)[number];
  sufficiency: (typeof RESPONSE_SUFFICIENCY)[number];
  continuation: (typeof RESPONSE_CONTINUATION)[number];
  /** A brief auditable link to the question or a stated boundary, never hidden reasoning. */
  explanation: string;
  /** Only an answer that offers observable organization/explanation, not a closed fact alone. */
  communication_observed?: boolean;
}
