import {
  mainQuestionLimit,
  interviewDurationMinutes,
  INTERVIEW_POLICY_VERSION,
  interviewPolicy,
  interviewPacing,
  missingFeedbackDimensions,
  FEEDBACK_INTERVIEW_GOALS,
  canSuggestInterviewFinish,
  type Interview,
  type InterviewSnapshot,
  type InterviewEvidence,
} from '@interviewlab/core';
import {
  experiencePolicy,
  applyResumeExperience,
  preparingBackground,
  knowledgeReady,
} from '../../experience';
import type { AdvanceContext } from '../runtime/streaming-agent';

interface PlanningState {
  interview: Interview;
  snapshot: InterviewSnapshot;
  context: AdvanceContext;
  semantic: boolean;
  modern: boolean;
  isHR: boolean;
  grounding: ReturnType<typeof experiencePolicy>;
  policy: ReturnType<typeof interviewPolicy>;
  pacing: ReturnType<typeof interviewPacing>;
  missingFeedback: ReturnType<typeof missingFeedbackDimensions>;
}
function canFinishAdvance(state: PlanningState) {
  const { interview, context, modern, semantic, isHR, pacing, grounding, missingFeedback } = state;
  const last = interview.turns.at(-1)!;
  const hasCoverageTime =
    last.main_question_index < mainQuestionLimit(interviewDurationMinutes(interview)) &&
    (!interview.target_at || Date.parse(interview.target_at) - Date.now() > 30000);
  return (
    canSuggestInterviewFinish(interview) &&
    (!modern ||
      pacing.phase === 'closing' ||
      last.main_question_index >= mainQuestionLimit(interviewDurationMinutes(interview))) &&
    (!modern ||
      !isHR ||
      !hasCoverageTime ||
      ['motivation', 'availability', 'expectations'].every(
        (goal) =>
          context.memory?.observations.some(
            (o) =>
              o.goal === goal && ['covered', 'inconclusive', 'not_applicable'].includes(o.state),
          ) ||
          (!semantic && context.memory?.focus === goal && last.answer_status === 'answered'),
      )) &&
    (!hasCoverageTime || missingFeedback.length === 0) &&
    (isHR || !preparingBackground(grounding)) &&
    (isHR || grounding.actual_discussion_started)
  );
}
function currentAnswerAnchors(last: Interview['turns'][number]): InterviewEvidence[] {
  if (last.answer_status !== 'answered' || !last.answer_text) return [];
  const sentences = last.answer_text.match(/[^。！？\n]+[。！？]?/g) ?? [];
  return sentences
    .slice(0, 8)
    .map((sentence) => ({
      turn_id: last.id,
      revision: last.revision,
      quote: sentence.slice(0, 100),
    }))
    .filter((anchor) => anchor.quote.trim());
}
function backgroundGoals(goalOptions: string[], state: PlanningState): string[] {
  const { interview, semantic, isHR, grounding } = state;
  if (
    interview.configuration.interview_type === 'hr' &&
    interview.turns.length === 1 &&
    grounding.next_step !== 'introduction'
  )
    goalOptions = ['motivation'];
  if (
    !semantic &&
    !isHR &&
    (grounding.discovery_required || grounding.next_step === 'alternative_experience')
  )
    goalOptions = ['contribution'];
  if (grounding.next_step === 'introduction' || (!isHR && grounding.next_step === 'motivation'))
    goalOptions = ['motivation'];
  if (!isHR && grounding.next_step === 'learning_basics')
    goalOptions = [
      interview.configuration.interview_type === 'business_scenario'
        ? 'learning'
        : interview.configuration.interview_type === 'hr'
          ? 'learning'
          : 'understanding',
    ];
  if (!isHR && grounding.next_step === 'topic_transition') {
    const blocked = new Set(
      grounding.conversation.boundaries.filter((b) => b.scope === 'topic').map((b) => b.topic),
    );
    goalOptions = (
      grounding.learning_background ? ['understanding', 'learning'] : ['learning', 'understanding']
    ).filter(
      (g) =>
        !(g === 'learning' && blocked.has('learning_experience')) &&
        !(g === 'understanding' && blocked.has('technical')),
    );
    if (!goalOptions.length) goalOptions = ['business'];
  }
  return goalOptions;
}
function coverageGoals(goalOptions: string[], state: PlanningState): string[] {
  const { modern, isHR, grounding, policy, pacing, missingFeedback } = state;
  if (
    !isHR &&
    !preparingBackground(grounding) &&
    grounding.next_step !== 'topic_transition' &&
    (!modern || pacing.remaining_seconds <= policy.closing_seconds + 90)
  ) {
    const missingGoals = missingFeedback.flatMap((d) => [...FEEDBACK_INTERVIEW_GOALS[d.key]]);
    const priorityGoals = goalOptions.filter((g) =>
      missingGoals.includes(g as (typeof missingGoals)[number]),
    );
    if (priorityGoals.length) goalOptions = priorityGoals;
  }
  return goalOptions;
}
function permittedGoals(goalOptions: string[], state: PlanningState): string[] {
  const { semantic, isHR, grounding, missingFeedback } = state;
  if (semantic && !isHR) {
    const blockedGoals: Record<string, string[]> = {
      project: ['contribution'],
      learning_experience: ['learning'],
      motivation: ['motivation'],
    };
    const blocked = new Set(
      grounding.conversation.boundaries
        .filter((boundary) => boundary.scope === 'topic')
        .flatMap((boundary) => blockedGoals[boundary.topic] ?? []),
    );
    goalOptions = goalOptions.filter((goal) => !blocked.has(goal));
    if (!goalOptions.length)
      goalOptions = ['understanding', 'business'].filter((goal) => !blocked.has(goal));
    const missingGoals = missingFeedback.flatMap((d) => [...FEEDBACK_INTERVIEW_GOALS[d.key]]);
    const rank = (goal: string) =>
      !missingGoals.includes(goal as (typeof missingGoals)[number]) ? 1 : 0;
    // An intended focus is not evidence that the actual question examined that dimension.
    goalOptions.sort((a, b) => rank(a) - rank(b));
  }
  return goalOptions;
}

function selectGoalOptions(state: PlanningState): string[] {
  const { snapshot, context, semantic, modern, isHR, grounding, pacing } = state;
  const release = snapshot.knowledge.agent_release!;
  let goalOptions = release.profile.goals.filter(
    (g) =>
      !context.memory?.observations.some(
        (o) =>
          o.goal === g &&
          (semantic
            ? ['covered', 'inconclusive', 'not_applicable']
            : ['covered', 'not_applicable']
          ).includes(o.state),
      ),
  );
  if (!goalOptions.length) goalOptions = release.profile.goals;
  if (modern && isHR) {
    const blocked = grounding.conversation.boundaries
      .filter((b) => b.scope === 'topic')
      .map((b) => b.topic);
    goalOptions = goalOptions.filter((g) => !blocked.includes(g as (typeof blocked)[number]));
    if (!goalOptions.length) goalOptions = ['learning', 'collaboration'];
  }
  if (snapshot.runtime_version === 'graph-v1' && snapshot.preparation_plan) {
    const priority = snapshot.preparation_plan.goals.map((g) => g.goal);
    goalOptions.sort(
      (a, b) =>
        (priority.indexOf(a) < 0 ? 99 : priority.indexOf(a)) -
        (priority.indexOf(b) < 0 ? 99 : priority.indexOf(b)),
    );
  }
  if (modern)
    goalOptions.sort((a, b) => {
      const rank = (g: string) => {
        const i = pacing.preferred_goals.indexOf(g);
        return i < 0 ? 99 : i;
      };
      return rank(a) - rank(b);
    });
  goalOptions = backgroundGoals(goalOptions, state);
  goalOptions = coverageGoals(goalOptions, state);
  return permittedGoals(goalOptions, state);
}
export function prepareAdvancePlan(
  interview: Interview,
  snapshot: InterviewSnapshot,
  context: AdvanceContext,
) {
  const release = snapshot.knowledge.agent_release!,
    last = interview.turns.at(-1)!;
  const semantic = snapshot.preparation_plan?.policy?.version === INTERVIEW_POLICY_VERSION;
  const modern = semantic || snapshot.preparation_plan?.policy?.version === 'interview-policy-v2';
  const grounding = experiencePolicy(interview);
  applyResumeExperience(grounding, snapshot.resume_analysis, last.answer_text ?? '', last.text);
  if (
    modern &&
    interview.configuration.interview_type === 'business_scenario' &&
    grounding.next_step !== 'introduction' &&
    grounding.next_step !== 'topic_transition'
  ) {
    grounding.discovery_required = false;
    grounding.hypothetical_allowed = true;
    grounding.next_step = 'interview';
  }
  const knowledgeChunks = knowledgeReady(grounding) ? context.retrieval.chunks : [];
  const policy = interviewPolicy(interview.configuration);
  const pacing = interviewPacing(interview, {
    ...context.memory!,
    conversation: grounding.conversation,
  });
  const isHR = interview.configuration.interview_type === 'hr';
  const missingFeedback = isHR
    ? []
    : missingFeedbackDimensions(
        context.memory,
        semantic
          ? context.memory?.communication_observed === true
          : interview.turns.some((t) => t.answer_status === 'answered'),
      );
  const sourceOptions = [...new Set(knowledgeChunks.flatMap((c) => c.source_refs))];
  const state = {
    interview,
    snapshot,
    context,
    semantic,
    modern,
    isHR,
    grounding,
    policy,
    pacing,
    missingFeedback,
  };
  const canFinish = canFinishAdvance(state);
  const anchors = currentAnswerAnchors(last);
  const goalOptions = selectGoalOptions(state);
  return {
    ...state,
    release,
    last,
    knowledgeChunks,
    canFinish,
    sourceOptions,
    anchors,
    goalOptions,
  };
}
