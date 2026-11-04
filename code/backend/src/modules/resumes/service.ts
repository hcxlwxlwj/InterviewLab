import { randomUUID } from 'node:crypto';
import type { PersonalMaterial } from '@interviewlab/core';
import type { Database } from '../../database/connection';
import type { ResumeAnalysisService } from './analysis';
import { ServiceError } from '../../foundation/errors';
export function createMaterialsService(database: Database, analysis?: ResumeAnalysisService, autoAnalyze = false) {
  async function list(owner: string): Promise<PersonalMaterial[]> {
    const result = await database.pool.query(
      `SELECT v.data FROM resume_materials m JOIN LATERAL
      (SELECT data FROM resume_material_versions WHERE id=m.id ORDER BY version DESC LIMIT 1) v ON true
      WHERE m.owner_id=$1 AND NOT m.deleted ORDER BY m.id`,
      [owner],
    );
    return Promise.all(result.rows.map(async (row) => ({...row.data, ...(analysis ? {analysis:await analysis.status(owner,row.data)} : {})})));
  }
  async function versions(owner: string, id: string): Promise<PersonalMaterial[]> {
    const result = await database.pool.query(
      `SELECT v.data FROM resume_material_versions v JOIN resume_materials m ON m.id=v.id
      WHERE m.id=$1 AND m.owner_id=$2 AND NOT m.deleted ORDER BY v.version DESC`,
      [id, owner],
    );
    if (!result.rows.length) throw new ServiceError('not_found', 404, '材料不存在');
    return Promise.all(result.rows.map(async (row) => ({...row.data, ...(analysis ? {analysis:await analysis.status(owner,row.data)} : {})})));
  }
  async function save(
    owner: string,
    input: Pick<PersonalMaterial, 'kind' | 'title' | 'text' | 'confirmed' | 'structure'>,
    id?: string,
    expected?: number,
  ) {
    if (!input.text.trim() && !Object.values(input.structure ?? {}).some(value=>value.trim())) throw new ServiceError('unsupported_input',400,'请填写简历内容');
    return database.transaction(async (tx) => {
      const {client}=tx;
      const materialId = id ?? randomUUID();
      let version = 1;
      if (id) {
        const lock = await client.query(
          'SELECT id FROM resume_materials WHERE id=$1 AND owner_id=$2 AND NOT deleted FOR UPDATE',
          [id, owner],
        );
        if (!lock.rowCount) throw new ServiceError('not_found', 404, '材料不存在');
        const latest = await client.query(
          'SELECT max(version) AS version FROM resume_material_versions WHERE id=$1',
          [id],
        );
        if (latest.rows[0].version !== expected)
          throw new ServiceError('version_conflict', 409, '材料已更新，请刷新后重试');
        const original = await client.query('SELECT kind FROM resume_materials WHERE id=$1', [id]);
        if (original.rows[0].kind !== input.kind)
          throw new ServiceError('unsupported_input', 400, '不能改变材料类型');
        version = expected! + 1;
      } else
        await client.query('INSERT INTO resume_materials(id,owner_id,kind) VALUES($1,$2,$3)', [
          materialId,
          owner,
          input.kind,
        ]);
      const data: PersonalMaterial = {
        structure: input.structure,
        kind: input.kind,
        title: input.title,
        text: input.text,
        confirmed: input.confirmed,
        id: materialId,
        version,
        created_at: new Date().toISOString(),
      };
      await client.query('INSERT INTO resume_material_versions(id,version,data) VALUES($1,$2,$3)', [
        materialId,
        version,
        JSON.stringify(data),
      ]);
      if(autoAnalyze)await analysis?.enqueue(tx,owner,data);
      return data;
    });
  }
  async function remove(owner: string, id: string) {
    await database.transaction(async(tx)=>{
      const result=await tx.client.query('UPDATE resume_materials SET deleted=true WHERE id=$1 AND owner_id=$2 AND NOT deleted RETURNING id',[id,owner]);
      if(!result.rowCount)throw new ServiceError('not_found',404,'材料不存在');
      await tx.client.query("UPDATE tasks SET status='cancelled',execution_token=NULL,lease_until=NULL WHERE owner_id=$1 AND type='resumes.analyze.v1' AND payload->>'material_id'=$2 AND status IN ('queued','running','failed')",[owner,id]);
      await tx.client.query('DELETE FROM resume_analyses WHERE owner_id=$1 AND material_id=$2',[owner,id]);
    });
  }
  async function requireResume(owner: string, id: string) {
    const [latest] = await versions(owner, id);
    if (latest.kind !== 'resume' || !latest.confirmed)
      throw new ServiceError('unsupported_input', 400, '请选择已确认的简历');
  }
  return { list, versions, save, remove, requireResume,
    async analyze(owner:string,id:string,version:number,key:string) {
      if(!analysis)throw new ServiceError('capability_unavailable',501,'简历分析未启用');
      const material=(await versions(owner,id)).find(m=>m.version===version);
      if(!material)throw new ServiceError('not_found',404,'简历版本不存在');
      return analysis.request(owner,material,key);
    },
  };
}
export type MaterialsService = ReturnType<typeof createMaterialsService>;
