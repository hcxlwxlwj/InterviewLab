import { z } from 'zod';
import {
  isQuestionScoringVersion,
  aggregateQuestionAssessments,
  questionScores,
  completeInterviewAssessments,
  FEEDBACK_TEMPLATE_VERSION,
  FEEDBACK_DIMENSIONS,
  type InterviewEvaluation,
  type InterviewSnapshot,
  type InterviewTurn,
  type InterviewEvidence,
  type InterviewReportSummary,
} from '@interviewlab/core';
import { ServiceError } from '../../../foundation/errors';
import { actionPlan, REPORT_PROMPT_VERSION, type ReportModelCall } from './contracts';
import { assertSummary } from './guardrails';

/** One completed topic needs no model call to rewrite already checked observations. */
export function reuseSingleQuestionSummary(
  evaluations: InterviewEvaluation[],
  snapshot: InterviewSnapshot,
  turns: InterviewTurn[],
): InterviewReportSummary | null {
  const questions = questionScores(turns, evaluations);
  if (questions.length !== 1) return null;
  const question = questions[0];
  const related = evaluations.filter(
    (e) =>
      question.turn_ids.includes(e.turn_id) &&
      turns.some((t) => t.id === e.turn_id && t.revision === e.revision),
  );
  if (
    evaluations.some(
      (e) =>
        !question.turn_ids.includes(e.turn_id) &&
        (e.strengths.length || e.gaps.length || e.feedback_assessments?.length),
    )
  )
    return null;
  const last = related.find((e) => e.turn_id === question.turn_ids.at(-1));
  if (!last) return null;
  const owner =
    [last, ...related.slice().reverse()].find((e) => e.strengths.length || e.gaps.length) ?? last;
  const assessment = question.assessments.find((a) => a.evidence_refs.length);
  const overview =
    owner.strengths[0] ??
    owner.gaps[0] ??
    (assessment ? { text: assessment.text, evidence_refs: assessment.evidence_refs } : undefined);
  if (!overview) return null;
  const summary: InterviewReportSummary = {
    overview,
    strengths: owner.strengths.slice(0, 3),
    improvements: owner.gaps
      .slice(0, 3)
      .map((g) => ({ ...g, turn_id: owner.turn_id, retry_goal: owner.retry_goal })),
    feedback_template: {
      version: FEEDBACK_TEMPLATE_VERSION,
      assessments: question.assessments,
      action_plan: [],
      next_expectation: owner.retry_goal,
    },
    limitations: [
      '本场仅完成一个已评分主问题及其追问；本总结直接复用该主题的已校验结果，不代表六维均已考察。',
      ...last.limitations,
    ].slice(0, 12),
  };
  assertSummary(summary, evaluations, { turns, snapshot });
  return summary;
}
export function createSummary(call: ReportModelCall, log: (entry: object) => void) {
  return async function summarize(
    evaluations: InterviewEvaluation[],
    snapshot: InterviewSnapshot,
    signal: AbortSignal,
    repair: boolean,
    context?: { turns: InterviewTurn[] },
  ): Promise<InterviewReportSummary> {
    const hasDeterministic =
      !!context && evaluations.some((e) => isQuestionScoringVersion(e.question_scoring_version));
    const observed = context
      ? aggregateQuestionAssessments(questionScores(context.turns, evaluations))
      : [];
    const deterministic =
      hasDeterministic && snapshot.interview_type !== 'hr'
        ? completeInterviewAssessments(observed)
        : observed;
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
        revision: e.revision,
        dimensions: e.dimensions,
        strengths: encode(e.strengths, 's'),
        gaps: encode(e.gaps, 'g'),
        retry_goal: e.retry_goal,
        limitations: e.limitations,
      };
    });
    // Six-dimensional review also sees original answer spans that short per-turn findings omitted.
    const reviewedTurns = (context?.turns ?? []).filter(
      (t) =>
        t.answer_status === 'answered' &&
        evaluations.some((e) => e.turn_id === t.id && e.revision === t.revision),
    );
    const feedbackCatalog = new Map(catalog);
    const professionalReferences = new Map<string, unknown>();
    const feedbackAnswers = reviewedTurns.map((turn, i) => {
      const spans = (turn.answer_text ?? '').match(/[^。！？；\n]+[。！？；]?/gu) ?? [];
      const evidenceIds: string[] = [];
      for (const sentence of spans) {
        for (let j = 0; j < sentence.length; j += 180) {
          const id = `a${i}-${evidenceIds.length}`;
          feedbackCatalog.set(id, {
            turn_id: turn.id,
            revision: turn.revision,
            quote: sentence.slice(j, j + 180),
          });
          evidenceIds.push(id);
        }
      }
      const references = snapshot.knowledge.questions.filter(
        (q) => q.id === turn.knowledge_question_id || q.topic === turn.topic,
      );
      for (const q of references)
        professionalReferences.set(q.id, {
          id: q.id,
          question: q.text,
          observation_points: q.observation_points,
          report_reference: q.report_reference,
        });
      return {
        turn_id: turn.id,
        revision: turn.revision,
        question: turn.text,
        evidence_ids: evidenceIds,
        professional_reference_ids: references.map((q) => q.id),
      };
    });
    const ids = [...catalog.keys()];
    if (!ids.length) throw new ServiceError('insufficient_material', 409, '没有可供总结的逐题证据');
    // Keep large evidence catalogs out of schema enums; only action targets use an explicit shortlist.
    // Resolution and assertSummary still check membership, ownership and revision.
    const evidenceId = z.string().min(1).max(80);
    const strengthId = evidenceId.regex(/^e\d+-s\d+-\d+$/);
    const gapId = evidenceId.regex(/^e\d+-g\d+-\d+$/);
    const wireFinding = z
      .object({
        text: z
          .string()
          .min(1)
          .max(hasDeterministic ? 120 : 400),
        evidence_ids: z.array(evidenceId).min(1).max(2),
      })
      .strict();
    const strengthIds = indexed.flatMap((e) => e.strengths.flatMap((f) => f.evidence_ids));
    const gapOwners = new Map(
      indexed.flatMap((e) =>
        e.gaps.flatMap((g) => g.evidence_ids.map((id) => [id, e.turn_id] as const)),
      ),
    );
    const turnForGapIds = (ids: string[]) => {
      const owners = ids.map((id) => gapOwners.get(id));
      if (!owners.length || !owners[0] || owners.some((owner) => owner !== owners[0]))
        throw new ServiceError('invalid_model_output', 502, '改进建议必须引用同一题的缺口编号');
      return owners[0];
    };
    const planWire = z
      .array(
        actionPlan.element
          .omit({ turn_id: true })
          .extend({
            evidence_id: gapOwners.size ? z.enum([...gapOwners.keys()]) : gapId,
          })
          .strict(),
      )
      .max(gapOwners.size ? 3 : 0);
    const wireSchema = z
      .object({
        feedback_template: z
          .object({
            version: z.literal(FEEDBACK_TEMPLATE_VERSION),
            assessments: z
              .array(
                z
                  .object({
                    dimension: z.enum(FEEDBACK_DIMENSIONS.map((d) => d.key)),
                    score: z.number().int().min(0).max(100),
                    text: z.string().min(1).max(160),
                    evidence_ids: z.array(evidenceId).max(2),
                  })
                  .strict(),
              )
              .length(6),
            action_plan: planWire,
            next_expectation: z.string().min(1).max(500),
          })
          .strict(),
        overview: wireFinding,
        strengths: z
          .array(wireFinding.extend({ evidence_ids: z.array(strengthId).min(1).max(2) }))
          .max(strengthIds.length ? 3 : 0),
        improvements: z
          .array(
            wireFinding.extend({
              evidence_ids: z.array(gapId).length(1),
              turn_id: z.string().optional(),
            }),
          )
          .max(gapOwners.size ? 3 : 0),
        limitations: z
          .array(
            z
              .string()
              .min(1)
              .max(hasDeterministic ? 120 : 1200),
          )
          .max(hasDeterministic ? 2 : 4),
      })
      .strict();
    const summarySchema = hasDeterministic
      ? wireSchema.omit({ feedback_template: true })
      : wireSchema;
    const output = await call(
      'summarize',
      summarySchema,
      {
        computed_scores: deterministic.map((a) => ({ dimension: a.dimension, score: a.score })),
        target_role: {
          job_title: snapshot.job_title,
          rubric_version: snapshot.rubric_version,
          role_context: snapshot.preparation_plan?.role_context,
        },
        feedback_answers: hasDeterministic ? undefined : feedbackAnswers,
        professional_references: hasDeterministic
          ? undefined
          : [...professionalReferences.values()],
        feedback_evidence_catalog: hasDeterministic
          ? undefined
          : Object.fromEntries([...feedbackCatalog].map(([id, ref]) => [id, ref.quote])),
        feedback_standard: hasDeterministic
          ? undefined
          : {
              version: FEEDBACK_TEMPLATE_VERSION,
              dimensions: FEEDBACK_DIMENSIONS,
              bands: ['差：[0,40)', '中：[40,70)', '良：[70,90)', '优：[90,100]'],
              instructions: hasDeterministic
                ? '评分已固定，只输出行动计划和下一步期待，不输出assessments。建议针对本场不足，不补造经历。'
                : '必须输出 feedback_template，assessments 按六维各一项。score 是本维0-100的整数百分分，由程序按25/25/25/15/5/5加权；完整回答确无可用行为依据时score=0,evidence_ids=[]，该低分按本场展示不足计入总分，text具体说明缺少什么，不代表已证实能力差；不能仅因未专门提问就判为未观察。六维评分引用feedback_evidence_catalog中的原文，不直接套用旧维度分数。专业基础直接审视原回答中技术概念的准确性、原理解释、因果关系、方案适用边界与取舍；不受旧technical_knowledge标签、题目类型或题库匹配限制。professional_references仅是辅助参考，不是评分前提；没有参考也要基于通用专业知识评价有实质技术解释的回答，注明AI判断未经专家校准。不将术语堆砌或课程清单自动视为掌握原理，不从项目陈述推断实际熟练度；项目复盘只看经历理解、职责、结果与反思；问题拆解看分析过程与取舍；表达沟通只看文字组织，不从转写推断语速、口音或紧张；岗位匹配度结合target_role，从回答体现的岗位相关知识、职责、技术选择、处理问题的方式和业务约束判断，明确目标和准备也是证据，但不要求必须讲求职动机，不推断录用结果；综合素质只看本场明确可观察的主动提问、反思与学习行动，不推断人格、情绪、抗压或长期稳定，不以沉默/不会/缺经历认定态度差。每段回答都检查六维；同一原文可支持多个维度，但每维须说明不同的行为依据。六维必须全部给分，无依据可为0分，不编造行为证据。优势和缺口尽可能兼顾约2:1，但不凑数或编造。action_plan按短期一周、中期一月、长期持续练习给可执行步骤和验收方式，evidence_id只填逐题gaps中一个编号，程序负责关联题目，不输出turn_id；没有缺口可为空。next_expectation写下次可验证的成长目标。每维理由控制在60字以内；行动计划最多三项，每项action与acceptance各不超过80字；总体印象、每条优势和缺口各不超过100字。仅引用最直接的证据，不重复输出长文。不要给录用、淘汰或真实性结论；岗位匹配度仅指本次回答体现的岗位相关能力。模板示例的五项计分存在冲突，严格以此六维评分表为准。',
            },
        evaluations: indexed,
        evidence_catalog: Object.fromEntries([...catalog].map(([id, ref]) => [id, ref.quote])),
        prompt_version: REPORT_PROMPT_VERSION,
        instructions: hasDeterministic
          ? '只输出overview、strengths、improvements、limitations。评分由程序固定，不输出评分、feedback_template或行动计划。overview与优缺点只用evidence_catalog编号；优势仅选逐题strengths编号，每条改进只选一个gaps编号，最多三题。每条文字不超过60字，limitations最多两条。只归纳已确认结论，不重新评价原回答，不补造事实、缺口或招聘结论。'
          : (hasDeterministic
              ? '六维评分已由程序固定，只生成复盘与行动计划，feedback_template中不要输出assessments，不修改computed_scores。'
              : '') +
            '输出简洁的整场复盘，必须含feedback_template六维反馈、overview、strengths、improvements、limitations，严格按schema字段返回。overview和优缺点仅使用evidence_catalog，优势只选逐题strengths编号，每条改进的evidence_ids只选一个gaps编号，不合并不同题目的编号，无需输出turn_id，程序根据证据关联题目，最多三个不同题目。六维可引用feedback_evidence_catalog，不受旧标签或是否专门提问限制。每项最多引用两条，每段不超过100字，不编造事实、缺口或招聘结论。',
      },
      signal,
      repair,
      snapshot.model,
    );
    const template =
      'feedback_template' in output
        ? (output.feedback_template as z.infer<typeof wireSchema>['feedback_template'])
        : {
            version: FEEDBACK_TEMPLATE_VERSION,
            assessments: [],
            action_plan: [],
            next_expectation: '围绕已确认的改进目标重练，并补充具体行动与验证结果。',
          };
    try {
      const resolveEvidence = (source: Map<string, InterviewEvidence>, id: string) => {
        const ref = source.get(id);
        if (!ref) throw new ServiceError('invalid_model_output', 502, '总结引用了未知证据编号');
        return ref;
      };
      const resolve = (f: z.infer<typeof wireFinding>) => ({
        text: f.text,
        evidence_refs: f.evidence_ids.map((id) => resolveEvidence(catalog, id)),
      });
      const value: InterviewReportSummary = {
        feedback_template: {
          version: FEEDBACK_TEMPLATE_VERSION,
          assessments: hasDeterministic
            ? deterministic
            : ('assessments' in template
                ? (template.assessments as z.infer<
                    typeof wireSchema
                  >['feedback_template']['assessments'])
                : []
              ).map((a) => ({
                dimension: a.dimension,
                score: a.evidence_ids.length ? a.score : 0,
                text: a.evidence_ids.length ? a.text : `证据不足，按本场展示不足计低分：${a.text}`,
                evidence_refs: a.evidence_ids.map((id) => resolveEvidence(feedbackCatalog, id)),
              })),
          action_plan: template.action_plan.map(({ evidence_id, ...plan }) => ({
            ...plan,
            turn_id: turnForGapIds([evidence_id]),
          })),
          next_expectation: template.next_expectation,
        },
        overview: resolve(output.overview),
        strengths: output.strengths.map(resolve),
        improvements: output.improvements
          .map((f) => {
            const turnId = turnForGapIds(f.evidence_ids);
            return {
              ...resolve(f),
              turn_id: turnId,
              retry_goal: evaluations.find((e) => e.turn_id === turnId)!.retry_goal,
            };
          })
          .filter((f, i, all) => all.findIndex((v) => v.turn_id === f.turn_id) === i),
        limitations: output.limitations,
      };
      assertSummary(value, evaluations, context ? { ...context, snapshot } : undefined);
      return value;
    } catch (error) {
      log({
        task: 'summarize',
        code: 'report_validation_failed',
        reason: error instanceof ServiceError ? error.message : 'schema',
      });
      throw error;
    }
  };
}
