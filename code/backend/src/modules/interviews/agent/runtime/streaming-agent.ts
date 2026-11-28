import { z } from 'zod';
import { prepareAdvancePlan } from '../planner/planning';
import { buildAdvanceMessages } from './prompt';
import { assertPreview } from '../guardrails/preview';
export { assertPreview } from '../guardrails/preview';
import {
  mainQuestionLimit,
  interviewDurationMinutes,
  type InterviewResponseAssessment,
  FEEDBACK_INTERVIEW_GOALS,
  FEEDBACK_DIMENSIONS,
  evidenceMatches,
  type InterviewMemory,
  type InterviewPreview,
  type InterviewRetrieval,
} from '@interviewlab/core';
import type { BackendConfig } from '../../../../foundation/config';
import { ServiceError } from '../../../../foundation/errors';
import type { InterviewTurnAgent } from './types';
import { assertQuestion } from '../guardrails/question';
import { applyMemory } from '../memory/memory';
import { assertExperienceQuestion, preparingBackground, knowledgeReady } from '../../experience';
import { jsonFields, readChatStream } from '../../stream-parser';
import { assertPolicyQuestion, assertQuestionIntent } from '../guardrails/question-policy';
import { assertConversationQuestion } from '../../conversation';
import {
  streamResponseStateSchema,
  streamResponseAssessment,
  assertResponseAssessment,
  responseObservation,
  needsIntroduction,
} from '../../response-assessment';
export interface AdvanceContext {
  queued_ms?: number;
  retrieval_ms?: number;
  memory: InterviewMemory | null;
  retrieval: InterviewRetrieval;
  preview: (value: InterviewPreview) => Promise<void>;
}
const GOAL_CONTRACTS: Record<string, { kind: string; boundary: string }> = {
  understanding: {
    kind: 'explanation',
    boundary: '考一个岗位相关知识或适用边界；熟练度声明不是知识展示。',
  },
  verification: {
    kind: 'explanation',
    boundary: '问检查结果、边界输入或定位问题的方法；仅说明测试步骤不自动等于方案取舍。',
  },
  contribution: {
    kind: 'experience_detail',
    boundary: '问本人实际职责或行动；项目名称和团队成果不证明个人参与。',
  },
  tradeoffs: {
    kind: 'decision_process',
    boundary:
      '围绕一次选择问约束、备选或选择依据；仅问如何验证边界输入属于verification，不能充作取舍题。',
  },
  business: {
    kind: 'decision_process',
    boundary: '围绕岗位任务问目标、优先级或判断依据；不预设收入指标或本人未参与的决策。',
  },
  collaboration: {
    kind: 'reflection',
    boundary: '问与他人协调的具体行动；个人完成实现不自动证明协作。',
  },
  learning: {
    kind: 'reflection',
    boundary:
      '问主动学习或收到反馈后的实际调整，要有新认识或调整前后变化；仅问如何确认符合预期或测试步骤属于verification，不能充作反思题。',
  },
  motivation: {
    kind: 'motivation',
    boundary: '问岗位任务理解、选择依据或实际准备；仅说求职方向不自动证明岗位匹配。',
  },
  availability: {
    kind: 'administrative',
    boundary: '只记录实际求职安排，不按时间早晚或时长评价能力。',
  },
  expectations: {
    kind: 'administrative',
    boundary: '只了解求职期望，不评价薪资高低，不编造待遇。',
  },
};
export type AdvancePlan = ReturnType<typeof prepareAdvancePlan>;
type Control = {
  a: 'f' | 'n' | 'e' | 'c';
  g: number;
  e: number | null;
  response?: InterviewResponseAssessment;
  v?: number[];
  o?: number;
};
function allowAdvanceFollowUp(plan: AdvancePlan) {
  const { last, modern, pacing, semantic, context, grounding } = plan;
  return (
    last.follow_up_index < 2 &&
    (!modern ||
      pacing.allow_follow_up ||
      (semantic && last.stage === 'introduction' && !context.memory?.introduction_complete)) &&
    last.answer_status === 'answered' &&
    grounding.conversation.last_act !== 'decline_topic'
  );
}

function advanceActionOptions(plan: AdvancePlan, clarify: boolean) {
  return clarify
    ? (['c'] as const)
    : allowAdvanceFollowUp(plan)
      ? (['f', 'n', ...(plan.canFinish ? ['e' as const] : [])] as const)
      : (['n', ...(plan.canFinish ? ['e' as const] : [])] as const);
}

function reserveNextGoalOpportunity(
  plan: AdvancePlan,
  remainingMain: number,
  missingCount: number,
) {
  const { semantic, isHR, pacing, policy, grounding } = plan;
  return (
    semantic &&
    !isHR &&
    pacing.remaining_seconds > policy.closing_seconds &&
    grounding.next_step !== 'introduction' &&
    remainingMain > 0 &&
    remainingMain <= missingCount
  );
}

function advanceGoalIndices(plan: AdvancePlan) {
  const { interview, last, goalOptions, context, missingFeedback, release } = plan;
  const remainingMain =
    mainQuestionLimit(interviewDurationMinutes(interview)) - last.main_question_index;
  const allGoalIndices = goalOptions.map((_, index) => index);
  const currentGoal = context.memory?.focus;
  const missingNext = missingFeedback.filter((dimension) => dimension.key !== 'communication');
  const priorityIndices = allGoalIndices.filter((index) =>
    missingNext.some((dimension) =>
      (FEEDBACK_INTERVIEW_GOALS[dimension.key] as readonly string[]).includes(goalOptions[index]),
    ),
  );
  const currentOpportunity = missingNext.filter((dimension) =>
    (FEEDBACK_INTERVIEW_GOALS[dimension.key] as readonly string[]).includes(currentGoal ?? ''),
  );
  // Reserve other opportunities when moving on; only v can establish actual coverage.
  const otherOpportunityIndices = priorityIndices.filter(
    (index) =>
      !currentOpportunity.some((dimension) =>
        (FEEDBACK_INTERVIEW_GOALS[dimension.key] as readonly string[]).includes(goalOptions[index]),
      ),
  );
  const nextGoalIndices =
    reserveNextGoalOpportunity(plan, remainingMain, missingNext.length) && priorityIndices.length
      ? otherOpportunityIndices.length
        ? otherOpportunityIndices
        : priorityIndices
      : allGoalIndices;
  const currentIndex = currentGoal ? goalOptions.indexOf(currentGoal) : -1;
  const followUpGoalIndices = currentIndex >= 0 ? [currentIndex] : allGoalIndices;
  const observableGoals = [
    ...goalOptions,
    ...release.profile.goals.filter((goal) => !goalOptions.includes(goal)),
  ];
  return {
    remainingMain,
    allGoalIndices,
    currentGoal,
    missingNext,
    currentOpportunity,
    nextGoalIndices,
    followUpGoalIndices,
    observableGoals,
  };
}

function advanceGoalContracts(plan: AdvancePlan, observableGoals: string[]) {
  const { release, policy, isHR, interview } = plan;
  return observableGoals.map((goal, index) => {
    const card = release.competencies.find((candidate) => candidate.id === goal)!;
    const theme = policy.themes.find((candidate) => candidate.goal === goal);
    const typeBoundary = isHR
      ? '本轮只了解求职安排或具体行为，项目仅作行为背景，不考察技术实现。'
      : interview.configuration.interview_type === 'business_scenario'
        ? '本轮从岗位任务的目标、需求、约束、本人行动与结果了解本目标；即使是开发岗位，也不追问代码、配置或具体实现。'
        : '';
    return {
      index,
      goal,
      target_dimensions: FEEDBACK_DIMENSIONS.filter((dimension) =>
        (FEEDBACK_INTERVIEW_GOALS[dimension.key] as readonly string[]).includes(goal),
      ).map((dimension) => dimension.key),
      question_kind: GOAL_CONTRACTS[goal].kind,
      evidence_wanted: theme ? `${theme.purpose}；${theme.probe}` : card.evidence_wanted,
      boundary: GOAL_CONTRACTS[goal].boundary + typeBoundary,
    };
  });
}

function advanceReferenceSchemas(plan: AdvancePlan) {
  const { anchors, snapshot, sourceOptions } = plan;
  const maxAnchor = Math.max(0, anchors.length - 1),
    maxSource = Math.max(0, sourceOptions.length - 1);
  const evidenceIndex = anchors.length
    ? z.number().int().min(0).max(maxAnchor).nullable()
    : z.null();
  const resumeFacts =
    snapshot.runtime_version === 'graph-v1' ? (snapshot.resume_analysis?.facts ?? []) : [];
  const materialIndicesSchema = z
    .array(
      z
        .number()
        .int()
        .min(0)
        .max(Math.max(0, resumeFacts.length - 1)),
    )
    .max(resumeFacts.length ? 3 : 0);
  const sourceIndicesSchema = z
    .array(z.number().int().min(0).max(maxSource))
    .max(sourceOptions.length ? 2 : 0);
  return { evidenceIndex, resumeFacts, materialIndicesSchema, sourceIndicesSchema };
}

function createAdvanceSchemas(plan: AdvancePlan, clarify: boolean) {
  const { semantic, modern, snapshot, sourceOptions } = plan;
  const actions = advanceActionOptions(plan, clarify);
  const actionNames = { f: 'follow_up', n: 'next', e: 'finish', c: 'clarify' } as const;
  const states = ['needs_probe', 'covered', 'inconclusive', 'not_applicable'] as const;
  const {
    remainingMain,
    allGoalIndices,
    currentGoal,
    missingNext,
    currentOpportunity,
    nextGoalIndices,
    followUpGoalIndices,
    observableGoals,
  } = advanceGoalIndices(plan);
  const goalContracts = advanceGoalContracts(plan, observableGoals);
  const { evidenceIndex, resumeFacts, materialIndicesSchema, sourceIndicesSchema } =
    advanceReferenceSchemas(plan);
  const indexSchema = (indices: number[]) => z.union(indices.map((index) => z.literal(index)));
  const decisionBranch = (action: (typeof actions)[number]) =>
    z
      .object({
        a: z.literal(action),
        g: indexSchema(
          action === 'n' ? nextGoalIndices : action === 'f' ? followUpGoalIndices : allGoalIndices,
        ),
      })
      .strict();
  const decisionSchema = z.union([
    decisionBranch(actions[0]),
    ...actions.slice(1).map(decisionBranch),
  ]);
  const head = semantic
    ? z.object({
        h: streamResponseStateSchema,
        v: z
          .array(
            z
              .number()
              .int()
              .min(0)
              .max(observableGoals.length - 1),
          )
          .max(2),
        decision: decisionSchema,
        e: evidenceIndex,
        ...(resumeFacts.length ? { r: materialIndicesSchema } : {}),
        ...(sourceOptions.length ? { s: sourceIndicesSchema } : {}),
      })
    : z.object({
        a: z.enum(actions),
        g: indexSchema(allGoalIndices),
        e: evidenceIndex,
        o: z.number().int().min(0).max(3),
      });
  const controlOf = (value: z.infer<typeof head>): Control =>
    'decision' in value
      ? {
          ...value.decision,
          e: value.e,
          v: value.v,
          response: streamResponseAssessment(value.h),
        }
      : value;
  const schema = head
    .extend({
      q: z.string().max(modern ? 100 : 80),
      ...(!semantic && snapshot.runtime_version === 'graph-v1'
        ? {
            r: materialIndicesSchema,
          }
        : {}),
      ...(modern
        ? {
            d: z.enum([
              'probe_gap',
              'clarify_once',
              'sufficient',
              'limit_reached',
              'no_new_information',
              'type_priority',
              'time_budget',
            ]),
            b: semantic ? z.literal('') : z.string().max(30),
          }
        : {}),
      ...(!semantic ? { s: sourceIndicesSchema } : {}),
    })
    .strict();
  return {
    actionNames,
    states,
    remainingMain,
    allGoalIndices,
    currentGoal,
    missingNext,
    currentOpportunity,
    nextGoalIndices,
    followUpGoalIndices,
    observableGoals,
    goalContracts,
    head,
    controlOf,
    materialIndicesSchema,
    sourceIndicesSchema,
    resumeFacts,
    schema,
  };
}
export type AdvanceSchemas = ReturnType<typeof createAdvanceSchemas>;

function createAdvanceChecks(plan: AdvancePlan, output: AdvanceSchemas) {
  const {
    interview,
    snapshot,
    context,
    semantic,
    modern,
    isHR,
    grounding,
    policy,
    pacing,
    anchors,
    goalOptions,
    last,
    sourceOptions,
  } = plan;
  const {
    states,
    observableGoals,
    missingNext,
    remainingMain,
    materialIndicesSchema,
    sourceIndicesSchema,
    resumeFacts,
  } = output;
  const assessed = (control: Control): InterviewResponseAssessment | undefined => control.response;
  const statusFor = (control: Control) => {
    const response = assessed(control);
    return response ? responseObservation(response) : states[control.o ?? 0];
  };
  const observedGoalsFor = (control: Control) => {
    if (!semantic) return [context.memory?.focus ?? 'contribution'];
    const indices = control.v ?? [];
    if (new Set(indices).size !== indices.length)
      throw new ServiceError('invalid_model_output', 502, '实际观察目标重复');
    const response = assessed(control);
    if (
      indices.length &&
      (response?.response_eligibility !== 'answer' ||
        control.e === null ||
        last.stage === 'introduction')
    )
      throw new ServiceError('invalid_model_output', 502, '未作答或自我介绍不能填充能力目标');
    return indices.map((index) => observableGoals[index]);
  };
  const recoveringIntroduction = (control: Control) => {
    const response = assessed(control);
    return response
      ? needsIntroduction(response, interview, context.memory)
      : grounding.next_step === 'introduction';
  };
  const groundingFor = (control: Control) => {
    if (recoveringIntroduction(control))
      return { ...grounding, next_step: 'introduction' as const, discovery_required: false };
    if (
      semantic &&
      goalOptions[control.g] !== 'contribution' &&
      grounding.next_step === 'project_discovery'
    )
      return { ...grounding, next_step: 'interview' as const, discovery_required: false };
    return grounding;
  };
  const check = (control: Control) => {
    const response = assessed(control);
    const observedGoals = observedGoalsFor(control);
    if (response) {
      assertResponseAssessment(response, last.answer_text);
      if (response.response_eligibility === 'non_answer' && control.e !== null)
        throw new ServiceError('invalid_model_output', 502, '未作答不产生回答证据');
      if (
        response.response_eligibility === 'answer' &&
        last.answer_status === 'answered' &&
        control.e === null
      )
        throw new ServiceError('invalid_model_output', 502, '有效回答需关联当前原文');
      if (
        control.a === 'f' &&
        (response.continuation === 'at_limit' ||
          (response.response_eligibility === 'answer' && response.sufficiency !== 'needs_detail'))
      )
        throw new ServiceError('invalid_model_output', 502, '当前内容已充分或已到回答边界，应转场');
    }
    if (
      control.e !== null &&
      (!anchors[control.e] || !evidenceMatches(anchors[control.e], interview.turns))
    )
      throw new ServiceError('invalid_model_output', 502, '引用下标无效');
    if (modern && !semantic && control.a === 'f' && 'o' in control && control.o !== 0)
      throw new ServiceError('invalid_model_output', 502, '当前话题已收束，应转场');
    if (
      control.a === 'f' &&
      (!response || response.response_eligibility === 'answer') &&
      (control.e === null || anchors[control.e]?.turn_id !== last.id)
    )
      throw new ServiceError('invalid_model_output', 502, '追问没有当前回答依据');
    const afterObserved = missingNext.filter(
      (dimension) =>
        !(
          ['covered', 'inconclusive'].includes(statusFor(control)) &&
          observedGoals.some((goal) =>
            (FEEDBACK_INTERVIEW_GOALS[dimension.key] as readonly string[]).includes(goal),
          )
        ),
    );
    if (
      semantic &&
      !isHR &&
      control.a === 'n' &&
      !recoveringIntroduction(control) &&
      pacing.remaining_seconds > policy.closing_seconds &&
      remainingMain > 0 &&
      remainingMain <= afterObserved.length &&
      !afterObserved.some((dimension) =>
        (FEEDBACK_INTERVIEW_GOALS[dimension.key] as readonly string[]).includes(
          goalOptions[control.g],
        ),
      )
    )
      throw new ServiceError('invalid_model_output', 502, '剩余题量应留给实际尚缺的考察维度');
  };
  const referencesFor = (fields: { r?: unknown; s?: unknown }) => {
    const materials = materialIndicesSchema.parse(fields.r ?? []);
    const sources = sourceIndicesSchema.parse(fields.s ?? []);
    if (materials.some((index) => !resumeFacts[index]))
      throw new ServiceError('invalid_model_output', 502, '简历依据下标无效');
    const allowed = new Set(snapshot.knowledge.sources.map((source) => source.id));
    if (sources.some((index) => !allowed.has(sourceOptions[index])))
      throw new ServiceError('invalid_model_output', 502, '来源下标无效');
    return { r: materials, s: sources };
  };
  return {
    assessed,
    statusFor,
    observedGoalsFor,
    recoveringIntroduction,
    groundingFor,
    check,
    referencesFor,
  };
}
type AdvanceChecks = ReturnType<typeof createAdvanceChecks>;
function createPreviewHandler(
  plan: AdvancePlan,
  output: AdvanceSchemas,
  checks: AdvanceChecks,
  timing: { onText: () => void; onVisible: () => void },
) {
  const { interview, context, isHR, modern, grounding, last } = plan;
  const { head, controlOf } = output;
  const { check, referencesFor, recoveringIntroduction, groundingFor, statusFor } = checks;
  let preview: InterviewPreview = { acknowledgement: '', text: '' };
  return async (text: string) => {
    timing.onText();
    const parsed = jsonFields(text),
      parsedControl = head.safeParse(parsed.fields);
    if (!parsedControl.success) return;
    const control = controlOf(parsedControl.data);
    check(control);
    // Source/material selections are part of the semantic head when available.
    // Validate them before any question draft can reach text or speech.
    referencesFor(parsed.fields);
    if (control.a === 'e' || control.a === 'c') return;
    // Preparation questions are brief: validate their intent before exposing any draft assumption.
    if (preparingBackground(grounding) && typeof parsed.fields.q !== 'string') return;
    const next = {
      acknowledgement: typeof parsed.fields.b === 'string' ? parsed.fields.b : '',
      text:
        typeof parsed.fields.q === 'string'
          ? parsed.fields.q
          : parsed.partial?.key === 'q'
            ? parsed.partial.value
            : '',
    };
    if (typeof parsed.fields.q !== 'string') {
      const boundary = Math.max(
        next.text.lastIndexOf('，'),
        next.text.lastIndexOf('。'),
        next.text.lastIndexOf('？'),
        next.text.lastIndexOf('：'),
      );
      if (boundary >= 0) next.text = next.text.slice(0, boundary + 1);
      else if (next.text.length >= 8) {
        const segments = Array.from(
          new Intl.Segmenter('zh', { granularity: 'word' }).segment(next.text),
        );
        const lastWord = segments.at(-1)!;
        next.text = next.text.slice(0, lastWord.index);
        if (next.text.length < 6) next.text = '';
      } else next.text = '';
    }
    const recovering = recoveringIntroduction(control);
    if (!isHR || recovering)
      assertExperienceQuestion(
        next.text,
        groundingFor(control),
        statusFor(control) === 'covered',
        typeof parsed.fields.q === 'string',
      );
    if (modern) {
      assertPolicyQuestion(next.text, interview.configuration);
      if (isHR)
        assertConversationQuestion(
          next.text,
          grounding.conversation,
          typeof parsed.fields.q === 'string',
        );
      if (typeof parsed.fields.q === 'string') assertQuestionIntent(next.text, last.answer_text);
    }
    assertPreview(next);
    if (next.text !== preview.text || next.acknowledgement !== preview.acknowledgement) {
      await context.preview(next);
      preview = next;
      if (next.text || next.acknowledgement) timing.onVisible();
    }
  };
}

type CompactResult = z.infer<AdvanceSchemas['schema']> & Control & { r: number[]; s: number[] };
function advanceDecision(
  plan: AdvancePlan,
  output: AdvanceSchemas,
  checks: AdvanceChecks,
  compact: CompactResult,
) {
  const { sourceOptions, anchors, goalOptions } = plan;
  const { actionNames } = output;
  const { assessed, statusFor, observedGoalsFor, recoveringIntroduction, groundingFor, check } =
    checks;
  const materialIndices = compact.r;
  check(compact);
  const responseAssessment = assessed(compact);
  const observedGoals = observedGoalsFor(compact);
  const recovering = recoveringIntroduction(compact);
  const questionGrounding = groundingFor(compact);
  const value = {
    action: actionNames[compact.a],
    goal: goalOptions[compact.g],
    evidence_id: compact.e,
    text: compact.q,
    source_ids: compact.s,
    observed: statusFor(compact),
    pending: statusFor(compact) === 'needs_probe' ? compact.q : null,
    intent: compact.q,
  };
  if (value.source_ids.some((i) => !sourceOptions[i]))
    throw new ServiceError('invalid_model_output', 502, '来源下标无效');
  const evidence =
    responseAssessment?.response_eligibility === 'non_answer' || value.evidence_id === null
      ? []
      : [anchors[value.evidence_id]];
  return {
    materialIndices,
    responseAssessment,
    observedGoals,
    recovering,
    questionGrounding,
    value,
    evidence,
  };
}
type AdvanceDecision = ReturnType<typeof advanceDecision>;
function advanceObservation(plan: AdvancePlan, decision: AdvanceDecision, observedGoal: string) {
  const { grounding, semantic, isHR } = plan;
  const { evidence, value } = decision;
  return {
    goal: observedGoal,
    state:
      grounding.conversation.last_act === 'decline_topic'
        ? 'inconclusive'
        : !semantic && !isHR && preparingBackground(grounding)
          ? 'needs_probe'
          : !semantic &&
              observedGoal === 'contribution' &&
              grounding.discovery_required &&
              grounding.missing.includes('personal_role')
            ? 'needs_probe'
            : value.observed,
    evidence_refs: evidence,
    pending:
      grounding.conversation.last_act === 'decline_topic'
        ? null
        : !semantic && !isHR && preparingBackground(grounding)
          ? value.text
          : value.pending,
  };
}
function createAdvanceMemory(
  plan: AdvancePlan,
  decision: AdvanceDecision,
  compact: CompactResult,
  clarify: boolean,
) {
  const { interview, snapshot, context, modern, grounding, last } = plan;
  const { responseAssessment, observedGoals, recovering, value, evidence } = decision;
  const memory = clarify
    ? (context.memory ?? {
        version: 0,
        focus: null,
        observations: [],
        claims: [],
        asked_intents: [],
      })
    : applyMemory(
        context.memory,
        {
          focus: value.goal,
          intent: `${value.goal}:${value.intent}:${value.text}`,
          observations: evidence.length
            ? observedGoals.map((goal) => advanceObservation(plan, decision, goal))
            : [],
          claims: (
            responseAssessment
              ? responseAssessment.response_eligibility !== 'answer'
              : grounding.conversation.last_act !== 'answer'
          )
            ? []
            : evidence.slice(0, 1).map((e) => ({ text: e.quote, evidence_refs: [e] })),
        },
        snapshot,
        interview.turns,
      );
  if (!clarify) {
    if (responseAssessment) {
      memory.response = { ...responseAssessment, turn_id: last.id, revision: last.revision };
      memory.introduction_complete = context.memory?.introduction_complete ?? false;
      memory.communication_observed =
        context.memory?.communication_observed === true ||
        responseAssessment.communication_observed === true;
      if (last.stage === 'introduction' && responseAssessment.response_eligibility === 'answer')
        memory.introduction_complete = true;
      grounding.conversation.last_act = responseAssessment.act;
      if (recovering) memory.focus = null;
    }
    if (modern) memory.decision = { reason: (compact as { d: string }).d, action: value.action };
    memory.experience = grounding.experience;
    memory.conversation = grounding.conversation;
  }
  return memory;
}
function createAdvanceQuestion(
  plan: AdvancePlan,
  output: AdvanceSchemas,
  decision: AdvanceDecision,
  compact: CompactResult,
) {
  const { interview, snapshot, semantic, modern, grounding, isHR, sourceOptions, release, last } =
    plan;
  const { goalContracts } = output;
  const { recovering, questionGrounding, value, evidence } = decision;
  const question = ['finish', 'clarify'].includes(value.action)
    ? null
    : {
        text: value.text,
        topic:
          recovering || grounding.next_step === 'introduction'
            ? '自我介绍'
            : grounding.next_step === 'alternative_experience'
              ? '学习与实践背景'
              : release.competencies.find((g) => g.id === value.goal)!.title,
        purpose: recovering
          ? '温和邀请补充尚未收到的自我介绍，不预设项目经历'
          : semantic
            ? goalContracts.find((goal) => goal.goal === value.goal)!.evidence_wanted
            : release.competencies.find((g) => g.id === value.goal)!.evidence_wanted,
        knowledge_question_id: null,
        stage: (recovering || grounding.next_step === 'introduction'
          ? 'introduction'
          : grounding.next_step === 'alternative_experience' ||
              questionGrounding.discovery_required ||
              (grounding.next_step === 'topic_transition' && value.goal === 'learning')
            ? 'experience'
            : snapshot.runtime_version === 'graph-v1' && value.goal === 'contribution'
              ? 'experience'
              : ['business', 'tradeoffs'].includes(value.goal)
                ? 'business'
                : ['understanding', 'verification'].includes(value.goal)
                  ? 'technical'
                  : 'behavioral') as
          | 'introduction'
          | 'experience'
          | 'business'
          | 'technical'
          | 'behavioral',
        acknowledgement: modern ? (compact as { b: string }).b : '',
        source_refs: value.source_ids.map((i) => sourceOptions[i]),
        evidence_refs: evidence,
      };
  if (question) {
    if (!question.text.trim()) throw new Error('Empty question');
    if (modern) {
      assertPolicyQuestion(question.text, interview.configuration);
      if (isHR) assertConversationQuestion(question.text, grounding.conversation, true);
      assertQuestionIntent(question.text, last.answer_text);
    }
    if (!isHR || recovering)
      assertExperienceQuestion(
        question.text,
        questionGrounding,
        value.observed === 'covered',
        true,
      );
    assertQuestion(question, snapshot, interview.turns);
    assertPreview(question);
  }
  return question;
}
function advanceRetrieval(plan: AdvancePlan, materialIndices: number[]) {
  const { context, snapshot, grounding } = plan;
  const retrieval = knowledgeReady(grounding)
    ? context.retrieval
    : {
        ...context.retrieval,
        chunks: [],
        mode: 'empty' as const,
        missing_reason: '依据当前对话准备阶段或已知学习背景提问，暂不使用专业检索内容',
      };
  return snapshot.runtime_version === 'graph-v1'
    ? {
        ...retrieval,
        material_refs: materialIndices.map((i) => snapshot.resume_analysis!.facts[i].evidence),
      }
    : retrieval;
}
function buildAdvanceResult(
  plan: AdvancePlan,
  output: AdvanceSchemas,
  checks: AdvanceChecks,
  compact: CompactResult,
  clarify: boolean,
) {
  const decision = advanceDecision(plan, output, checks, compact);
  const memory = createAdvanceMemory(plan, decision, compact, clarify);
  const question = createAdvanceQuestion(plan, output, decision, compact);
  const { value } = decision;
  if (value.action === 'clarify' && !value.text.trim()) throw new Error('Missing clarification');
  return {
    action: value.action,
    question,
    clarification: value.action === 'clarify' ? value.text : null,
    memory,
    retrieval: advanceRetrieval(plan, decision.materialIndices),
  };
}

export function createStreamingAgent<T extends Pick<InterviewTurnAgent, 'available' | 'model'>>(
  base: T,
  config: BackendConfig,
  log: (entry: object) => void = () => {},
  fetcher: typeof fetch = fetch,
): T & InterviewTurnAgent {
  return {
    ...base,
    async advance(interview, snapshot, clarify, signal, repair, context) {
      if (!context || !snapshot.knowledge.agent_release)
        throw new ServiceError('invalid_state', 409, '面试工作流上下文缺失，请重新创建面试');
      const started = performance.now();
      let first: number | undefined, firstVisible: number | undefined;
      let code = 'ok';
      let usage: Record<string, number> | undefined;
      let usedChunks = context.retrieval.chunks;
      const timeout = AbortSignal.any([signal, AbortSignal.timeout(config.LLM_TIMEOUT_MS)]);
      try {
        const plan = prepareAdvancePlan(interview, snapshot, context);
        usedChunks = plan.knowledgeChunks;
        const output = createAdvanceSchemas(plan, clarify);
        const { semantic, modern } = plan;
        const { controlOf, schema } = output;
        const response = await fetcher(
          `${config.LLM_BASE_URL!.replace(/\/$/, '')}/chat/completions`,
          {
            method: 'POST',
            redirect: 'error',
            signal: timeout,
            headers: {
              authorization: `Bearer ${config.LLM_API_KEY}`,
              'content-type': 'application/json',
            },
            body: JSON.stringify({
              model: snapshot.model,
              stream: true,
              thinking: { type: 'disabled' },
              stream_options: { include_usage: true },
              max_tokens: semantic ? 650 : modern ? 450 : 300,
              temperature: 0.3,
              response_format: {
                type: 'json_schema',
                json_schema: { name: 'interview_v3', strict: true, schema: z.toJSONSchema(schema) },
              },
              messages: buildAdvanceMessages(plan, output, clarify, repair),
            }),
          },
        );
        if (!response.ok) throw new ServiceError('provider_error', 502, '模型请求失败', true);
        const checks = createAdvanceChecks(plan, output);
        const { referencesFor } = checks;
        const raw = await readChatStream(
          response,
          createPreviewHandler(plan, output, checks, {
            onText: () => {
              first ??= performance.now() - started;
            },
            onVisible: () => {
              firstVisible ??= performance.now() - started;
            },
          }),
          timeout,
          (value) => {
            usage = value;
          },
        );
        const parsedCompact = schema.parse(JSON.parse(raw));
        const compact = {
          ...parsedCompact,
          ...controlOf(parsedCompact),
          ...referencesFor(parsedCompact),
        };
        return buildAdvanceResult(plan, output, checks, compact, clarify);
      } catch (error) {
        log({
          task: 'advance_v3_validation',
          error:
            error instanceof ServiceError
              ? error.message
              : error instanceof z.ZodError
                ? error.issues.map((i) => ({ path: i.path, code: i.code }))
                : error instanceof Error
                  ? error.name
                  : 'unknown',
        });
        await context.preview({ acknowledgement: '', text: '' }).catch(() => {});
        code = signal.aborted
          ? 'task_cancelled'
          : timeout.aborted
            ? 'provider_timeout'
            : error instanceof ServiceError
              ? error.code
              : 'invalid_model_output';
        throw new ServiceError(code, 502, '面试官生成暂时失败，回答已保存', true);
      } finally {
        log({
          task: 'advance_v3',
          model: snapshot.model,
          prompt_version: snapshot.prompt_version,
          interview_id: interview.id,
          generation_id: interview.generation_id,
          queued_ms: context.queued_ms,
          retrieval_ms: context.retrieval_ms,
          retrieval_mode: usedChunks.length ? context.retrieval.mode : 'empty',
          chunk_ids: usedChunks.map((c) => c.id),
          usage,
          first_token_ms: first,
          first_visible_ms: firstVisible,
          duration_ms: performance.now() - started,
          code,
        });
      }
    },
  };
}
