import type {
  InterviewEvaluation,
  InterviewSnapshot,
  InterviewReportSummary,
} from '@interviewlab/core';
import { ServiceError } from '../../foundation/errors';
import { checkedGraph } from '../interviews/graph';
import {
  createReportAnalysis,
  assertEvaluation,
  assertSummary,
  type ReportModelCall,
  type ReportAnalysis,
} from './analysis';

/** Bounded report agent. Durable task/outbox checkpoints belong to the reports service.
 * Each node makes at most one model call; scoring never receives resume material.
 */
export function createReportAgent(
  call: ReportModelCall,
  log: (entry: object) => void = () => {},
): ReportAnalysis {
  const analysis = createReportAnalysis(call, log);
  const cancelled =
    (signal: AbortSignal) =>
    (error: unknown): never => {
      if (signal.aborted) throw new ServiceError('cancelled', 502, '任务已取消', true);
      throw error;
    };
  const scoringSnapshot = (snapshot: InterviewSnapshot): InterviewSnapshot => ({
    scoring_evidence_version:
      snapshot.scoring_evidence_version ??
      (snapshot.preparation_plan?.policy?.version === 'interview-policy-v3'
        ? 'candidate-answer-v1'
        : undefined),
    interview_type: snapshot.interview_type,
    job_title: snapshot.job_title,
    preparation_plan: snapshot.preparation_plan?.role_context
      ? {
          role_context: {
            job_id: snapshot.preparation_plan.role_context.job_id,
            job_title: snapshot.preparation_plan.role_context.job_title,
            job_version: snapshot.preparation_plan.role_context.job_version,
            description: snapshot.preparation_plan.role_context.description,
            responsibilities: snapshot.preparation_plan.role_context.responsibilities,
            requirements: snapshot.preparation_plan.role_context.requirements,
            topics: snapshot.preparation_plan.role_context.topics,
            source_refs: snapshot.preparation_plan.role_context.source_refs,
            usage: 'role_requirements_not_candidate_evidence',
          },
          goals: [],
          limitations: [],
        }
      : undefined,
    knowledge: snapshot.knowledge,
    prompt_version: snapshot.prompt_version,
    rubric_version: snapshot.rubric_version,
    model: snapshot.model,
  });
  return {
    async evaluate(...args: Parameters<ReportAnalysis['evaluate']>) {
      return checkedGraph(
        'report_question',
        args,
        {
          prepare: ([turn, snapshot, signal, repair, context]) => ({
            turn,
            signal,
            repair,
            snapshot: scoringSnapshot(snapshot),
            context: context
              ? {
                  ...context,
                  earlier_turns: context.earlier_turns
                    ?.filter(
                      (t) =>
                        t.main_question_index === turn.main_question_index &&
                        t.follow_up_index < turn.follow_up_index &&
                        t.answer_status === 'answered',
                    )
                    .sort((a, b) => a.follow_up_index - b.follow_up_index),
                }
              : undefined,
          }),
          generate: (i) => analysis.evaluate(i.turn, i.snapshot, i.signal, i.repair, i.context),
          validate: (raw, i) => {
            const value = raw as InterviewEvaluation;
            assertEvaluation(value, i.turn, i.snapshot, [
              ...(i.context?.earlier_turns ?? []),
              i.turn,
            ]);
            return value;
          },
        },
        args[2],
        log,
      ).catch(cancelled(args[2]));
    },
    async summarize(...args: Parameters<ReportAnalysis['summarize']>) {
      return checkedGraph(
        'report_summary',
        args,
        {
          prepare: ([evaluations, snapshot, signal, repair, context]) => ({
            evaluations,
            snapshot: scoringSnapshot(snapshot),
            signal,
            repair,
            context,
          }),
          generate: (i) =>
            analysis.summarize(i.evaluations, i.snapshot, i.signal, i.repair, i.context),
          validate: (raw, i) => {
            const value = raw as InterviewReportSummary;
            assertSummary(
              value,
              i.evaluations,
              i.context ? { ...i.context, snapshot: i.snapshot } : undefined,
            );
            return value;
          },
        },
        args[2],
        log,
      ).catch(cancelled(args[2]));
    },
    async suggest(...args: Parameters<ReportAnalysis['suggest']>) {
      return checkedGraph(
        'report_advice',
        args,
        {
          prepare: ([evaluations, snapshot, signal, repair]) => ({
            evaluations,
            snapshot,
            signal,
            repair,
          }),
          generate: (i) => analysis.suggest(i.evaluations, i.snapshot, i.signal, i.repair),
          validate: (raw) => raw as Awaited<ReturnType<ReportAnalysis['suggest']>>,
        },
        args[2],
        log,
      ).catch(cancelled(args[2]));
    },
  };
}
