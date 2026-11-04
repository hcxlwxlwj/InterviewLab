import { FRONTEND_RUBRIC_VERSION, FEEDBACK_TEMPLATE_VERSION } from '@interviewlab/core';
import { randomUUID } from 'node:crypto';
import type {
  InterviewReport,
  RequestIdentity,
  InterviewComparison,
  ReportRequest,
} from '@interviewlab/core';
import type { Database, Transaction } from '../../database/connection';
import { inputDigest, withIdempotency } from '../../foundation/idempotency';
import { ServiceError } from '../../foundation/errors';
import { enqueueTask, type TaskRow } from '../../tasks/service';
import type { TaskHandler } from '../../tasks/runner';
import type { InterviewAgent } from '../interviews/model-analysis';
import {
  assertEvaluation,
  assertSummary,
  REPORT_PROMPT_VERSION,
  REPORT_SCHEMA_VERSION,
} from './analysis';
import { aggregateReport, emptyReport, evaluationDigest, taskSettled } from './aggregate';
import type { InterviewState } from '../interviews/repository';
import { interviewInputDigest, type LiveInterviewsService } from '../interviews/service';
import * as repository from './repository';

export function createReportsService(
  database: Database,
  interviews: LiveInterviewsService,
  agent: InterviewAgent,
) {
  function evaluationContext(state: InterviewState, turn: InterviewState['view']['turns'][number]) {
    const group = state.view.turns.filter(
      (t) => t.main_question_index === turn.main_question_index,
    );
    return {
      scoring_rubric_version:
        state.view.configuration.job === 'frontend' &&
        state.view.configuration.career_stage === 'internship'
          ? FRONTEND_RUBRIC_VERSION
          : undefined,
      main_question: group.find((t) => t.follow_up_index === 0)?.text ?? turn.text,
      earlier_answers: group
        .filter((t) => t.follow_up_index < turn.follow_up_index && t.answer_status === 'answered')
        .map((t) => ({ question: t.text, answer: t.answer_text! })),
    };
  }
  function turnDigest(state: InterviewState, turn: InterviewState['view']['turns'][number]) {
    return inputDigest({
      turn: {
        id: turn.id,
        revision: turn.revision,
        text: turn.text,
        answer_text: turn.answer_text,
        answer_status: turn.answer_status,
        stage: turn.stage,
        topic: turn.topic,
        purpose: turn.purpose,
        knowledge_question_id: turn.knowledge_question_id,
        main_question_index: turn.main_question_index,
        follow_up_index: turn.follow_up_index,
      },
      snapshot: state.snapshot,
      context: evaluationContext(state, turn),
      prompt: REPORT_PROMPT_VERSION,
      schema: REPORT_SCHEMA_VERSION,
    });
  }
  async function queueEvaluations(
    tx: Transaction,
    state: InterviewState,
    reportId: string,
    version: number,
    completed: string[] = [],
  ) {
    const existing = await repository.evaluationRows(tx.client, reportId);
    for (const turn of state.view.turns.filter(
      (t) => t.answer_status === 'answered' && !completed.includes(t.id),
    )) {
      const digest = turnDigest(state, turn);
      const prior = existing.find((e) => e.turn_id === turn.id);
      if (prior?.evaluation_input_digest === digest && prior.report_version === version) continue;
      const task = await enqueueTask(tx, {
        owner_id: state.owner,
        type: 'reports.evaluate.v1',
        key: inputDigest({ reportId, version, turnId: turn.id, digest }),
        input: {
          interview_id: state.view.id,
          report_id: reportId,
          report_version: version,
          turn_id: turn.id,
          revision: turn.revision,
          scoring_rubric_version:
            state.view.configuration.job === 'frontend' &&
            state.view.configuration.career_stage === 'internship'
              ? FRONTEND_RUBRIC_VERSION
              : undefined,
          input_digest: interviewInputDigest(state),
          evaluation_input_digest: digest,
        },
      });
      await repository.putEvaluationTask(tx.client, randomUUID(), reportId, turn.id, task.id);
    }
  }
  async function prepare(tx: Transaction, state: InterviewState) {
    if (!state.snapshot || !state.view.turns.some((t) => t.answer_status === 'answered')) return;
    let row = await repository.reportByInterview(tx.client, state.owner, state.view.id, true);
    if (!row) {
      const id = randomUUID();
      await repository.insertReport(
        tx.client,
        id,
        state.owner,
        state.view.id,
        interviewInputDigest(state),
        emptyReport(state, id),
      );
      row = await repository.reportByInterview(tx.client, state.owner, state.view.id);
    }
    await queueEvaluations(tx, state, row!.id, row!.version);
    await repository.markDraft(tx.client, row!.id);
  }
  async function seal(tx: Transaction, state: InterviewState) {
    const existing = await repository.reportByInterview(
      tx.client,
      state.owner,
      state.view.id,
      true,
    );
    if (existing) {
      await queueEvaluations(tx, state, existing.id, existing.version);
      await repository.updateInputDigest(tx.client, existing.id, interviewInputDigest(state));
      const report = aggregateReport(
        state,
        { ...emptyReport(state, existing.id), version: existing.version },
        await repository.evaluationRows(tx.client, existing.id),
      );
      await startSummaryIfReady(tx, state, report, existing.summary_task_id);
      await repository.updateReport(tx.client, existing.id, existing.version, report);
      return;
    }
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
    const state = await interviews.readReportState(identity, interviewId);
    const row = await repository.reportByInterview(database.pool, identity.owner_id, interviewId);
    if (!row?.result) throw new ServiceError('not_found', 404, '报告尚未请求');
    const report = aggregateReport(
      state,
      { ...row.result, version: row.version, status: row.status as InterviewReport['status'] },
      await repository.evaluationRows(database.pool, row.id),
    );
    report.needs_refresh = row.input_digest !== interviewInputDigest(state);
    if (row.summary_task_id) report.task_ids.push(row.summary_task_id);
    return report;
  }
  async function queueSummary(tx: Transaction, state: InterviewState, report: InterviewReport) {
    const digest = evaluationDigest(report.evaluations);
    const task = await enqueueTask(tx, {
      owner_id: state.owner,
      type: 'reports.summarize.v1',
      key: `${report.id}:${report.version}:${digest}`,
      input: {
        interview_id: state.view.id,
        report_id: report.id,
        report_version: report.version,
        input_digest: interviewInputDigest(state),
        evaluations_digest: digest,
      },
    });
    await repository.setSummaryTask(tx.client, report.id, task.id, digest);
    report.summary_status = 'pending';
    report.status = 'generating';
  }
  async function startSummaryIfReady(
    tx: Transaction,
    state: InterviewState,
    report: InterviewReport,
    summaryTaskId: string | null,
  ) {
    if (
      ['completed', 'failed'].includes(state.view.status) &&
      !summaryTaskId &&
      !report.analysis_progress?.pending &&
      report.evaluations.some((e) => e.strengths.length || e.gaps.length)
    ) {
      await queueSummary(tx, state, report);
    }
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
      scoring_rubric_version?: string;
      input_digest: string;
      evaluation_input_digest?: string;
    };
    const identity = { owner_id: task.owner_id, roles: [] };
    const state = input.evaluation_input_digest
      ? await interviews.readAnalysisState(identity, input.interview_id)
      : await interviews.readReportState(identity, input.interview_id);
    const turn = state.view.turns.find(
      (t) =>
        t.id === input.turn_id && t.revision === input.revision && t.answer_status === 'answered',
    );
    if (
      !turn ||
      !state.snapshot ||
      (input.evaluation_input_digest
        ? turnDigest(state, turn) !== input.evaluation_input_digest
        : interviewInputDigest(state) !== input.input_digest)
    )
      return { result_ref: null };
    const active = await repository.reportByInterview(
      database.pool,
      task.owner_id,
      input.interview_id,
    );
    if (!active || active.id !== input.report_id || active.version !== input.report_version)
      return { result_ref: null };
    const group = state.view.turns.filter(
      (t) => t.main_question_index === turn.main_question_index,
    );
    const value = await agent.evaluate(turn, state.snapshot!, signal, task.attempts > 1, {
      scoring_rubric_version: input.scoring_rubric_version,
      main_question: group.find((t) => t.follow_up_index === 0)?.text ?? turn.text,
      earlier_answers: group
        .filter((t) => t.follow_up_index < turn.follow_up_index && t.answer_status === 'answered')
        .map((t) => ({ question: t.text, answer: t.answer_text! })),
    });
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
        await interviews.lock(tx, identity, input.interview_id);
        const fresh = await interviews.readReportState(identity, input.interview_id, tx);
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
          (fresh.answerSources?.length && report.input_digest !== interviewInputDigest(fresh)) ||
          (input.evaluation_input_digest
            ? !fresh.view.turns.some(
                (t) =>
                  t.id === input.turn_id &&
                  t.answer_status === 'answered' &&
                  turnDigest(fresh, t) === input.evaluation_input_digest,
              )
            : interviewInputDigest(fresh) !== input.input_digest)
        )
          return false;
        await repository.putEvaluationResult(tx.client, report.id, turn.id, task.id, value);
        const next = aggregateReport(
          fresh,
          { ...report.result!, version: report.version },
          await repository.evaluationRows(tx.client, report.id),
        );
        await startSummaryIfReady(tx, fresh, next, report.summary_task_id);
        await repository.updateReport(tx.client, report.id, report.version, next);
        if (!['completed', 'failed'].includes(fresh.view.status))
          await repository.markDraft(tx.client, report.id);
      },
    };
  };
  const summarize: TaskHandler = async (task, signal) => {
    const input = task.payload as {
      interview_id: string;
      report_id: string;
      report_version: number;
      input_digest: string;
      evaluations_digest: string;
    };
    const identity = { owner_id: task.owner_id, roles: [] };
    const state = await interviews.readReportState(identity, input.interview_id);
    const row = await repository.reportByInterview(
      database.pool,
      task.owner_id,
      input.interview_id,
    );
    if (
      !row?.result ||
      row.id !== input.report_id ||
      row.version !== input.report_version ||
      row.summary_task_id !== task.id ||
      row.summary_input_digest !== input.evaluations_digest ||
      interviewInputDigest(state) !== input.input_digest
    )
      return { result_ref: null };
    const report = aggregateReport(
      state,
      row.result,
      await repository.evaluationRows(database.pool, row.id),
    );
    if (
      !report.evaluations.length ||
      report.analysis_progress!.pending ||
      evaluationDigest(report.evaluations) !== input.evaluations_digest
    )
      return { result_ref: null };
    const value = await agent.summarize(
      report.evaluations,
      state.snapshot!,
      signal,
      task.attempts > 1,
      { turns: state.view.turns },
    );
    assertSummary(value, report.evaluations, {
      turns: state.view.turns,
      snapshot: state.snapshot!,
    });
    return {
      result_ref: { id: row.id, version: row.version },
      lock: async (tx) => {
        try {
          await interviews.lock(tx, identity, input.interview_id);
        } catch (e) {
          if (e instanceof ServiceError && e.statusCode === 404) return false;
          throw e;
        }
      },
      commit: async (tx) => {
        await interviews.lock(tx, identity, input.interview_id);
        const fresh = await interviews.readReportState(identity, input.interview_id, tx);
        const current = await repository.reportByInterview(
          tx.client,
          task.owner_id,
          input.interview_id,
          true,
        );
        if (
          !current?.result ||
          current.id !== input.report_id ||
          current.version !== input.report_version ||
          current.summary_task_id !== task.id ||
          current.summary_input_digest !== input.evaluations_digest ||
          interviewInputDigest(fresh) !== input.input_digest
        )
          return false;
        const next = aggregateReport(
          fresh,
          current.result,
          await repository.evaluationRows(tx.client, current.id),
        );
        if (
          next.analysis_progress!.pending ||
          evaluationDigest(next.evaluations) !== input.evaluations_digest
        )
          return false;
        next.summary = {
          ...value,
          limitations: [
            ...new Set([
              '仅依据本次文字回答；经历事实来自用户陈述，未经独立核验。',
              ...(next.is_partial
                ? ['本场或部分题目分析不完整，总结仅覆盖已成功分析的回答。']
                : []),
              ...value.limitations,
              ...next.evaluations.flatMap((e) => e.limitations),
            ]),
          ].slice(0, 12),
        };
        if (next.analysis_metadata) next.analysis_metadata.prompt_version = REPORT_PROMPT_VERSION;
        next.summary_status = 'ready';
        next.status = 'ready';
        await repository.updateReport(
          tx.client,
          current.id,
          current.version,
          aggregateReport(fresh, next, await repository.evaluationRows(tx.client, current.id)),
        );
      },
    };
  };
  const compare: TaskHandler = async (task, signal) => {
    const input = task.payload as { comparison_id: string; version: number };
    const identity = { owner_id: task.owner_id, roles: [] };
    const row = await repository.comparisonById(database.pool, task.owner_id, input.comparison_id);
    if (row.version !== input.version || row.task_id !== task.id) return { result_ref: null };
    await interviews.readFinalized(identity, row.original_interview_id);
    const retrySource=await interviews.readFinalized(identity, row.retry_interview_id);
    const value = await agent.compare(row.input, signal, task.attempts > 1, {runtime_version:retrySource.snapshot!.runtime_version,model:retrySource.snapshot!.model});
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
    prepare,
    async isEvaluationCancelled(task: Readonly<TaskRow>) {
      const input = task.payload as {
        interview_id: string;
        report_id: string;
        report_version: number;
        turn_id: string;
        evaluation_input_digest?: string;
        input_digest: string;
      };
      const state = await interviews.readAnalysisState(
        { owner_id: task.owner_id, roles: [] },
        input.interview_id,
      );
      const row = await repository.reportByInterview(
        database.pool,
        task.owner_id,
        input.interview_id,
      );
      const turn = state.view.turns.find(
        (t) => t.id === input.turn_id && t.answer_status === 'answered',
      );
      return (
        !row ||
        row.id !== input.report_id ||
        row.version !== input.report_version ||
        !turn ||
        (input.evaluation_input_digest
          ? turnDigest(state, turn) !== input.evaluation_input_digest
          : interviewInputDigest(state) !== input.input_digest)
      );
    },
    getComparison,
    async request(identity: RequestIdentity, id: string, body: ReportRequest, key: string) {
      await withIdempotency(
        database,
        { owner_id: identity.owner_id, operation: `reports.${id}.request`, key, input: body },
        async (tx) => {
          await interviews.lock(tx, identity, id);
          const state = await interviews.readReportState(identity, id, tx);
          if (!['completed', 'failed'].includes(state.view.status) || !state.snapshot)
            throw new ServiceError('invalid_state', 409, '请先结束面试');
          let row = await repository.reportByInterview(tx.client, identity.owner_id, id, true);
          if (!row) {
            await seal(tx, state);
            row = await repository.reportByInterview(tx.client, identity.owner_id, id);
          }
          if (!row?.result) throw new ServiceError('not_found', 404, '报告尚未请求');
          if (row.version !== body.version)
            throw new ServiceError('version_conflict', 409, '报告版本已更新');
          const results = await repository.evaluationRows(tx.client, row.id);
          const report = aggregateReport(
            state,
            {
              ...row.result,
              version: row.version,
              status: row.status as InterviewReport['status'],
            },
            results,
          );
          if (body.scope === 'latest') {
            const digest = interviewInputDigest(state);
            if (row.input_digest === digest) return { id };
            const version = row.version + 1;
            const next = { ...emptyReport(state, row.id), version };
            // Reuse only unchanged answer contexts; a rewritten main answer also invalidates follow-up analysis.
            const reusable = results.filter(
              (r) =>
                r.result &&
                state.view.turns.some(
                  (t) => t.id === r.turn_id && r.evaluation_input_digest === turnDigest(state, t),
                ),
            );
            await repository.setSummaryTask(tx.client, row.id, null, null);
            await repository.updateInputDigest(tx.client, row.id, digest);
            await queueEvaluations(
              tx,
              state,
              row.id,
              version,
              reusable.map((r) => r.turn_id),
            );
            await repository.updateReport(tx.client, row.id, version, next);
            return { id };
          }
          // A pending summary must finish before a new report version can invalidate its input.
          if (['pending', 'generating'].includes(row.status)) return { id };
          if (
            body.scope === 'rubric' &&
            (state.view.configuration.job !== 'frontend' ||
              state.view.configuration.career_stage !== 'internship')
          )
            throw new ServiceError(
              'unsupported_input',
              400,
              '当前行为锚定标准只适用于前端实习岗位',
            );
          if (body.scope === 'summary') {
            if (
              (report.summary_status === 'ready' &&
                report.analysis_metadata?.prompt_version === REPORT_PROMPT_VERSION &&
                report.summary?.feedback_template?.version === FEEDBACK_TEMPLATE_VERSION &&
                report.summary?.dimension_assessments !== undefined) ||
              !report.evaluations.length
            )
              return { id };
          } else if (
            body.scope !== 'rubric' &&
            !report.missing_turn_ids.length &&
            row.status !== 'failed'
          )
            return { id };
          const version = row.version + 1;
          const next = {
            ...report,
            version,
            summary: null,
            summary_status: 'pending' as const,
            status: 'pending' as const,
          };
          if (body.scope === 'summary') await queueSummary(tx, state, next);
          else {
            await repository.setSummaryTask(tx.client, row.id, null, null);
            await queueEvaluations(
              tx,
              state,
              row.id,
              version,
              body.scope === 'rubric' ? [] : report.evaluations.map((e) => e.turn_id),
            );
          }
          await repository.updateReport(tx.client, row.id, version, next);
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
    handlers: {
      'reports.evaluate.v1': evaluate,
      'reports.summarize.v1': summarize,
      'comparisons.generate.v1': compare,
    },
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
          if (!['completed', 'failed'].includes(state.view.status)) return;
          state = await interviews.readReportState(
            { owner_id: row.owner_id, roles: [] },
            row.interview_id,
            tx,
          );
          const current = await repository.reportByInterview(
            tx.client,
            row.owner_id,
            row.interview_id,
            true,
          );
          if (
            !current ||
            !['pending', 'generating'].includes(current.status) ||
            current.input_digest !== interviewInputDigest(state)
          )
            return;
          const evaluations = await repository.evaluationRows(tx.client, row.id);
          const report = aggregateReport(
            state,
            { ...current.result!, version: current.version },
            evaluations,
          );
          if (report.analysis_progress!.pending) report.status = 'generating';
          else if (!report.evaluations.length) {
            report.status = report.analysis_progress!.total ? 'failed' : 'ready';
            report.summary_status = 'not_applicable';
          } else if (!report.evaluations.some((e) => e.strengths.length || e.gaps.length)) {
            report.status = 'ready';
            report.summary_status = 'not_applicable';
          } else if (!current.summary_task_id) {
            await queueSummary(tx, state, report);
          } else {
            const task = await repository.summaryTask(tx.client, current.summary_task_id);
            if (!task || taskSettled(task)) {
              // Summary publication is atomic with task success. A settled task without a summary is a failure.
              report.summary_status = report.summary ? 'ready' : 'failed';
              report.status = 'ready';
              report.is_partial ||= !report.summary;
            } else {
              report.status = 'generating';
              report.summary_status = task.task_status === 'running' ? 'generating' : 'pending';
            }
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
