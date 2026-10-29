import { z } from 'zod';
import {
  evidenceMatches,
  type InterviewTurn,
  type InterviewSnapshot,
  type InterviewEvaluation,
  type InterviewReportSummary,
  type InterviewEvidence,
} from '@interviewlab/core';
import { ServiceError } from '../../foundation/errors';
export const REPORT_PROMPT_VERSION = 'text-review-v1';
export const REPORT_SCHEMA_VERSION = 'text-review-v1';
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
export const summaryOutput = z
  .object({
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
export const evaluationOutput = z
  .object({
    turn_id: z.string(),
    revision: z.number().int().positive(),
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
export function assertEvaluation(
  value: InterviewEvaluation,
  turn: InterviewTurn,
  snapshot: InterviewSnapshot,
) {
  evaluationOutput.parse(value);
  if (
    value.turn_id !== turn.id ||
    value.revision !== turn.revision ||
    value.dimensions.includes('coding_ability') ||
    (turn.stage === 'introduction' && value.dimensions.some((d) => d !== 'logical_expression')) ||
    [...value.strengths, ...value.gaps].some((f) =>
      f.evidence_refs.some((ref) => !evidenceMatches(ref, [turn])),
    )
  )
    throw new ServiceError('invalid_model_output', 502, '报告回答版本或证据校验失败');
  if (value.dimensions.length && !value.strengths.length && !value.gaps.length)
    throw new ServiceError('invalid_model_output', 502, '观察维度需要回答证据');
  if (!snapshot.knowledge.questions.length && value.dimensions.includes('technical_knowledge'))
    throw new ServiceError('invalid_model_output', 502, '缺少专业评估依据');
}

const evidenceKey = (r: InterviewEvidence) => JSON.stringify([r.turn_id, r.revision, r.quote]);
/** Quotes must already support a checked per-turn finding, not merely occur somewhere in the interview. */
export function assertSummary(value: InterviewReportSummary, evaluations: InterviewEvaluation[]) {
  summaryOutput.parse(value);
  const findings = evaluations.flatMap((e) => [...e.strengths, ...e.gaps]);
  const allowed = new Set(findings.flatMap((f) => f.evidence_refs.map((r) => evidenceKey(r))));
  if (
    [value.overview, ...value.strengths, ...value.improvements].some((f) =>
      f.evidence_refs.some((r) => !allowed.has(evidenceKey(r))),
    )
  )
    throw new ServiceError('invalid_model_output', 502, '总结引用必须来自已校验的逐题分析');
  const strengths = new Set(
    evaluations.flatMap((e) =>
      e.strengths.flatMap((f) => f.evidence_refs.map((r) => evidenceKey(r))),
    ),
  );
  if (value.strengths.some((f) => f.evidence_refs.some((r) => !strengths.has(evidenceKey(r)))))
    throw new ServiceError('invalid_model_output', 502, '总结优势必须关联逐题优势证据');
  if (
    value.improvements.some((f) => {
      const e = evaluations.find((e) => e.turn_id === f.turn_id);
      const refs = new Set(e?.gaps.flatMap((g) => g.evidence_refs.map((r) => evidenceKey(r))));
      return (
        !e ||
        e.retry_goal !== f.retry_goal ||
        f.evidence_refs.some((r) => !refs.has(evidenceKey(r)))
      );
    }) ||
    new Set(value.improvements.map((f) => f.turn_id)).size !== value.improvements.length
  )
    throw new ServiceError('invalid_model_output', 502, '练习目标必须来自对应题目的缺口和原有目标');
}
export function createReportAnalysis(call: ReportModelCall) {
  return {
    async evaluate(
      turn: InterviewTurn,
      snapshot: InterviewSnapshot,
      signal: AbortSignal,
      repair: boolean,
      context?: { main_question: string; earlier_answers: { question: string; answer: string }[] },
    ) {
      const related = snapshot.knowledge.questions.filter(
        (q) => q.id === turn.knowledge_question_id || q.topic === turn.topic,
      );
      const allowedDimensions =
        turn.stage === 'introduction'
          ? (['logical_expression'] as const)
          : related.length
            ? (['technical_knowledge', 'project_communication', 'logical_expression'] as const)
            : (['project_communication', 'logical_expression'] as const);
      const schema = evaluationOutput.extend({
        turn_id: z.literal(turn.id),
        revision: z.literal(turn.revision),
        strengths: z
          .array(
            finding.extend({
              evidence_refs: z
                .array(
                  evidence.extend({
                    turn_id: z.literal(turn.id),
                    revision: z.literal(turn.revision),
                  }),
                )
                .min(1)
                .max(8),
            }),
          )
          .max(5),
        gaps: z
          .array(
            finding.extend({
              evidence_refs: z
                .array(
                  evidence.extend({
                    turn_id: z.literal(turn.id),
                    revision: z.literal(turn.revision),
                  }),
                )
                .min(1)
                .max(8),
            }),
          )
          .max(5),
        dimensions: z.array(z.enum(allowedDimensions)).max(allowedDimensions.length),
      });
      const result = await call(
        'evaluate',
        schema,
        {
          turn,
          question_context: context,
          observation_points: related,
          missing_reason: related.length
            ? snapshot.knowledge.missing_reason
            : '当前题目没有已发布的专业观察点，仅评价项目表达与逻辑表达，不观察专业知识或代码能力。',
          allowed_dimensions: allowedDimensions,
          instructions:
            '输出逐题证据复盘。question_context 仅帮助理解追问，不引用其他回合来冒充本题证据；只评价当前回答。自我介绍只观察表达与信息组织，不要求展开技术细节或项目验证。所有维度不输出分数。缺口只对应当前题明确要求，不把没有问到的重试、锁或隔离级别等列为缺陷；扩展建议必须标为可选。缺少对应观察点时不判断专业对错。优势只描述观察到的陈述，不用“诚实”“真实可信”等未核实判断；局限注明项目事实来自用户当场陈述。',
        },
        signal,
        repair,
        snapshot.model,
      );
      assertEvaluation(result, turn, {
        ...snapshot,
        knowledge: { ...snapshot.knowledge, questions: related },
      });
      return result;
    },
    async summarize(
      evaluations: InterviewEvaluation[],
      snapshot: InterviewSnapshot,
      signal: AbortSignal,
      repair: boolean,
    ): Promise<InterviewReportSummary> {
      const value = await call(
        'summarize',
        summaryOutput,
        {
          evaluations,
          prompt_version: REPORT_PROMPT_VERSION,
          instructions:
            '生成文字面试整场复盘。只归纳已校验的逐题评价，不增加事实或评价。overview、优势和改进项均须使用输入 findings 中完整原文引用对象。优势只引用 strengths，改进项只引用该题 gaps 并原样复制该题 retry_goal，最多三个不同题目的目标。没有缺口时 improvements 为空，不强行凑数。不输出分数，不推断语音表现、人格、诚实或招聘结果。资料不足的局限必须保留。',
        },
        signal,
        repair,
        snapshot.model,
      );
      assertSummary(value, evaluations);
      return value;
    },
  };
}
export type ReportAnalysis = ReturnType<typeof createReportAnalysis>;
