import { randomUUID } from 'node:crypto';
import type {
  InterviewKnowledgeProvider,
  InterviewSnapshot,
  PersonalMaterial,
  RequestIdentity,
  ResumeAnalysis,
} from '@interviewlab/core';
import type { Database, Transaction } from '../../database/connection';
import type { BackendConfig } from '../../foundation/config';
import { ServiceError } from '../../foundation/errors';
import { inputDigest, withIdempotency } from '../../foundation/idempotency';
import { enqueueTask } from '../../tasks/service';
import type { TaskHandler } from '../../tasks/runner';
import type { ResumeAnalysisService } from '../resumes/analysis';
import type { MaterialsService } from '../resumes/service';
import {
  loadInterview,
  saveInterview,
  cancelInterviewTasks,
  type InterviewState,
} from './repository';
import { materialFields, type WorkflowModels } from './workflow-models';
import { interviewPolicy } from '@interviewlab/core';
import { COMPETENCIES, PROFILE_GOALS, planningRoleContext } from '../knowledge/catalog';

export const preparationDigest = (state: InterviewState) =>
  inputDigest({ configuration: state.view.configuration, snapshot: state.snapshot });
export function simpleResume(material: PersonalMaterial | undefined): ResumeAnalysis | undefined {
  if (!material) return;
  return {
    facts: Object.entries(materialFields(material))
      .filter(([, v]) => v.trim() && !v.includes('[已移除]'))
      .slice(0, 8)
      .map(([field, value]) => {
        const quote = value.slice(0, 500);
        return {
          kind: field === 'skills' ? ('skill' as const) : ('experience' as const),
          text: quote,
          evidence: { material_id: material.id, version: material.version, field, quote },
        };
      }),
    clarification_points: [],
  };
}
export function createInterviewPreparation(
  database: Database,
  config: BackendConfig,
  knowledge: InterviewKnowledgeProvider,
  materials: MaterialsService,
  analyses: ResumeAnalysisService,
  models: WorkflowModels,
) {
  async function materialFor(
    owner: string,
    snapshot: InterviewSnapshot,
  ): Promise<PersonalMaterial | undefined> {
    const ref = snapshot.personal_material;
    if (!ref) return;
    const m = (await materials.versions(owner, ref.id)).find((v) => v.version === ref.version);
    if (!m?.confirmed || m.kind !== 'resume')
      throw new ServiceError('not_found', 404, '已选简历版本不可用');
    return m;
  }
  async function schedule(tx: Transaction, state: InterviewState) {
    const snapshot = state.snapshot!;
    const material = snapshot.personal_material;
    if (material) {
      await analyses.enqueue(tx, state.owner, material, true, snapshot.model);
      const analysis = await analyses.find(state.owner, material, tx, snapshot.model);
      if (!analysis?.result) {
        state.view.preparation = {
          status: analysis ? 'waiting_material' : 'failed',
          task_id: analysis?.task_id ?? null,
          error_code: analysis ? null : 'capability_unavailable',
        };
        return;
      }
      snapshot.resume_analysis = analysis.result;
    }
    const task = await enqueueTask(tx, {
      owner_id: state.owner,
      type: 'preparation.plan.v1',
      key: `${state.view.id}:${randomUUID()}`,
      input: { interview_id: state.view.id, input_digest: preparationDigest(state) },
    });
    state.view.preparation = { status: 'pending', task_id: task.id, error_code: null };
  }
  async function request(
    identity: RequestIdentity,
    id: string,
    body: { version: number; mode: 'personalized' | 'fallback' },
    key: string,
  ) {
    const before = await loadInterview(database.pool, identity.owner_id, id);
    if (before.retryQuestion || !before.view.preparation)
      throw new ServiceError('invalid_state', 409, '当前面试不需要准备');
    let snapshot = before.snapshot;
    if (!snapshot) {
      const ref = before.view.configuration.resume_ref;
      const material = ref
        ? (await materials.versions(identity.owner_id, ref.id)).find(
            (v) => v.version === ref.version && v.confirmed && v.kind === 'resume',
          )
        : undefined;
      if (ref && !material) throw new ServiceError('not_found', 404, '已选简历不可用');
      snapshot = {
        runtime_version: 'graph-v1',
        interview_type: before.view.configuration.interview_type,
        job_title:
          (await import('../../content/index')).getJob(before.view.configuration.job)?.title ??
          before.view.configuration.job,
        personal_material: material,
        knowledge: await knowledge.read(before.view.configuration),
        model: config.LLM_MODEL,
        prompt_version: 'interview-policy-v3',
        rubric_version: 'evidence-uncalibrated-v1',
      };
    }
    await materialFor(identity.owner_id, snapshot);
    await withIdempotency(
      database,
      { owner_id: identity.owner_id, operation: `interview.${id}.prepare`, key, input: body },
      async (tx) => {
        const state = await loadInterview(tx.client, identity.owner_id, id, true);
        if (state.view.version !== body.version || state.view.status !== 'ready')
          throw new ServiceError('version_conflict', 409, '面试配置已更新');
        if (
          ['pending', 'waiting_material', 'ready', 'fallback'].includes(
            state.view.preparation?.status ?? '',
          ) &&
          state.snapshot &&
          body.mode !== 'fallback'
        )
          return { id };
        await cancelInterviewTasks(tx.client, id);
        state.snapshot = snapshot!;
        if (body.mode === 'fallback') {
          state.snapshot.resume_analysis = simpleResume(state.snapshot.personal_material);
          state.snapshot.preparation_plan = {
            role_context: planningRoleContext(state.view.configuration),
            policy: interviewPolicy(state.view.configuration),
            goals: PROFILE_GOALS[state.view.configuration.interview_type].map((goal) => ({
              goal,
              focus: COMPETENCIES.find((g) => g.id === goal)!.evidence_wanted,
              material_refs: [],
            })),
            limitations: ['用户选择简化流程，未获得完整模型规划。'],
          };
          state.view.preparation = { status: 'fallback', task_id: null, error_code: null };
        } else await schedule(tx, state);
        state.view.version++;
        await saveInterview(tx.client, state);
        return { id };
      },
    );
    return (await loadInterview(database.pool, identity.owner_id, id)).view;
  }
  const handler: TaskHandler = async (task, signal) => {
    const input = task.payload as { interview_id: string; input_digest: string };
    const state = await loadInterview(database.pool, task.owner_id, input.interview_id);
    if (
      state.view.status !== 'ready' ||
      state.view.preparation?.task_id !== task.id ||
      preparationDigest(state) !== input.input_digest
    )
      return { result_ref: null };
    await materialFor(task.owner_id, state.snapshot!);
    const plan = await models.prepare(
      state.view.configuration,
      state.snapshot!.knowledge,
      state.snapshot!.resume_analysis,
      signal,
      task.attempts > 1,
      state.snapshot!.model,
    );
    return {
      result_ref: { id: state.view.id, version: state.view.version + 1 },
      lock: async (tx) => {
        try {
          await loadInterview(tx.client, task.owner_id, input.interview_id, true);
          const m = state.snapshot!.personal_material;
          if (
            m &&
            !(
              await tx.client.query(
                'SELECT id FROM resume_materials WHERE id=$1 AND owner_id=$2 AND NOT deleted FOR SHARE',
                [m.id, task.owner_id],
              )
            ).rowCount
          )
            return false;
          return true;
        } catch {
          return false;
        }
      },
      commit: async (tx) => {
        const fresh = await loadInterview(tx.client, task.owner_id, input.interview_id, true);
        if (
          fresh.view.status !== 'ready' ||
          fresh.view.preparation?.task_id !== task.id ||
          preparationDigest(fresh) !== input.input_digest
        )
          return false;
        fresh.snapshot!.preparation_plan = plan;
        fresh.view.preparation = { status: 'ready', task_id: null, error_code: null };
        fresh.view.version++;
        await saveInterview(tx.client, fresh);
      },
    };
  };
  return {
    request,
    handlers: { 'preparation.plan.v1': handler },
    async initialize(identity: RequestIdentity, id: string) {
      const current = await loadInterview(database.pool, identity.owner_id, id);
      if (!current.view.preparation) return current.view;
      try {
        return await request(
          identity,
          id,
          { version: current.view.version, mode: 'personalized' },
          `initial:${id}`,
        );
      } catch {
        await database.transaction(async (tx) => {
          const state = await loadInterview(tx.client, identity.owner_id, id, true);
          if (
            state.view.status === 'ready' &&
            state.view.preparation?.status === 'pending' &&
            !state.view.preparation.task_id
          ) {
            state.view.preparation = {
              status: 'failed',
              task_id: null,
              error_code: 'preparation_unavailable',
            };
            state.view.version++;
            await saveInterview(tx.client, state);
          }
        });
        return (await loadInterview(database.pool, identity.owner_id, id)).view;
      }
    },
    async maintain() {
      const rows = await database.pool.query<{ id: string; owner_id: string }>(
        `SELECT id,owner_id FROM interviews WHERE deleted_at IS NULL AND status='ready' AND preparation->>'status' IN ('waiting_material','pending') ORDER BY created_at LIMIT 100`,
      );
      for (const row of rows.rows) {
        const before = await loadInterview(database.pool, row.owner_id, row.id);
        let material: PersonalMaterial | undefined;
        try {
          if (before.snapshot) material = await materialFor(row.owner_id, before.snapshot);
        } catch {
          await database.transaction(async (tx) => {
            const state = await loadInterview(tx.client, row.owner_id, row.id, true);
            if (
              state.view.status !== 'ready' ||
              state.view.version !== before.view.version ||
              !['waiting_material', 'pending'].includes(state.view.preparation?.status ?? '')
            )
              return;
            await cancelInterviewTasks(tx.client, row.id);
            state.view.preparation = {
              status: 'failed',
              task_id: null,
              error_code: 'material_unavailable',
            };
            state.view.version++;
            await saveInterview(tx.client, state);
          });
          continue;
        }
        const analysis = material
          ? await analyses.find(row.owner_id, material, undefined, before.snapshot!.model)
          : undefined;
        await database.transaction(async (tx) => {
          const state = await loadInterview(tx.client, row.owner_id, row.id, true),
            p = state.view.preparation;
          if (state.view.status !== 'ready' || !p || state.view.version !== before.view.version)
            return;
          if (p.status === 'waiting_material') {
            if (analysis?.result) {
              await schedule(tx, state);
              state.view.version++;
              await saveInterview(tx.client, state);
            } else if (
              !analysis ||
              analysis.status === 'cancelled' ||
              (analysis.status === 'failed' && analysis.attempts >= analysis.max_attempts)
            ) {
              state.view.preparation = {
                status: 'failed',
                task_id: null,
                error_code: 'resume_analysis_failed',
              };
              state.view.version++;
              await saveInterview(tx.client, state);
            }
          } else if (p.status === 'pending' && p.task_id) {
            const t = (
              await tx.client.query('SELECT status,attempts,max_attempts FROM tasks WHERE id=$1', [
                p.task_id,
              ])
            ).rows[0];
            if (
              !t ||
              t.status === 'cancelled' ||
              (t.status === 'failed' && t.attempts >= t.max_attempts)
            ) {
              state.view.preparation = {
                status: 'failed',
                task_id: null,
                error_code: 'preparation_failed',
              };
              state.view.version++;
              await saveInterview(tx.client, state);
            }
          }
        });
      }
    },
  };
}
export type InterviewPreparationService = ReturnType<typeof createInterviewPreparation>;
