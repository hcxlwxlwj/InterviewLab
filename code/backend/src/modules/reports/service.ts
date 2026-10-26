import { randomUUID } from 'node:crypto';
import type {
  DimensionKey,
  InterviewReport,
  RequestIdentity,
  InterviewComparison,
} from '@interviewlab/core';
import type { Database, Transaction } from '../../database/connection';
import { inputDigest, withIdempotency } from '../../foundation/idempotency';
import { ServiceError } from '../../foundation/errors';
import { enqueueTask } from '../../tasks/service';
import type { TaskHandler } from '../../tasks/runner';
import type { InterviewAgent } from '../interviews/agent';
import { assertEvaluation } from '../interviews/agent';
import type { InterviewState } from '../interviews/repository';
import { interviewInputDigest, type LiveInterviewsService } from '../interviews/service';
import * as repository from './repository';

const keys: DimensionKey[] = [
  'technical_knowledge',
  'project_communication',
  'coding_ability',
  'logical_expression',
];
function emptyReport(state: InterviewState, id: string): InterviewReport {
  const answered = state.view.turns.some((t) => t.answer_status === 'answered');
  const dimension = (explanation: string): InterviewReport['dimensions']['coding_ability'] => ({
    status: 'not_observed',
    score: null,
    evidence_refs: [],
    explanation,
  });
  return {
    id,
    interview_id: state.view.id,
    version: 1,
    task_ids: [],
    status: answered ? 'pending' : 'ready',
    scoring_status: 'uncalibrated',
    overall_score: null,
    dimensions: {
      technical_knowledge: dimension('本维度尚无可用观察证据。'),
      project_communication: dimension('本维度尚无可用观察证据。'),
      logical_expression: dimension('本维度尚无可用观察证据。'),
      coding_ability: dimension('本场未进行代码考核。'),
    },
    evaluations: [],
    missing_turn_ids: [],
    is_partial:
      state.view.status === 'failed' ||
      ['user_finished', 'hard_deadline'].includes(state.view.end_reason ?? ''),
    coverage: answered
      ? '文字作答；未校准数值评分。经历内容来自用户当场陈述。'
      : '没有有效回答，仅保存面试记录，不进行能力评估。',
  };
}
export function createReportsService(
  database: Database,
  interviews: LiveInterviewsService,
  agent: InterviewAgent,
) {
  async function queueEvaluations(
    tx: Transaction,
    state: InterviewState,
    reportId: string,
    version: number,
    completed: string[] = [],
  ) {
    for (const turn of state.view.turns.filter(
      (t) => t.answer_status === 'answered' && !completed.includes(t.id),
    )) {
      const task = await enqueueTask(tx, {
        owner_id: state.owner,
        type: 'reports.evaluate.v1',
        key: `${reportId}:${version}:${turn.id}`,
        input: {
          interview_id: state.view.id,
          report_id: reportId,
          report_version: version,
          turn_id: turn.id,
          revision: turn.revision,
          input_digest: interviewInputDigest(state),
        },
      });
      await repository.putEvaluationTask(tx.client, randomUUID(), reportId, turn.id, task.id);
    }
  }
  async function seal(tx: Transaction, state: InterviewState) {
    if (await repository.reportByInterview(tx.client, state.owner, state.view.id)) return;
    const id = randomUUID();
    const result = emptyReport(state, id);
    await repository.insertReport(
      tx.client,
      id,
      state.owner,
      state.view.id,
      interviewInputDigest(state),
      result,
    );
    if (result.status !== 'ready') await queueEvaluations(tx, state, id, 1);
  }
  async function get(identity: RequestIdentity, interviewId: string): Promise<InterviewReport> {
    await interviews.readFinalized(identity, interviewId);
    const row = await repository.reportByInterview(database.pool, identity.owner_id, interviewId);
    if (!row?.result) throw new ServiceError('not_found', 404, '报告尚未请求');
    return {
      ...row.result,
      task_ids: (await repository.evaluationRows(database.pool, row.id)).flatMap((e) =>
        e.task_id ? [e.task_id] : [],
      ),
      status: row.status as InterviewReport['status'],
      version: row.version,
    };
  }
  async function lockSources(
    tx: Transaction,
    identity: RequestIdentity,
    originalId: string,
    retryId: string,
  ) {
    for (const id of [originalId, retryId].sort()) await interviews.lock(tx, identity, id);
  }
  async function getComparison(
    identity: RequestIdentity,
    id: string,
  ): Promise<InterviewComparison> {
    const row = await repository.comparisonById(database.pool, identity.owner_id, id);
    await interviews.readFinalized(identity, row.original_interview_id);
    await interviews.readFinalized(identity, row.retry_interview_id);
    return {
      ...(row.result ?? row.input),
      task_id: row.task_id,
      version: row.version,
      status: row.status as InterviewComparison['status'],
    };
  }
  const evaluate: TaskHandler = async (task, signal) => {
    const input = task.payload as {
      interview_id: string;
      report_id: string;
      report_version: number;
      turn_id: string;
      revision: number;
      input_digest: string;
    };
    const identity = { owner_id: task.owner_id, roles: [] };
    const state = await interviews.readFinalized(identity, input.interview_id);
    const turn = state.view.turns.find(
      (t) =>
        t.id === input.turn_id && t.revision === input.revision && t.answer_status === 'answered',
    );
    if (!turn || interviewInputDigest(state) !== input.input_digest) return { result_ref: null };
    const value = await agent.evaluate(turn, state.snapshot!, signal, task.attempts > 1);
    const related = state.snapshot!.knowledge.questions.filter(
      (q) => q.id === turn.knowledge_question_id || q.topic === turn.topic,
    );
    assertEvaluation(value, turn, {
      ...state.snapshot!,
      knowledge: { ...state.snapshot!.knowledge, questions: related },
    });
    return {
      result_ref: { id: input.report_id, version: input.report_version },
      lock: async (tx) => {
        try {
          await interviews.lock(tx, identity, input.interview_id);
          return true;
        } catch (e) {
          if (e instanceof ServiceError && e.statusCode === 404) return false;
          throw e;
        }
      },
      commit: async (tx) => {
        const fresh = await interviews.lock(tx, identity, input.interview_id);
        const report = await repository.reportByInterview(
          tx.client,
          task.owner_id,
          input.interview_id,
          true,
        );
        if (
          !report ||
          report.id !== input.report_id ||
          report.version !== input.report_version ||
          interviewInputDigest(fresh) !== input.input_digest
        )
          return false;
        await repository.putEvaluationResult(tx.client, report.id, turn.id, task.id, value);
      },
    };
  };
  const compare: TaskHandler = async (task, signal) => {
    const input = task.payload as { comparison_id: string; version: number };
    const identity = { owner_id: task.owner_id, roles: [] };
    const row = await repository.comparisonById(database.pool, task.owner_id, input.comparison_id);
    if (row.version !== input.version || row.task_id !== task.id) return { result_ref: null };
    await interviews.readFinalized(identity, row.original_interview_id);
    await interviews.readFinalized(identity, row.retry_interview_id);
    const value = await agent.compare(row.input, signal, task.attempts > 1);
    return {
      result_ref: { id: row.id, version: row.version },
      lock: async (tx) => {
        try {
          await lockSources(tx, identity, row.original_interview_id, row.retry_interview_id);
          return true;
        } catch (e) {
          if (e instanceof ServiceError && e.statusCode === 404) return false;
          throw e;
        }
      },
      commit: async (tx) => {
        const fresh = await repository.comparisonById(tx.client, task.owner_id, row.id, true);
        if (fresh.version !== input.version || fresh.task_id !== task.id) return false;
        const result: InterviewComparison = {
          ...fresh.input,
          ...value,
          version: fresh.version,
          status: 'ready',
          limitations: [
            ...value.limitations,
            '同题重练可能包含熟悉题目的影响，不代表跨题迁移或招聘表现。',
            '经历事实来自用户当场陈述，未作独立核验。',
          ],
        };
        await repository.updateComparison(
          tx.client,
          row.id,
          fresh.version,
          task.id,
          'ready',
          result,
        );
      },
    };
  };
  return {
    seal,
    erase: (tx: Transaction, owner: string, id: string) =>
      repository.eraseReports(tx.client, owner, id),
    get,
    getComparison,
    async request(identity: RequestIdentity, id: string, body: { version: number }, key: string) {
      await withIdempotency(
        database,
        { owner_id: identity.owner_id, operation: `reports.${id}.request`, key, input: body },
        async (tx) => {
          const state = await interviews.lock(tx, identity, id);
          if (!['completed', 'failed'].includes(state.view.status) || !state.snapshot)
            throw new ServiceError('invalid_state', 409, '请先结束面试');
          let row = await repository.reportByInterview(tx.client, identity.owner_id, id, true);
          if (!row) {
            await seal(tx, state);
            row = await repository.reportByInterview(tx.client, identity.owner_id, id);
          }
          if (!row) throw new Error('report missing');
          if (row.version !== body.version)
            throw new ServiceError('version_conflict', 409, '报告版本已更新');
          if (
            row.status === 'failed' ||
            (row.status === 'ready' && row.result?.missing_turn_ids.length)
          ) {
            const version = row.version + 1;
            const results = await repository.evaluationRows(tx.client, row.id);
            await queueEvaluations(
              tx,
              state,
              row.id,
              version,
              results.filter((r) => r.result).map((r) => r.turn_id),
            );
            await repository.updateReport(tx.client, row.id, version, {
              ...row.result!,
              version,
              status: 'pending',
            });
          }
          return { id };
        },
      );
      return get(identity, id);
    },
    async createComparison(
      identity: RequestIdentity,
      body: {
        original_interview_id: string;
        retry_interview_id: string;
        original_turn_id: string;
        retry_turn_id: string;
        original_revision: number;
        retry_revision: number;
      },
      key: string,
    ) {
      const ref = await withIdempotency(
        database,
        { owner_id: identity.owner_id, operation: 'comparisons.create', key, input: body },
        async (tx) => {
          await lockSources(tx, identity, body.original_interview_id, body.retry_interview_id);
          const original = await interviews.lock(tx, identity, body.original_interview_id);
          const retry = await interviews.lock(tx, identity, body.retry_interview_id);
          const originalTurn = original.view.turns.find(
            (t) =>
              t.id === body.original_turn_id &&
              t.revision === body.original_revision &&
              t.answer_status === 'answered',
          );
          const retryTurn = retry.view.turns.find(
            (t) =>
              t.id === body.retry_turn_id &&
              t.revision === body.retry_revision &&
              t.answer_status === 'answered',
          );
          if (
            !['completed', 'failed'].includes(original.view.status) ||
            !['completed', 'failed'].includes(retry.view.status) ||
            !originalTurn ||
            !retryTurn ||
            retry.view.parent_interview_id !== original.view.id ||
            retry.view.parent_turn_id !== originalTurn.id ||
            retry.view.parent_revision !== originalTurn.revision ||
            retryTurn.text !== originalTurn.text ||
            original.snapshot?.rubric_version !== retry.snapshot?.rubric_version
          )
            throw new ServiceError(
              'invalid_state',
              409,
              '只能比较同一来源的已结束单题重练与指定版本回答',
            );
          const digest = inputDigest(body);
          await tx.client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
            `comparisons:${identity.owner_id}:${digest}`,
          ]);
          const existing = await repository.comparisonByDigest(
            tx.client,
            identity.owner_id,
            digest,
          );
          if (existing) return { id: existing.id };
          const id = randomUUID();
          const value: InterviewComparison = {
            id,
            version: 1,
            task_id: null,
            ...body,
            original_text: originalTurn.answer_text!,
            retry_text: retryTurn.answer_text!,
            goal: retry.view.retry_goal ?? '回应原题并补充具体依据',
            question: originalTurn.text,
            status: 'pending',
            changes: [],
            remaining_gaps: [],
            limitations: [],
          };
          const task = await enqueueTask(tx, {
            owner_id: identity.owner_id,
            type: 'comparisons.generate.v1',
            key: `${id}:1`,
            input: {
              comparison_id: id,
              version: 1,
              original_interview_id: body.original_interview_id,
              retry_interview_id: body.retry_interview_id,
            },
          });
          value.task_id = task.id;
          await repository.insertComparison(tx.client, identity.owner_id, digest, value, task.id);
          return { id };
        },
      );
      return getComparison(identity, ref.id);
    },
    async retryComparison(
      identity: RequestIdentity,
      id: string,
      body: { version: number },
      key: string,
    ) {
      // Sources are checked before locking the comparison, preserving the publication lock order.
      const before = await repository.comparisonById(database.pool, identity.owner_id, id);
      await withIdempotency(
        database,
        { owner_id: identity.owner_id, operation: `comparisons.${id}.retry`, key, input: body },
        async (tx) => {
          await lockSources(tx, identity, before.original_interview_id, before.retry_interview_id);
          const row = await repository.comparisonById(tx.client, identity.owner_id, id, true);
          if (row.version !== body.version)
            throw new ServiceError('version_conflict', 409, '比较版本已更新');
          if (row.status !== 'failed') return { id };
          const version = row.version + 1;
          const task = await enqueueTask(tx, {
            owner_id: identity.owner_id,
            type: 'comparisons.generate.v1',
            key: `${id}:${version}`,
            input: {
              comparison_id: id,
              version,
              original_interview_id: row.original_interview_id,
              retry_interview_id: row.retry_interview_id,
            },
          });
          await repository.updateComparison(tx.client, id, version, task.id, 'pending');
          return { id };
        },
      );
      return getComparison(identity, id);
    },
    handlers: { 'reports.evaluate.v1': evaluate, 'comparisons.generate.v1': compare },
    async maintain() {
      for (const row of await repository.pendingReports(database.pool))
        await database.transaction(async (tx) => {
          let state: InterviewState;
          try {
            state = await interviews.lock(
              tx,
              { owner_id: row.owner_id, roles: [] },
              row.interview_id,
            );
          } catch (e) {
            if (e instanceof ServiceError && e.statusCode === 404) return;
            throw e;
          }
          const current = await repository.reportByInterview(
            tx.client,
            row.owner_id,
            row.interview_id,
            true,
          );
          if (!current || !['pending', 'generating'].includes(current.status)) return;
          const evaluations = await repository.evaluationRows(tx.client, row.id);
          const settled = evaluations.every(
            (e) =>
              Boolean(e.result) ||
              e.task_status === 'cancelled' ||
              (e.task_status === 'failed' &&
                (e.attempts >= e.max_attempts || e.error_code === 'unsupported_task_type')),
          );
          if (!settled) {
            if (current.status !== 'generating')
              await repository.updateReport(tx.client, row.id, current.version, {
                ...current.result!,
                status: 'generating',
              });
            return;
          }
          const values = evaluations.flatMap((e) => (e.result ? [e.result] : []));
          const missing = evaluations.filter((e) => !e.result).map((e) => e.turn_id);
          const report = emptyReport(state, row.id);
          report.version = current.version;
          report.status = values.length || !evaluations.length ? 'ready' : 'failed';
          report.evaluations = values.sort(
            (a, b) =>
              state.view.turns.findIndex((t) => t.id === a.turn_id) -
              state.view.turns.findIndex((t) => t.id === b.turn_id),
          );
          report.missing_turn_ids = missing;
          report.is_partial ||= missing.length > 0;
          report.coverage += ` 已分析 ${values.length} 题，缺失 ${missing.length} 题。`;
          for (const key of keys.filter((k) => k !== 'coding_ability')) {
            const observed = values.filter((v) => v.dimensions.includes(key));
            if (observed.length)
              report.dimensions[key] = {
                status: 'observed',
                score: null,
                evidence_refs: observed.flatMap((v) =>
                  [...v.strengths, ...v.gaps].flatMap((f) => f.evidence_refs),
                ),
                explanation: '已观察对应回答，评分标准尚未校准，仅提供证据分析。',
              };
          }
          await repository.updateReport(tx.client, row.id, current.version, report);
        });
      for (const row of await repository.pendingComparisons(database.pool)) {
        const status =
          row.task_status === 'failed' &&
          (row.attempts >= row.max_attempts || row.error_code === 'unsupported_task_type')
            ? 'failed'
            : 'generating';
        // Do not overwrite a result that committed after this snapshot was read.
        await database.pool.query(
          "UPDATE interview_comparisons SET status=$2 WHERE id=$1 AND version=$3 AND status IN ('pending','generating')",
          [row.id, status, row.version],
        );
      }
    },
  };
}
export type LiveReportsService = ReturnType<typeof createReportsService>;
