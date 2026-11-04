import { randomUUID } from 'node:crypto';
import type { PersonalMaterial, ResumeAnalysis, MaterialAnalysisStatus } from '@interviewlab/core';
import type { Database, Transaction } from '../../database/connection';
import type { BackendConfig } from '../../foundation/config';
import { inputDigest, withIdempotency } from '../../foundation/idempotency';
import { ServiceError } from '../../foundation/errors';
import { enqueueTask } from '../../tasks/service';
import type { TaskHandler } from '../../tasks/runner';
import {
  RESUME_ANALYSIS_VERSION,
  materialFields,
  type WorkflowModels,
} from '../interviews/workflow-models';

interface AnalysisRow {
  id: string;
  task_id: string;
  result: ResumeAnalysis | null;
  status: string;
  attempts: number;
  max_attempts: number;
}
export function createResumeAnalysis(
  database: Database,
  config: BackendConfig,
  models: WorkflowModels,
) {
  async function find(
    owner: string,
    material: PersonalMaterial,
    tx?: Transaction,
    model = config.LLM_MODEL,
  ) {
    return (
      await (tx?.client ?? database.pool).query<AnalysisRow>(
        `SELECT a.*,t.status,t.attempts,t.max_attempts FROM resume_analyses a JOIN tasks t ON t.id=a.task_id
      WHERE a.owner_id=$1 AND a.material_id=$2 AND a.material_version=$3 AND a.input_digest=$4 AND a.model=$5 AND a.prompt_version=$6`,
        [
          owner,
          material.id,
          material.version,
          inputDigest(materialFields(material)),
          model,
          RESUME_ANALYSIS_VERSION,
        ],
      )
    ).rows[0];
  }
  async function enqueue(
    tx: Transaction,
    owner: string,
    material: PersonalMaterial,
    retry = false,
    model = config.LLM_MODEL,
  ) {
    if (material.kind !== 'resume' || !material.confirmed || !config.LLM_API_KEY) return;
    await tx.client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
      `resume:${owner}:${material.id}:${material.version}`,
    ]);
    const existing = await find(owner, material, tx, model);
    if (
      existing?.result ||
      (existing &&
        !(retry && existing.status === 'failed' && existing.attempts >= existing.max_attempts))
    )
      return;
    const id = existing?.id ?? randomUUID(),
      run = randomUUID(),
      digest = inputDigest(materialFields(material));
    const task = await enqueueTask(tx, {
      owner_id: owner,
      type: 'resumes.analyze.v1',
      key: `${id}:${run}`,
      input: {
        analysis_id: id,
        material_id: material.id,
        material_version: material.version,
        input_digest: digest,
        model,
      },
    });
    await tx.client.query(
      `INSERT INTO resume_analyses(id,owner_id,material_id,material_version,input_digest,model,prompt_version,task_id)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(id) DO UPDATE SET task_id=EXCLUDED.task_id,result=NULL`,
      [id, owner, material.id, material.version, digest, model, RESUME_ANALYSIS_VERSION, task.id],
    );
  }
  async function status(
    owner: string,
    material: PersonalMaterial,
  ): Promise<MaterialAnalysisStatus> {
    const row = await find(owner, material);
    if (!row) return { status: 'unavailable', task_id: null };
    return {
      status: row.result
        ? 'ready'
        : row.status === 'cancelled' ||
            (row.status === 'failed' && row.attempts >= row.max_attempts)
          ? 'failed'
          : 'pending',
      task_id: row.task_id,
    };
  }
  const handler: TaskHandler = async (task, signal) => {
    const input = task.payload as {
      analysis_id: string;
      material_id: string;
      material_version: number;
      input_digest: string;
      model: string;
    };
    const row = await database.pool.query<{ data: PersonalMaterial }>(
      `SELECT v.data FROM resume_material_versions v JOIN resume_materials m ON m.id=v.id
      WHERE m.id=$1 AND m.owner_id=$2 AND NOT m.deleted AND v.version=$3`,
      [input.material_id, task.owner_id, input.material_version],
    );
    const material = row.rows[0]?.data;
    if (!material?.confirmed || inputDigest(materialFields(material)) !== input.input_digest)
      return { result_ref: null };
    const result = await models.analyze(material, signal, task.attempts > 1, input.model);
    return {
      result_ref: { id: input.analysis_id, version: input.material_version },
      lock: async (tx) =>
        Boolean(
          (
            await tx.client.query(
              'SELECT id FROM resume_materials WHERE id=$1 AND owner_id=$2 AND NOT deleted FOR UPDATE',
              [input.material_id, task.owner_id],
            )
          ).rowCount,
        ),
      commit: async (tx) =>
        Boolean(
          (
            await tx.client.query(
              'UPDATE resume_analyses SET result=$1 WHERE id=$2 AND task_id=$3 AND input_digest=$4',
              [result, input.analysis_id, task.id, input.input_digest],
            )
          ).rowCount,
        ),
    };
  };
  return {
    enqueue,
    status,
    find,
    handlers: { 'resumes.analyze.v1': handler },
    async request(owner: string, material: PersonalMaterial, key: string) {
      if (!material.confirmed || material.kind !== 'resume')
        throw new ServiceError('unsupported_input', 400, '请先确认简历');
      if (!config.LLM_API_KEY)
        throw new ServiceError('capability_unavailable', 501, '模型尚未配置');
      await withIdempotency(
        database,
        {
          owner_id: owner,
          operation: `resume.${material.id}.analysis`,
          key,
          input: { version: material.version },
        },
        async (tx) => {
          const lock = await tx.client.query(
            'SELECT id FROM resume_materials WHERE id=$1 AND owner_id=$2 AND NOT deleted FOR UPDATE',
            [material.id, owner],
          );
          if (!lock.rowCount) throw new ServiceError('not_found', 404, '材料不存在');
          await enqueue(tx, owner, material, true);
          return { id: material.id };
        },
      );
      return status(owner, material);
    },
  };
}
export type ResumeAnalysisService = ReturnType<typeof createResumeAnalysis>;
