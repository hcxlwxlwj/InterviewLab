import { experiencePolicy, knowledgeReady } from './experience';
import {
  participationPolicy,
  participationQuestion,
  isParticipationQuestion,
} from './participation';
import { INTERVIEW_V3 } from '@interviewlab/core';
import type { InterviewKnowledgeRuntime } from '@interviewlab/core';
import { initialMemory } from './memory';
import { createGenerationStreams } from './streams';
import { randomUUID } from 'node:crypto';
import {
  INTERVIEW_PROMPT_VERSION,
  INTERVIEW_RUBRIC_VERSION,
  interviewDeadline,
  interviewOpening,
  canSuggestInterviewFinish,
  nextQuestionPosition,
  type InterviewConfig,
  type InterviewKnowledgeProvider,
  type InterviewQuestion,
  type RequestIdentity,
  type PageResult,
  type Interview,
} from '@interviewlab/core';
import type { Database, Transaction } from '../../database/connection';
import { withIdempotency, inputDigest } from '../../foundation/idempotency';
import { ServiceError } from '../../foundation/errors';
import { enqueueTask } from '../../tasks/service';
import type { TaskHandler } from '../../tasks/runner';
import { getJob } from '../../content/index';
import type { InterviewAgent } from './agent';
import { assertQuestion } from './agent';
import {
  cancelInterviewTasks,
  eraseInterview,
  interviewEvent,
  loadInterview,
  newInterviewState,
  saveInterview,
  type InterviewState,
} from './repository';

export interface InterviewReportHooks {
  seal(tx: Transaction, state: InterviewState): Promise<void>;
  erase(tx: Transaction, owner: string, id: string): Promise<void>;
}
const invalid = (message = '当前状态不支持此操作') =>
  new ServiceError('invalid_state', 409, message);
const ended = (state: InterviewState) => ['completed', 'failed'].includes(state.view.status);
export function interviewInputDigest(state: InterviewState) {
  return inputDigest({
    configuration: state.view.configuration,
    snapshot: state.snapshot,
    ...(state.snapshot?.prompt_version === INTERVIEW_V3 ? { memory: state.memory ?? null } : {}),
    plan: state.view.plan,
    turns: state.view.turns.map((t) => ({
      id: t.id,
      revision: t.revision,
      answer_status: t.answer_status,
      answer_text: t.answer_text,
      text: t.text,
    })),
  });
}
const fallbackTexts = [
  '请介绍你的学习背景，以及你对目标岗位的理解。',
  '面对一个不熟悉的问题，你通常怎样分析和验证自己的思路？',
  '请举例说明你如何判断一种方案是否适合当前约束。',
  '出现与预期不一致的结果时，你会怎样定位原因？',
  '请分享一次与他人协作时调整方案的经历。',
  '结合目标岗位，你还有哪些想补充的内容？',
];
function fallbackQuestion(state: InterviewState): InterviewQuestion {
  const item = state.snapshot?.knowledge.questions.find(
    (q) => !state.view.turns.some((t) => t.knowledge_question_id === q.id),
  );
  const projectOpening =
    !state.view.turns.length &&
    ['project_deep_dive', 'mixed'].includes(state.view.configuration.interview_type);
  const useTechnical =
    !projectOpening && state.view.configuration.interview_type === 'technical_qa' && item;
  return {
    text: projectOpening
      ? '请介绍一个你参与的项目，说明项目目标及你本人负责的部分。'
      : useTechnical
        ? item.text
        : (fallbackTexts.find((text) => !state.view.turns.some((t) => t.text === text)) ??
          fallbackTexts[5]),
    topic: useTechnical ? item.topic : '通用经历与分析',
    purpose: useTechnical ? item.intent : '通用流程提问，不预设个人事实',
    knowledge_question_id: useTechnical ? item.id : null,
    source_refs: useTechnical ? item.source_refs : [],
    evidence_refs: [],
  };
}
function addQuestion(state: InterviewState, question: InterviewQuestion, followUp: boolean) {
  const position = nextQuestionPosition(state.view.turns, followUp);
  if (!position) return false;
  state.view.turns.push({
    ...question,
    ...position,
    id: randomUUID(),
    generation_id: state.view.generation_id!,
    presented_at: null,
    answer_status: 'waiting',
    answer_text: null,
    revision: 0,
    input_mode: 'text_fallback',
    answered_at: null,
  });
  state.view.generation_status = 'ready';
  state.view.clarification = null;
  return true;
}
export function createInterviewsService(
  database: Database,
  knowledge: InterviewKnowledgeProvider,
  agent: InterviewAgent,
  reports: InterviewReportHooks,
  realtimeKnowledge?: InterviewKnowledgeRuntime,
) {
  const streams = createGenerationStreams(database);
  async function seal(tx: Transaction, state: InterviewState, reason: string) {
    if (ended(state)) return;
    state.view.status = 'completed';
    state.view.ended_at = new Date().toISOString();
    state.view.end_reason = reason;
    state.view.generation_id = null;
    state.view.generation_status = 'idle';
    state.view.task_id = null;
    state.generationKind = null;
    await cancelInterviewTasks(tx.client, state.view.id);
    await saveInterview(tx.client, state);
    await reports.seal(tx, state);
    await interviewEvent(tx.client, state.view.id, 'finished', undefined, reason);
  }
  async function generate(
    tx: Transaction,
    state: InterviewState,
    kind: NonNullable<InterviewState['generationKind']>,
  ) {
    if (!agent.available)
      throw new ServiceError('capability_unavailable', 501, '请先配置服务端模型');
    state.view.generation_id = randomUUID();
    state.generationKind = kind;
    state.view.generation_status = 'pending';
    state.view.clarification = null;
    const task = await enqueueTask(tx, {
      owner_id: state.owner,
      type: `interviews.${kind === 'plan' ? 'plan' : 'advance'}.v1`,
      key: `${state.view.id}:${state.view.generation_id}`,
      input: {
        interview_id: state.view.id,
        generation_id: state.view.generation_id,
        kind,
        input_digest: interviewInputDigest(state),
      },
    });
    state.view.task_id = task.id;
  }
  const read = async (identity: RequestIdentity, id: string) =>
    (await loadInterview(database.pool, identity.owner_id, id)).view;
  async function mutate(
    identity: RequestIdentity,
    id: string,
    operation: string,
    key: string,
    body: { version: number },
    work: (tx: Transaction, state: InterviewState) => Promise<void>,
  ) {
    await withIdempotency(
      database,
      { owner_id: identity.owner_id, operation: `interviews.${id}.${operation}`, key, input: body },
      async (tx) => {
        const state = await loadInterview(tx.client, identity.owner_id, id, true);
        if (state.view.version !== body.version)
          throw new ServiceError('version_conflict', 409, '面试状态已更新，请刷新后重试');
        if (!operation.startsWith('presented.')) state.view.version++;
        if (
          !ended(state) &&
          state.view.started_at &&
          Date.now() >= interviewDeadline(state.view.started_at)
        )
          await seal(tx, state, 'hard_deadline');
        else {
          await work(tx, state);
          await saveInterview(tx.client, state);
        }
        return { id };
      },
    );
    const view = await read(identity, id);
    if (
      realtimeKnowledge &&
      view.status === 'in_progress' &&
      view.generation_status === 'ready' &&
      !isParticipationQuestion(view.turns.at(-1)?.purpose ?? '')
    ) {
      const state = await loadInterview(database.pool, identity.owner_id, id);
      if (state.snapshot)
        realtimeKnowledge.prefetch(view.configuration, state.snapshot.knowledge, state.memory);
    }
    return view;
  }
  function currentTurn(state: InterviewState, turnId: string) {
    const turn = state.view.turns.at(-1);
    if (!turn || turn.id !== turnId || turn.answer_status !== 'waiting')
      throw invalid('当前问题已变化或已经提交');
    return turn;
  }
  function answer(state: InterviewState, turnId: string, text: string | null) {
    const turn = currentTurn(state, turnId);
    const now = new Date().toISOString();
    turn.presented_at ??= now;
    turn.answered_at = now;
    turn.revision = 1;
    turn.answer_status = text === null ? 'skipped' : 'answered';
    turn.answer_text = text;
    state.view.clarification = null;
  }
  async function advanceAfterAnswer(tx: Transaction, state: InterviewState) {
    await cancelInterviewTasks(tx.client, state.view.id);
    if (state.retryQuestion || Date.now() >= Date.parse(state.view.target_at!))
      await seal(tx, state, state.retryQuestion ? 'single_retry_complete' : 'target_reached');
    else {
      const notice =
        state.snapshot?.prompt_version === INTERVIEW_V3 ? participationPolicy(state.view) : null;
      if (notice?.level === 'ended') {
        await seal(tx, state, `participation:${notice.reason}`);
      } else if (notice) {
        state.view.generation_id = randomUUID();
        state.view.task_id = null;
        state.generationKind = null;
        if (
          !addQuestion(
            state,
            participationQuestion(notice),
            state.view.turns.at(-1)!.follow_up_index < 2,
          )
        )
          await seal(tx, state, 'questions_complete');
        else
          await interviewEvent(
            tx.client,
            state.view.id,
            'participation_notice',
            notice.turn_id,
            notice.level,
          );
      } else await generate(tx, state, 'advance');
    }
  }
  async function create(identity: RequestIdentity, config: InterviewConfig, key: string) {
    if (
      config.interview_type === 'business_scenario' &&
      (config.job !== 'frontend' || !realtimeKnowledge?.enabled)
    )
      throw new ServiceError('unsupported_input', 400, '该岗位尚未开放业务面');
    const job = getJob(config.job);
    if (!job || !job.stages.includes(config.career_stage))
      throw new ServiceError('unsupported_input', 400, '岗位或阶段不可用');
    const ref = await withIdempotency(
      database,
      { owner_id: identity.owner_id, operation: 'interviews.create', key, input: config },
      async (tx) => {
        const state = newInterviewState(identity.owner_id, config);
        await saveInterview(tx.client, state);
        return { id: state.view.id };
      },
    );
    return read(identity, ref.id);
  }
  async function start(
    identity: RequestIdentity,
    id: string,
    body: { version: number },
    key: string,
  ) {
    const before = await loadInterview(database.pool, identity.owner_id, id);
    // Knowledge I/O must never hold the business transaction open.
    const frozen = before.snapshot ?? {
      job_title: getJob(before.view.configuration.job)?.title ?? before.view.configuration.job,
      knowledge: await knowledge.read(before.view.configuration),
      prompt_version: INTERVIEW_PROMPT_VERSION,
      rubric_version: INTERVIEW_RUBRIC_VERSION,
      model: agent.model,
    };
    if (frozen.knowledge.agent_release) frozen.prompt_version = INTERVIEW_V3;
    return mutate(identity, id, 'start', key, body, async (_tx, state) => {
      if (state.view.status !== 'ready') throw invalid();
      if (!agent.available) throw new ServiceError('capability_unavailable', 501, '模型尚未配置');
      state.snapshot = frozen;
      if (frozen.prompt_version === INTERVIEW_V3) state.memory = initialMemory();
      state.view.job_title = frozen.job_title;
      state.view.started_at = new Date().toISOString();
      state.view.target_at = new Date(
        Date.now() + state.view.configuration.duration_minutes * 60000,
      ).toISOString();
      state.view.deadline_at = new Date(Date.now() + 720000).toISOString();
      state.view.status = 'in_progress';
      if (state.retryQuestion) {
        state.view.generation_id = randomUUID();
        state.view.plan = [state.retryQuestion.topic];
        addQuestion(state, state.retryQuestion, false);
      } else {
        // The opening is protocol, not a pre-generated question sequence. Subsequent
        // questions are generated only after the candidate has actually answered.
        state.view.generation_id = randomUUID();
        state.view.plan = ['了解候选人', '根据当场陈述展开交流', '结合岗位交流与收尾'];
        addQuestion(state, interviewOpening(frozen.job_title), false);
      }
    });
  }
  async function readFinalized(identity: RequestIdentity, id: string) {
    const state = await loadInterview(database.pool, identity.owner_id, id);
    if (!ended(state) || !state.snapshot) throw invalid('面试尚未结束');
    return state;
  }
  const handler: TaskHandler = async (task, signal) => {
    const queuedMs = Date.now() - task.created_at.getTime();
    const input = task.payload as {
      interview_id: string;
      generation_id: string;
      kind: InterviewState['generationKind'];
      input_digest: string;
    };
    const state = await loadInterview(database.pool, task.owner_id, input.interview_id);
    if (
      !state.snapshot ||
      state.view.status !== 'in_progress' ||
      state.view.generation_id !== input.generation_id ||
      interviewInputDigest(state) !== input.input_digest
    )
      return { result_ref: null };
    const retrievalStarted = performance.now();
    const retrieval =
      state.snapshot.prompt_version === INTERVIEW_V3 && realtimeKnowledge
        ? !knowledgeReady(experiencePolicy(state.view))
          ? {
              release: state.snapshot.knowledge.content_version,
              chunks: [],
              mode: 'empty' as const,
              missing_reason: '正在了解真实项目背景，暂不检索专业内容',
            }
          : await realtimeKnowledge.context(
              state.view.configuration,
              state.snapshot.knowledge,
              state.memory ?? null,
              state.view.turns.at(-1)?.answer_text ?? '',
              signal,
            )
        : null;
    let lastPreview = 0;
    const context = retrieval
      ? {
          queued_ms: queuedMs,
          retrieval_ms: performance.now() - retrievalStarted,
          memory: state.memory ?? null,
          retrieval,
          preview: async (value: import('@interviewlab/core').InterviewPreview) => {
            if ((value.text || value.acknowledgement) && performance.now() - lastPreview < 200)
              return;
            lastPreview = performance.now();
            await streams.preview(task, input.generation_id, value);
          },
        }
      : undefined;
    const plan =
      input.kind === 'plan'
        ? await agent.plan(state.view, state.snapshot, signal, task.attempts > 1)
        : null;
    const next = plan
      ? null
      : await agent.advance(
          state.view,
          state.snapshot,
          input.kind === 'clarify',
          signal,
          task.attempts > 1,
          context,
        );
    if (plan) assertQuestion(plan.question, state.snapshot, state.view.turns);
    if (next?.question) assertQuestion(next.question, state.snapshot, state.view.turns);
    if (
      next?.action === 'finish' &&
      [INTERVIEW_PROMPT_VERSION, INTERVIEW_V3].includes(state.snapshot.prompt_version) &&
      !canSuggestInterviewFinish(state.view)
    )
      throw new ServiceError('invalid_model_output', 502, '交流尚未展开，不能提前结束');
    if (
      next?.action === 'follow_up' &&
      (state.view.turns.at(-1)?.follow_up_index === 2 ||
        state.view.turns.at(-1)?.answer_status !== 'answered')
    )
      throw new ServiceError('invalid_model_output', 502, '追问超过预算或缺少有效回答');
    return {
      result_ref: { id: state.view.id, version: state.view.version + 1 },
      lock: async (tx) => {
        try {
          await loadInterview(tx.client, task.owner_id, input.interview_id, true);
          return true;
        } catch (e) {
          if (e instanceof ServiceError && e.statusCode === 404) return false;
          throw e;
        }
      },
      commit: async (tx) => {
        const fresh = await loadInterview(tx.client, task.owner_id, input.interview_id, true);
        if (
          fresh.view.status !== 'in_progress' ||
          fresh.view.generation_id !== input.generation_id ||
          interviewInputDigest(fresh) !== input.input_digest
        )
          return false;
        fresh.view.version++;
        if (Date.now() >= interviewDeadline(fresh.view.started_at!)) {
          await seal(tx, fresh, 'hard_deadline');
          return;
        }
        if (
          input.kind !== 'clarify' &&
          fresh.view.turns.length &&
          Date.now() >= Date.parse(fresh.view.target_at!)
        ) {
          await seal(tx, fresh, 'target_reached');
          return;
        }
        if (plan) {
          fresh.view.plan = plan.topics;
          addQuestion(fresh, plan.question, false);
        } else if (next?.action === 'clarify') {
          fresh.view.clarification = next.clarification;
          fresh.view.generation_status = 'ready';
          await interviewEvent(
            tx.client,
            fresh.view.id,
            'clarify_question',
            fresh.view.turns.at(-1)?.id,
            next.clarification!,
          );
        } else if (
          next?.action === 'finish' ||
          !next?.question ||
          !addQuestion(fresh, next.question, next.action === 'follow_up')
        ) {
          await seal(tx, fresh, 'questions_complete');
          return;
        }
        if (next?.memory) fresh.memory = next.memory;
        if (retrieval && next?.question) {
          fresh.retrievals ??= {};
          fresh.retrievals[fresh.view.turns.at(-1)!.id] = next.retrieval ?? retrieval;
        }
        await saveInterview(tx.client, fresh);
      },
    };
  };
  return {
    streams,
    profiles: (config: Pick<InterviewConfig, 'job' | 'career_stage'>) =>
      realtimeKnowledge?.profiles(config),
    read,
    create,
    start,
    readFinalized,
    lock: (tx: Transaction, identity: RequestIdentity, id: string) =>
      loadInterview(tx.client, identity.owner_id, id, true),
    async list(
      identity: RequestIdentity,
      query: { limit: number; cursor?: string; status?: string; job?: string },
    ): Promise<PageResult<Interview>> {
      let cursor: { at: string; id: string; fingerprint: string } | null = null;
      const fingerprint = inputDigest({ status: query.status, job: query.job });
      if (query.cursor) {
        try {
          cursor = JSON.parse(Buffer.from(query.cursor, 'base64url').toString());
          if (
            !cursor ||
            cursor.fingerprint !== fingerprint ||
            typeof cursor.at !== 'string' ||
            !Number.isFinite(Date.parse(cursor.at)) ||
            new Date(cursor.at).toISOString() !== cursor.at ||
            !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(cursor.id)
          )
            throw new Error();
        } catch {
          throw new ServiceError('unsupported_input', 400, '分页游标无效');
        }
      }
      const rows = await database.pool.query<{ id: string; created_at: Date }>(
        `SELECT id,created_at FROM interviews WHERE owner_id=$1 AND deleted_at IS NULL
        AND ($2::text IS NULL OR status=$2) AND ($3::text IS NULL OR configuration->>'job'=$3)
        AND ($4::timestamptz IS NULL OR (created_at,id)<($4::timestamptz,$5::uuid)) ORDER BY created_at DESC,id DESC LIMIT $6`,
        [
          identity.owner_id,
          query.status ?? null,
          query.job ?? null,
          cursor?.at ?? null,
          cursor?.id ?? null,
          query.limit + 1,
        ],
      );
      const page = rows.rows.slice(0, query.limit);
      const last = page.at(-1);
      return {
        items: await Promise.all(page.map((r) => read(identity, r.id))),
        next_cursor:
          rows.rows.length > query.limit && last
            ? Buffer.from(
                JSON.stringify({ at: last.created_at.toISOString(), id: last.id, fingerprint }),
              ).toString('base64url')
            : null,
      };
    },
    patch: (
      identity: RequestIdentity,
      id: string,
      body: { version: number; configuration: InterviewConfig },
      key: string,
    ) =>
      mutate(identity, id, 'patch', key, body, async (_tx, state) => {
        if (!['draft', 'ready'].includes(state.view.status) || state.retryQuestion) throw invalid();
        if (
          body.configuration.interview_type === 'business_scenario' &&
          (body.configuration.job !== 'frontend' || !realtimeKnowledge?.enabled)
        )
          throw new ServiceError('unsupported_input', 400, '该岗位尚未开放业务面');
        const job = getJob(body.configuration.job);
        if (!job || !job.stages.includes(body.configuration.career_stage))
          throw new ServiceError('unsupported_input', 400, '岗位或阶段不可用');
        state.view.configuration = body.configuration;
      }),
    pause: (identity: RequestIdentity, id: string, body: { version: number }, key: string) =>
      mutate(identity, id, 'pause', key, body, async (tx, state) => {
        if (state.view.status !== 'in_progress') throw invalid();
        state.view.status = 'paused';
        await cancelInterviewTasks(tx.client, id);
        state.view.generation_id = null;
        state.view.generation_status = 'idle';
        state.view.task_id = null;
      }),
    resume: (identity: RequestIdentity, id: string, body: { version: number }, key: string) =>
      mutate(identity, id, 'resume', key, body, async (tx, state) => {
        if (state.view.status !== 'paused') throw invalid();
        state.view.status = 'in_progress';
        const waiting = state.view.turns.at(-1)?.answer_status === 'waiting';
        if (!waiting) {
          if (state.view.turns.length && Date.now() >= Date.parse(state.view.target_at!))
            await seal(tx, state, 'target_reached');
          else await generate(tx, state, state.view.turns.length ? 'advance' : 'plan');
        } else {
          state.view.generation_status = 'ready';
          state.generationKind = null;
        }
      }),
    answer: (
      identity: RequestIdentity,
      id: string,
      turnId: string,
      body: { version: number; text: string },
      key: string,
    ) =>
      mutate(identity, id, `answer.${turnId}`, key, body, async (tx, state) => {
        if (state.view.status !== 'in_progress' || state.view.generation_status === 'pending')
          throw invalid();
        if (!body.text.trim()) throw new ServiceError('unsupported_input', 400, '回答不能为空');
        answer(state, turnId, body.text);
        await advanceAfterAnswer(tx, state);
      }),
    presented: (
      identity: RequestIdentity,
      id: string,
      turnId: string,
      body: { version: number },
      key: string,
    ) =>
      mutate(identity, id, `presented.${turnId}`, key, body, async (_tx, state) => {
        if (state.view.status !== 'in_progress') throw invalid();
        currentTurn(state, turnId).presented_at ??= new Date().toISOString();
      }),
    action: (
      identity: RequestIdentity,
      id: string,
      turnId: string,
      body: { version: number; action: 'skip' | 'repeat_question' | 'clarify_question' },
      key: string,
    ) =>
      mutate(identity, id, `action.${turnId}`, key, body, async (tx, state) => {
        if (state.view.status !== 'in_progress' || state.view.generation_status === 'pending')
          throw invalid();
        const turn = currentTurn(state, turnId);
        await interviewEvent(tx.client, id, body.action, turnId);
        if (body.action === 'skip') {
          answer(state, turnId, null);
          await advanceAfterAnswer(tx, state);
        } else if (body.action === 'clarify_question') await generate(tx, state, 'clarify');
        else state.view.clarification = turn.text;
      }),
    finish: (
      identity: RequestIdentity,
      id: string,
      body: { version: number; reason: string; final_answer?: { turn_id: string; text: string } },
      key: string,
    ) =>
      mutate(identity, id, 'finish', key, body, async (tx, state) => {
        if (ended(state)) return;
        if (!['in_progress', 'paused'].includes(state.view.status)) throw invalid();
        if (body.final_answer) answer(state, body.final_answer.turn_id, body.final_answer.text);
        await seal(tx, state, body.reason);
      }),
    retryGeneration: (
      identity: RequestIdentity,
      id: string,
      body: { version: number; fallback: boolean },
      key: string,
    ) =>
      mutate(identity, id, 'retry-generation', key, body, async (tx, state) => {
        if (state.view.status !== 'in_progress' || state.view.generation_status !== 'failed')
          throw invalid();
        if (body.fallback && state.generationKind === 'clarify') {
          state.view.generation_status = 'ready';
          state.view.task_id = null;
          state.view.generation_id = randomUUID();
          state.view.clarification = '澄清暂时不可用，请按原题作答或选择跳过。';
          state.generationKind = null;
        } else if (body.fallback) {
          state.view.generation_id = randomUUID();
          const q = fallbackQuestion(state);
          if (state.view.turns.length && Date.now() >= Date.parse(state.view.target_at!))
            await seal(tx, state, 'target_reached');
          else if (!addQuestion(state, q, false)) await seal(tx, state, 'questions_complete');
          else {
            if (!state.view.plan.length) state.view.plan = [q.topic];
            await interviewEvent(tx.client, id, 'fallback_question');
          }
        } else
          await generate(
            tx,
            state,
            state.generationKind ?? (state.view.turns.length ? 'advance' : 'plan'),
          );
      }),
    async createRetry(
      identity: RequestIdentity,
      id: string,
      body: { turn_id: string; revision: number; goal: string },
      key: string,
    ) {
      const original = await readFinalized(identity, id);
      const turn = original.view.turns.find(
        (t) =>
          t.id === body.turn_id && t.revision === body.revision && t.answer_status === 'answered',
      );
      if (!turn) throw invalid('重练来源回答不可用');
      const ref = await withIdempotency(
        database,
        { owner_id: identity.owner_id, operation: `interviews.${id}.retry`, key, input: body },
        async (tx) => {
          // Lock the source so deletion cannot race creation.
          await loadInterview(tx.client, identity.owner_id, id, true);
          const state = newInterviewState(identity.owner_id, original.view.configuration);
          state.snapshot = original.snapshot;
          state.retryQuestion = {
            stage: turn.stage,
            text: turn.text,
            topic: turn.topic,
            purpose: turn.purpose,
            knowledge_question_id: turn.knowledge_question_id,
            source_refs: turn.source_refs,
            evidence_refs: [],
          };
          state.view.parent_interview_id = id;
          state.view.parent_turn_id = turn.id;
          state.view.parent_revision = turn.revision;
          state.view.retry_goal = body.goal;
          await saveInterview(tx.client, state);
          return { id: state.view.id };
        },
      );
      return read(identity, ref.id);
    },
    async delete(identity: RequestIdentity, id: string, body: { version: number }, key: string) {
      await withIdempotency(
        database,
        { owner_id: identity.owner_id, operation: `interviews.${id}.delete`, key, input: body },
        async (tx) => {
          const state = await loadInterview(tx.client, identity.owner_id, id, true);
          if (state.view.version !== body.version)
            throw new ServiceError('version_conflict', 409, '面试状态已更新');
          await cancelInterviewTasks(tx.client, id);
          await reports.erase(tx, identity.owner_id, id);
          await eraseInterview(tx.client, identity.owner_id, id);
          return { id };
        },
      );
    },
    handlers: { 'interviews.plan.v1': handler, 'interviews.advance.v1': handler },
    async maintain() {
      await streams.cleanup();
      const rows = await database.pool.query<{
        id: string;
        owner_id: string;
      }>(`SELECT id,owner_id FROM interviews WHERE deleted_at IS NULL AND
        status IN ('in_progress','paused') AND (started_at<=now()-interval '12 minutes' OR
        (generation_status='pending' AND EXISTS (SELECT 1 FROM tasks t WHERE t.id=interviews.task_id AND t.status='failed' AND (t.attempts>=t.max_attempts OR t.error_code='unsupported_task_type'))))
        ORDER BY started_at LIMIT 100`);
      for (const row of rows.rows)
        await database.transaction(async (tx) => {
          let state: InterviewState;
          try {
            state = await loadInterview(tx.client, row.owner_id, row.id, true);
          } catch (e) {
            if (e instanceof ServiceError && e.statusCode === 404) return;
            throw e;
          }
          if (ended(state)) return;
          if (Date.now() >= interviewDeadline(state.view.started_at!)) {
            state.view.version++;
            await seal(tx, state, 'hard_deadline');
          } else if (state.view.generation_status === 'pending' && state.view.task_id) {
            const task = await tx.client.query(
              'SELECT status,attempts,max_attempts,error_code FROM tasks WHERE id=$1',
              [state.view.task_id],
            );
            const t = task.rows[0];
            if (
              t?.status === 'failed' &&
              (t.attempts >= t.max_attempts || t.error_code === 'unsupported_task_type')
            ) {
              state.view.generation_status = 'failed';
              state.view.version++;
              await saveInterview(tx.client, state);
            }
          }
        });
    },
  };
}
export type LiveInterviewsService = ReturnType<typeof createInterviewsService>;
