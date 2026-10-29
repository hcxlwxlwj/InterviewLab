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
export const REPORT_PROMPT_VERSION = 'text-review-v2';
export const REPORT_SCHEMA_VERSION = 'text-review-v2';
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
export const SCORE_ANCHORS = [
  '0：有证据表明明显偏题或关键判断错误；不能仅因缺少经历或资料判零。',
  '1：与问题相关，但题目明确要求的关键内容缺失，依据薄弱。',
  '2：基本回应核心问题，但解释、验证或组织仍有明显缺口。',
  '3：回应清楚且有具体依据，仅有次要缺口或边界说明不足。',
  '4：在本题要求范围内回应充分、依据具体、边界清楚；不要求额外商业规模。',
];
const dimensionAssessment = finding.extend({
  dimension: z.enum(['technical_knowledge', 'project_communication', 'logical_expression']),
  level: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
});
export const summaryOutput = z
  .object({
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
  const assessments = value.dimension_assessments ?? [];
  if (
    new Set(assessments.map((a) => a.dimension)).size !== assessments.length ||
    assessments.some((a) => {
      const supported = new Set(
        evaluations
          .filter((e) => e.dimensions.includes(a.dimension))
          .flatMap((e) =>
            [...e.strengths, ...e.gaps].flatMap((f) => f.evidence_refs.map(evidenceKey)),
          ),
      );
      return a.evidence_refs.some((r) => !supported.has(evidenceKey(r)));
    })
  )
    throw new ServiceError(
      'invalid_model_output',
      502,
      '维度评分必须引用对应维度的已校验证据且不能重复',
    );
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
export function createReportAnalysis(
  call: ReportModelCall,
  log: (entry: object) => void = () => {},
) {
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
              text: z.string().min(1).max(240),
              evidence_refs: z
                .array(
                  evidence.extend({
                    turn_id: z.literal(turn.id),
                    revision: z.literal(turn.revision),
                    quote: z.string().min(1).max(240),
                  }),
                )
                .min(1)
                .max(2),
            }),
          )
          .max(3),
        gaps: z
          .array(
            finding.extend({
              text: z.string().min(1).max(240),
              evidence_refs: z
                .array(
                  evidence.extend({
                    turn_id: z.literal(turn.id),
                    revision: z.literal(turn.revision),
                    quote: z.string().min(1).max(240),
                  }),
                )
                .min(1)
                .max(2),
            }),
          )
          .max(3),
        reference_points: strings.max(4),
        limitations: strings.max(3),
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
            '输出逐题证据复盘。question_context 仅帮助理解追问，不引用其他回合来冒充本题证据；只评价当前回答。自我介绍只观察表达与信息组织，不要求展开技术细节或项目验证。所有维度不输出分数。保持简洁：亮点和缺口各最多三条，每条解释及原文摘录不超过240字，引用最多两处，参考要点最多四条、局限最多三条。缺口只对应当前题明确要求，不把没有问到的重试、锁或隔离级别等列为缺陷；扩展建议必须标为可选。缺少对应观察点时不判断专业对错。优势只描述观察到的陈述，不用“诚实”“真实可信”等未核实判断；局限注明项目事实来自用户当场陈述。',
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
      const catalog = new Map<string, InterviewEvidence>();
      const indexed = evaluations.map((e, index) => {
        const encode = (items: InterviewEvaluation['strengths'], kind: string) =>
          items.map((f, j) => ({
            text: f.text,
            evidence_ids: f.evidence_refs.map((ref, k) => {
              const id = `e${index}-${kind}${j}-${k}`;
              catalog.set(id, ref);
              return id;
            }),
          }));
        return {
          turn_id: e.turn_id,
          dimensions: e.dimensions,
          strengths: encode(e.strengths, 's'),
          gaps: encode(e.gaps, 'g'),
          retry_goal: e.retry_goal,
          limitations: e.limitations,
        };
      });
      const ids = [...catalog.keys()];
      if (!ids.length)
        throw new ServiceError('insufficient_material', 409, '没有可供总结的逐题证据');
      const wireFinding = z
        .object({
          text: z.string().min(1).max(400),
          evidence_ids: z.array(z.enum(ids)).min(1).max(2),
        })
        .strict();
      const refsSchema = (allowed: string[]) =>
        z
          .array(allowed.length ? z.enum(allowed) : z.never())
          .min(1)
          .max(2);
      const strengthIds = indexed.flatMap((e) => e.strengths.flatMap((f) => f.evidence_ids));
      const improvementVariants = indexed
        .filter((e) => e.gaps.length)
        .map((e) =>
          wireFinding.extend({
            turn_id: z.literal(e.turn_id),
            evidence_ids: refsSchema(e.gaps.flatMap((g) => g.evidence_ids)),
          }),
        );
      const scoreKeys = [
        'technical_knowledge',
        'project_communication',
        'logical_expression',
      ] as const;
      const dimensionEvaluations = Object.fromEntries(
        scoreKeys.map((key) => [key, indexed.filter((e) => e.dimensions.includes(key))]),
      );
      const scoreWire = z
        .object({
          text: z.string().min(1).max(240),
          level: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
        })
        .strict();
      const scoresWire = z
        .object({
          technical_knowledge: dimensionEvaluations.technical_knowledge.length
            ? scoreWire.nullable()
            : z.null(),
          project_communication: dimensionEvaluations.project_communication.length
            ? scoreWire.nullable()
            : z.null(),
          logical_expression: dimensionEvaluations.logical_expression.length
            ? scoreWire.nullable()
            : z.null(),
        })
        .strict();
      const wireSchema = z
        .object({
          overview: wireFinding,
          strengths: z
            .array(wireFinding.extend({ evidence_ids: refsSchema(strengthIds) }))
            .max(strengthIds.length ? 3 : 0),
          improvements: z
            .array(improvementVariants.length ? z.union(improvementVariants) : z.never())
            .max(3),
          dimension_assessments: scoresWire,
          limitations: strings.max(4),
        })
        .strict();
      const output = await call(
        'summarize',
        wireSchema,
        {
          evaluations: indexed,
          evidence_catalog: Object.fromEntries(catalog),
          dimension_evaluations: dimensionEvaluations,
          scoring_rubric_version: SCORING_RUBRIC_VERSION,
          score_anchors: SCORE_ANCHORS,
          dimension_rules: {
            technical_knowledge: '原理、方案与验证推理；仅使用 dimensions 含本维度的逐题证据。',
            project_communication: '被询问的个人职责、行动与验证表达，计划不算已完成经历。',
            logical_expression: '切题、结构和论据关系，不推断语音或情绪。',
          },
          prompt_version: REPORT_PROMPT_VERSION,
          instructions:
            '输出简洁的整场复盘。只归纳已校验评价，不添加事实。每项 evidence_ids 只选择已提供的编号，不输出 quote 或 evidence_refs。优势只选 strengths 的编号，改进项只选对应 turn_id 的 gaps 编号；最多三个不同题目。dimension_assessments 必须是包含 technical_knowledge、project_communication、logical_expression 三个字段的对象。各字段只返回 {level:0到4的整数,text:简短理由} 或 null，不返回 evidence_ids。每维仅依据 dimension_evaluations 对应材料给等级，没有依据用null，程序负责关联原文。不要编造缺口或凑足数量，不推断招聘结果。每项引用最多两条，文本尽量控制在100字以内。',
        },
        signal,
        repair,
        snapshot.model,
      );
      const resolve = (f: z.infer<typeof wireFinding>) => ({
        text: f.text,
        evidence_refs: f.evidence_ids.map((id) => catalog.get(id)!),
      });
      const value: InterviewReportSummary = {
        overview: resolve(output.overview),
        strengths: output.strengths.map(resolve),
        improvements: output.improvements.map((f) => ({
          ...resolve(f),
          turn_id: f.turn_id,
          retry_goal: evaluations.find((e) => e.turn_id === f.turn_id)!.retry_goal,
        })),
        dimension_assessments: scoreKeys.flatMap((dimension) => {
          const assessed = output.dimension_assessments[dimension];
          if (!assessed) return [];
          const evidenceIds = dimensionEvaluations[dimension].flatMap((e) =>
            [...e.strengths, ...e.gaps].flatMap((f) => f.evidence_ids),
          );
          return [
            {
              dimension,
              level: assessed.level,
              text: assessed.text,
              evidence_refs: [...new Set(evidenceIds)].slice(0, 2).map((id) => catalog.get(id)!),
            },
          ];
        }),
        limitations: output.limitations,
      };
      try {
        assertSummary(value, evaluations);
      } catch (error) {
        log({
          task: 'summarize',
          code: 'report_validation_failed',
          reason: error instanceof ServiceError ? error.message : 'schema',
        });
        throw error;
      }
      return value;
    },
  };
}
export type ReportAnalysis = ReturnType<typeof createReportAnalysis>;
