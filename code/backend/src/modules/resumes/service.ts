import { randomUUID } from 'node:crypto';
import type { PersonalMaterial } from '@interviewlab/core';
import type { Database } from '../../database/connection';
import { ServiceError } from '../../foundation/errors';
export function createMaterialsService(database: Database) {
  async function list(owner: string): Promise<PersonalMaterial[]> {
    const result = await database.pool.query(
      `SELECT v.data FROM resume_materials m JOIN LATERAL
      (SELECT data FROM resume_material_versions WHERE id=m.id ORDER BY version DESC LIMIT 1) v ON true
      WHERE m.owner_id=$1 AND NOT m.deleted ORDER BY m.id`,
      [owner],
    );
    return result.rows.map((row) => row.data);
  }
  async function versions(owner: string, id: string): Promise<PersonalMaterial[]> {
    const result = await database.pool.query(
      `SELECT v.data FROM resume_material_versions v JOIN resume_materials m ON m.id=v.id
      WHERE m.id=$1 AND m.owner_id=$2 AND NOT m.deleted ORDER BY v.version DESC`,
      [id, owner],
    );
    if (!result.rows.length) throw new ServiceError('not_found', 404, '材料不存在');
    return result.rows.map((row) => row.data);
  }
  async function save(
    owner: string,
    input: Pick<PersonalMaterial, 'kind' | 'title' | 'text' | 'confirmed'>,
    id?: string,
    expected?: number,
  ) {
    return database.transaction(async ({ client }) => {
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
      return data;
    });
  }
  async function remove(owner: string, id: string) {
    const result = await database.pool.query(
      'UPDATE resume_materials SET deleted=true WHERE id=$1 AND owner_id=$2 AND NOT deleted',
      [id, owner],
    );
    if (!result.rowCount) throw new ServiceError('not_found', 404, '材料不存在');
  }
  async function requireResume(owner: string, id: string) {
    const [latest] = await versions(owner, id);
    if (latest.kind !== 'resume' || !latest.confirmed)
      throw new ServiceError('unsupported_input', 400, '请选择已确认的简历');
  }
  return { list, versions, save, remove, requireResume };
}
export type MaterialsService = ReturnType<typeof createMaterialsService>;
