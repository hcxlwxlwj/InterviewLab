import { z } from 'zod';
import {
  FEEDBACK_ANALYSIS_VERSION,
  FEEDBACK_DIMENSIONS,
  FEEDBACK_TEMPLATE_VERSION,
  RESPONSE_ELIGIBILITY,
  RESPONSE_ACTS,
  RESPONSE_RELEVANCE,
  RESPONSE_SUFFICIENCY,
  RESPONSE_CONTINUATION,
  QUESTION_SCOPE_KINDS,
  REPORT_INDICATORS,
  type InterviewReportSummary,
} from '@interviewlab/core';
export const REPORT_PROMPT_VERSION = FEEDBACK_ANALYSIS_VERSION;
export const REPORT_SCHEMA_VERSION = 'text-review-v3';
const evidence = z
  .object({
    turn_id: z.string(),
    revision: z.number().int().positive(),
    quote: z.string().min(1).max(1500),
  })
  .strict();
const finding = z
  .object({ text: z.string().min(1).max(1200), evidence_refs: z.array(evidence).min(1).max(8) })
  .strict();
const strings = z.array(z.string().min(1).max(1200)).max(12);
export const SCORING_RUBRIC_VERSION = 'text-evidence-levels-v1';
const dimensionAssessment = finding.extend({
  dimension: z.enum(['technical_knowledge', 'project_communication', 'logical_expression']),
  level: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
});
export const feedbackAssessment = z
  .object({
    dimension: z.enum(FEEDBACK_DIMENSIONS.map((d) => d.key)),
    score: z.number().min(0).max(100),
    text: z.string().min(1).max(400),
    evidence_refs: z.array(evidence).max(2),
  })
  .strict();
export const responseAssessmentOutput = z
  .object({
    response_eligibility: z.enum(RESPONSE_ELIGIBILITY),
    act: z.enum(RESPONSE_ACTS),
    relevance: z.enum(RESPONSE_RELEVANCE),
    sufficiency: z.enum(RESPONSE_SUFFICIENCY),
    continuation: z.enum(RESPONSE_CONTINUATION),
    explanation: z.string().min(1).max(180),
  })
  .strict();
export const questionScopeOutput = z
  .object({
    kind: z.enum(QUESTION_SCOPE_KINDS),
    dimensions: z.array(z.enum(FEEDBACK_DIMENSIONS.map((d) => d.key))).max(6),
    expectation: z.string().min(1).max(180),
  })
  .strict();
export const scoringResponseOutput = responseAssessmentOutput.extend({
  question_scope: questionScopeOutput,
  knowledge_evidence: z.enum(['demonstrated', 'claim_only', 'not_present', 'unclear']).optional(),
});
export const assessedResponseOutput = scoringResponseOutput.extend({
  turn_id: z.string(),
  revision: z.number().int().positive(),
});
export const feedbackObservationOutput = z
  .object({
    dimension: z.enum(FEEDBACK_DIMENSIONS.map((d) => d.key)),
    status: z.enum(['observed', 'not_observed', 'insufficient_evidence']),
    text: z.string().min(1).max(400),
    evidence_refs: z.array(evidence).max(2),
  })
  .strict();
export const actionPlan = z
  .array(
    z
      .object({
        horizon: z.enum(['short_term', 'medium_term', 'long_term']),
        turn_id: z.string(),
        action: z.string().min(1).max(500),
        acceptance: z.string().min(1).max(500),
      })
      .strict(),
  )
  .max(6);
export const feedbackTemplateOutput = z
  .object({
    version: z.literal(FEEDBACK_TEMPLATE_VERSION),
    assessments: z.array(feedbackAssessment).max(6),
    action_plan: actionPlan,
    next_expectation: z.string().min(1).max(500),
  })
  .strict();
export const summaryOutput = z
  .object({
    next_steps: strings.optional(),
    advice_status: z.enum(['ready', 'failed']).optional(),
    feedback_template: feedbackTemplateOutput,
    dimension_assessments: z.array(dimensionAssessment).max(3).optional(),
    overview: finding,
    strengths: z.array(finding).max(3),
    improvements: z
      .array(finding.extend({ turn_id: z.string(), retry_goal: z.string().min(1).max(500) }))
      .max(3),
    limitations: strings,
  })
  .strict() satisfies z.ZodType<InterviewReportSummary>;
export type ReportModelCall = <T>(
  kind: string,
  schema: z.ZodType<T>,
  input: unknown,
  signal: AbortSignal,
  repair: boolean,
  model?: string,
) => Promise<T>;
export const indicatorAssessmentOutput = z.discriminatedUnion('status', [
  z
    .object({
      indicator_id: z.enum(REPORT_INDICATORS.map((i) => i.id)),
      status: z.literal('scored'),
      level: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
      text: z.string().min(1).max(400),
      evidence_refs: z.array(evidence).min(1).max(2),
    })
    .strict(),
  z
    .object({
      indicator_id: z.enum(REPORT_INDICATORS.map((i) => i.id)),
      status: z.literal('not_observed'),
      level: z.null(),
      text: z.string().min(1).max(400),
      evidence_refs: z.array(evidence).max(0),
    })
    .strict(),
]);
export const evaluationOutput = z
  .object({
    response_assessment: responseAssessmentOutput.optional(),
    response_assessments: z.array(assessedResponseOutput).max(3).optional(),
    feedback_observations: z.array(feedbackObservationOutput).length(6).optional(),
    feedback_assessments: z.array(feedbackAssessment).max(6).optional(),
    question_scoring_version: z.string().optional(),
    next_steps: strings.optional(),
    advice_status: z.enum(['ready', 'failed']).optional(),
    turn_id: z.string(),
    revision: z.number().int().positive(),
    scoring_rubric_version: z.string().optional(),
    indicator_assessments: z.array(indicatorAssessmentOutput).max(6).optional(),
    strengths: z.array(finding).max(5),
    gaps: z.array(finding).max(5),
    reference_points: strings,
    retry_goal: z.string().min(1).max(500),
    dimensions: z
      .array(
        z.enum([
          'technical_knowledge',
          'project_communication',
          'coding_ability',
          'logical_expression',
        ]),
      )
      .max(4),
    limitations: strings,
  })
  .strict();
