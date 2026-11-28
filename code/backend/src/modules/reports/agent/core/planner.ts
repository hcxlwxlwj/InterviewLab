/** 报告规则规划：拆为逐题评价、整场总结和练习建议，分别准备有界任务的输入。 */
import type { InterviewSnapshot } from '@interviewlab/core';
import type { ReportAnalysis } from './tools';

export const REPORT_PLAN = {
  evaluate: { workflow: 'report_question', tool: 'evaluate_answer' },
  summarize: { workflow: 'report_summary', tool: 'summarize_report' },
  suggest: { workflow: 'report_advice', tool: 'suggest_practice' },
} as const;

export const scoringSnapshot = (snapshot: InterviewSnapshot): InterviewSnapshot => ({
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

export function planEvaluation([turn, snapshot, signal, repair, context]: Parameters<
  ReportAnalysis['evaluate']
>) {
  return {
    turn,
    snapshot: scoringSnapshot(snapshot),
    signal,
    repair,
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
  };
}

export function planSummary([evaluations, snapshot, signal, repair, context]: Parameters<
  ReportAnalysis['summarize']
>) {
  return { evaluations, snapshot: scoringSnapshot(snapshot), signal, repair, context };
}

export function planAdvice([evaluations, snapshot, signal, repair]: Parameters<
  ReportAnalysis['suggest']
>) {
  // 练习建议可以使用已确认简历背景；评分和总结只使用上方隔离后的评分视图。
  return { evaluations, snapshot, signal, repair };
}
