import {
  evidenceMatches,
  HR_SCORING_VERSION,
  EVIDENCE_SCORING_VERSION,
  responseCanSupportScore,
  validQuestionScope,
  isQuestionScoringVersion,
  validObservedScores,
  completeSixScores,
  questionScores,
  FEEDBACK_DIMENSIONS,
  FRONTEND_RUBRIC_VERSION,
  applicableReportIndicators,
  type InterviewTurn,
  type InterviewSnapshot,
  type InterviewEvaluation,
  type InterviewReportSummary,
  type InterviewEvidence,
} from '@interviewlab/core';
import { ServiceError } from '../../../foundation/errors';
import { responseAssessmentOutput, evaluationOutput, summaryOutput } from './contracts';
export function assertScoringEvidence(
  value: InterviewEvaluation,
  turn: InterviewTurn,
  group: InterviewTurn[],
) {
  const reject = (message: string): never => {
    throw new ServiceError('invalid_model_output', 502, message);
  };
  const rows = value.response_assessments;
  const observations = value.feedback_observations;
  if (
    !rows ||
    !value.response_assessment ||
    !observations ||
    !validObservedScores(value.feedback_assessments)
  )
    reject('评分缺少回答资格或维度证据契约');
  const candidates = group.filter(
    (t) =>
      t.answer_status === 'answered' &&
      t.main_question_index === turn.main_question_index &&
      t.follow_up_index <= turn.follow_up_index,
  );
  if (
    rows!.length !== candidates.length ||
    new Set(rows!.map((r) => r.turn_id)).size !== rows!.length ||
    rows!.some(
      (r) =>
        !candidates.some((t) => t.id === r.turn_id && t.revision === r.revision) ||
        !r.question_scope ||
        !validQuestionScope(r.question_scope) ||
        (candidates.some((t) => t.id === r.turn_id && t.stage === 'introduction') &&
          r.question_scope.dimensions.some((d) => d !== 'communication')) ||
        (r.response_eligibility === 'answer' && !responseCanSupportScore(r)) ||
        (r.act === 'dont_know' &&
          (r.sufficiency !== 'not_demonstrated' || r.continuation !== 'at_limit')),
    )
  )
    reject('回答资格必须对应本题组的准确回答版本');
  const current = rows!.find((r) => r.turn_id === turn.id && r.revision === turn.revision);
  if (
    !current ||
    Object.keys(responseAssessmentOutput.shape).some(
      (k) =>
        current[k as keyof typeof responseAssessmentOutput.shape] !==
        value.response_assessment![k as keyof typeof responseAssessmentOutput.shape],
    )
  )
    reject('当前回答资格与本题组判断不一致');
  const supported = (ref: InterviewEvidence) =>
    evidenceMatches(ref, candidates) &&
    rows!.some(
      (r) => r.turn_id === ref.turn_id && r.revision === ref.revision && responseCanSupportScore(r),
    );
  if (
    observations!.length !== 6 ||
    new Set(observations!.map((o) => o.dimension)).size !== 6 ||
    FEEDBACK_DIMENSIONS.some((d) => !observations!.some((o) => o.dimension === d.key))
  )
    reject('六维必须逐项判断是否有考察及回答证据');
  for (const observation of observations!) {
    const score = value.feedback_assessments!.find((a) => a.dimension === observation.dimension);
    if ((observation.status === 'observed') !== Boolean(score))
      reject('只有已观察维度允许数字评分');
    if (observation.evidence_refs.some((ref) => !evidenceMatches(ref, candidates)))
      reject('观察依据必须来自候选人回答');
    if (score) {
      if (
        !Number.isInteger(score.score) ||
        !score.evidence_refs.length ||
        score.evidence_refs.some((ref) => !supported(ref)) ||
        score.evidence_refs.some(
          (ref) =>
            !observation.evidence_refs.some(
              (o) =>
                o.turn_id === ref.turn_id && o.revision === ref.revision && o.quote === ref.quote,
            ),
        )
      )
        reject('数字评分必须由可评价的候选人原文支持，不能引用题目或材料');
      const sources = score.evidence_refs.map(
        (ref) => rows!.find((r) => r.turn_id === ref.turn_id && r.revision === ref.revision)!,
      );
      if (
        score.dimension === 'professional_foundation' &&
        sources.some(
          (r) =>
            candidates.some((t) => t.id === r.turn_id && t.stage === 'introduction') ||
            (r.act !== 'dont_know' && r.knowledge_evidence !== 'demonstrated'),
        )
      )
        reject('专业评分需要实际知识展示，自我介绍或熟练度自我声明不能替代');
      if (sources.some((r) => !r.question_scope.dimensions.includes(score.dimension)))
        reject('评分不得扩大到实际问句没有要求的维度');
      if (sources.every((r) => r.sufficiency === 'not_demonstrated') && score.score >= 40)
        reject('明确未展示的知识不能被评为已掌握');
      if (
        sources.every((r) => r.act === 'dont_know') &&
        (score.dimension !== 'professional_foundation' ||
          !score.evidence_refs.every((ref) =>
            candidates.some(
              (t) => t.id === ref.turn_id && ['technical', 'business'].includes(t.stage ?? ''),
            ),
          ))
      )
        reject('知识题明确不会只支持对应专业观察，不能推断沟通、动机或综合素质');
    }
  }
  if (
    (!responseCanSupportScore(current!) || !current!.question_scope.dimensions.length) &&
    (value.strengths.length ||
      value.gaps.length ||
      value.reference_points.length ||
      value.dimensions.length)
  )
    reject('非作答或纯流程、行政条件回应不能生成能力优缺点');
}
export function assertEvaluation(
  value: InterviewEvaluation,
  turn: InterviewTurn,
  snapshot: InterviewSnapshot,
  group: InterviewTurn[] = [turn],
) {
  evaluationOutput.parse(value);
  if (value.question_scoring_version === EVIDENCE_SCORING_VERSION)
    assertScoringEvidence(value, turn, group);
  if (value.question_scoring_version === HR_SCORING_VERSION && snapshot.interview_type !== 'hr')
    throw new ServiceError('invalid_model_output', 502, '只有HR面允许省略未考察维度');
  if (
    isQuestionScoringVersion(value.question_scoring_version) &&
    (!([HR_SCORING_VERSION, EVIDENCE_SCORING_VERSION].includes(value.question_scoring_version ?? '')
      ? validObservedScores(value.feedback_assessments)
      : completeSixScores(value.feedback_assessments)) ||
      value.feedback_assessments!.some(
        (a) =>
          !Number.isInteger(a.score) ||
          (a.evidence_refs.length === 0 &&
            (a.score !== 0 ||
              [HR_SCORING_VERSION, EVIDENCE_SCORING_VERSION].includes(
                value.question_scoring_version ?? '',
              ))) ||
          a.evidence_refs.some((r) => !evidenceMatches(r, group)),
      ))
  )
    throw new ServiceError(
      'invalid_model_output',
      502,
      '逐题六维必须完整评分，非零分必须引用本题回答',
    );
  if (value.scoring_rubric_version) {
    const applicable = applicableReportIndicators(turn, snapshot);
    const ratings = value.indicator_assessments ?? [];
    if (
      value.scoring_rubric_version !== FRONTEND_RUBRIC_VERSION ||
      ratings.length !== applicable.length ||
      new Set(ratings.map((r) => r.indicator_id)).size !== ratings.length ||
      ratings.some(
        (r) =>
          !applicable.some((i) => i.id === r.indicator_id) ||
          r.evidence_refs.some((ref) => !evidenceMatches(ref, [turn])),
      )
    )
      throw new ServiceError('invalid_model_output', 502, '指标适用范围、档位或证据校验失败');
  } else if (value.indicator_assessments !== undefined)
    throw new ServiceError('invalid_model_output', 502, '指标评价缺少标准版本');
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
  if (
    value.dimensions.length &&
    !value.strengths.length &&
    !value.gaps.length &&
    !value.indicator_assessments?.some((a) => a.status === 'scored')
  )
    throw new ServiceError('invalid_model_output', 502, '观察维度需要回答证据');
  if (!snapshot.knowledge.questions.length && value.dimensions.includes('technical_knowledge'))
    throw new ServiceError('invalid_model_output', 502, '缺少专业评估依据');
}

const evidenceKey = (r: InterviewEvidence) => JSON.stringify([r.turn_id, r.revision, r.quote]);
/** Quotes must already support a checked per-turn finding, not merely occur somewhere in the interview. */
export function assertSummary(
  value: InterviewReportSummary,
  evaluations: InterviewEvaluation[],
  context?: { turns: InterviewTurn[]; snapshot: InterviewSnapshot },
) {
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
  const copiedAssessment =
    context &&
    questionScores(context.turns, evaluations).some((q) =>
      q.assessments.some(
        (a) =>
          a.text === value.overview.text &&
          a.evidence_refs.length === value.overview.evidence_refs.length &&
          a.evidence_refs.every(
            (ref, i) => evidenceKey(ref) === evidenceKey(value.overview.evidence_refs[i]),
          ),
      ),
    );
  if (
    (!copiedAssessment &&
      value.overview.evidence_refs.some((ref) => !allowed.has(evidenceKey(ref)))) ||
    [...value.strengths, ...value.improvements].some((f) =>
      f.evidence_refs.some((r) => !allowed.has(evidenceKey(r))),
    )
  )
    throw new ServiceError('invalid_model_output', 502, '总结引用必须来自已校验的逐题分析');
  const template = value.feedback_template;
  if (template) {
    const ratings = template.assessments;
    const scoredGroups = new Set(
      evaluations
        .filter((e) => isQuestionScoringVersion(e.question_scoring_version))
        .flatMap((e) => {
          const t = context?.turns.find((t) => t.id === e.turn_id && t.revision === e.revision);
          return t ? [t.main_question_index] : [];
        }),
    );
    const reviewedTurns = (context?.turns ?? []).filter(
      (t) =>
        t.answer_status === 'answered' &&
        (scoredGroups.has(t.main_question_index) ||
          evaluations.some((e) => e.turn_id === t.id && e.revision === t.revision)),
    );
    const validFeedbackRef = (ref: InterviewEvidence) =>
      allowed.has(evidenceKey(ref)) || evidenceMatches(ref, reviewedTurns);
    if (
      !(evaluations.some((e) =>
        [HR_SCORING_VERSION, EVIDENCE_SCORING_VERSION].includes(e.question_scoring_version ?? ''),
      )
        ? validObservedScores(ratings)
        : completeSixScores(ratings)) ||
      ratings.some((a) =>
        a.evidence_refs.length === 0
          ? a.score !== 0
          : a.evidence_refs.some((r) => !validFeedbackRef(r)),
      ) ||
      template.action_plan.some(
        (a) => !evaluations.some((e) => e.turn_id === a.turn_id && e.gaps.length),
      )
    )
      throw new ServiceError(
        'invalid_model_output',
        502,
        '模板评分需要已校验的行为证据，行动建议必须关联缺口题目',
      );
  }
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
