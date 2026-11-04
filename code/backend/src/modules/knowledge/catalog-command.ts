import { config as dotenv } from 'dotenv';
import { Pool } from 'pg';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { loadConfig } from '../../foundation/config';
import { buildCatalog, catalogManifest, contentHash, catalogTerms as tokens } from './catalog';
import { embed } from './embedding';

async function main() {
  dotenv({ quiet: true });
  const config = loadConfig();
  const [action = 'coverage', id, reviewer] = process.argv.slice(2);
  const documents = buildCatalog(),
    manifest = catalogManifest(documents);
  const summary = { ...manifest, lineage: undefined, sources: undefined };
  if (action === 'coverage') {
    console.log(JSON.stringify(summary, null, 2));
    return;
  }
  if (!config.KNOWLEDGE_DATABASE_URL) throw new Error('Knowledge database required');
  const pool = new Pool({ connectionString: config.KNOWLEDGE_DATABASE_URL });
  try {
    if (action === 'migrate') {
      await pool.query(
        await readFile(fileURLToPath(new URL('./migrate-v2.sql', import.meta.url)), 'utf8'),
      );
      return;
    }
    if (!id || !/^all-roles-[a-z0-9-]+$/.test(id))
      throw new Error('Use a versioned all-roles-* release id');
    if (action === 'build') {
      // Only one builder per release. A crash leaves complete chunks available for the next invocation.
      const lock = await pool.connect();
      try {
        await lock.query('SELECT pg_advisory_lock(hashtext($1))', [`catalog:${id}`]);
        const old = await lock.query(
          'SELECT checksum,status FROM knowledge_v2_releases WHERE id=$1',
          [id],
        );
        if (
          old.rowCount &&
          (old.rows[0].checksum !== manifest.checksum || old.rows[0].status !== 'building')
        )
          throw new Error('Release immutable or already built; use a new id');
        await lock.query(
          `INSERT INTO knowledge_v2_releases(id,checksum,manifest,status) VALUES($1,$2,$3,'building') ON CONFLICT DO NOTHING`,
          [id, manifest.checksum, manifest],
        );
        const cachedHashes = new Set(
          (
            await lock.query<{ hash: string }>(
              'SELECT hash FROM knowledge_v2_vectors WHERE model=$1',
              [config.EMBEDDING_MODEL],
            )
          ).rows.map((row) => row.hash),
        );
        const missing = new Map<string, string>();
        for (const doc of documents)
          for (let at = 0; at < doc.text.length; at += 550) {
            const body = doc.text.slice(at, at + 650),
              hash = contentHash(body);
            if (!cachedHashes.has(hash)) missing.set(hash, body);
            if (at + 650 >= doc.text.length) break;
          }
        const pending = [...missing];
        for (let at = 0; at < pending.length; at += 6) {
          const batch = pending.slice(at, at + 6);
          let vectors: number[][] = [];
          for (let attempt = 0; attempt < 2; attempt++) {
            try {
              vectors = await embed(
                config,
                batch.map(([, body]) => body),
              );
              break;
            } catch (error) {
              if (attempt === 1) throw error;
            }
          }
          for (let i = 0; i < batch.length; i++)
            await lock.query(
              'INSERT INTO knowledge_v2_vectors(hash,model,embedding) VALUES($1,$2,$3::vector) ON CONFLICT DO NOTHING',
              [batch[i][0], config.EMBEDDING_MODEL, JSON.stringify(vectors[i])],
            );
        }
        const completeChunks = new Set(
          (
            await lock.query<{ id: string }>(
              'SELECT id FROM knowledge_v2_chunks WHERE release=$1',
              [id],
            )
          ).rows.map((row) => row.id),
        );
        for (const doc of documents) {
          for (let at = 0; at < doc.text.length; at += 550) {
            const body = doc.text.slice(at, at + 650),
              chunkId = `${doc.id}:${at}`,
              hash = contentHash(body);
            if (!completeChunks.has(chunkId)) {
              await lock.query('BEGIN');
              try {
                await lock.query(
                  `INSERT INTO knowledge_v2_chunks(release,id,hash,model,card_id,kind,body,terms,source_refs,evidence_level) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
                  [
                    id,
                    chunkId,
                    hash,
                    config.EMBEDDING_MODEL,
                    doc.id,
                    doc.kind,
                    body,
                    tokens(body),
                    doc.source_refs,
                    doc.evidence_level,
                  ],
                );
                for (const b of doc.bindings)
                  await lock.query(
                    `INSERT INTO knowledge_v2_bindings(release,chunk_id,job,stages,types,goals) VALUES($1,$2,$3,$4,$5,$6)`,
                    [id, chunkId, b.job, b.stages, b.types, b.goals],
                  );
                await lock.query('COMMIT');
              } catch (error) {
                await lock.query('ROLLBACK');
                throw error;
              }
            }
            if (at + 650 >= doc.text.length) break;
          }
        }
        await lock.query(
          "UPDATE knowledge_v2_releases SET status='draft' WHERE id=$1 AND status='building'",
          [id],
        );
        console.log(JSON.stringify({ id, ...summary, status: 'draft' }));
      } finally {
        await lock.query('SELECT pg_advisory_unlock(hashtext($1))', [`catalog:${id}`]);
        lock.release();
      }
      return;
    }
    if (!['publish', 'preview', 'rollback', 'retire'].includes(action))
      throw new Error('Use coverage/migrate/build/publish/preview/rollback/retire');
    if (action === 'preview' && config.NODE_ENV === 'production')
      throw new Error('No production draft preview');
    if (action === 'publish' && !reviewer) throw new Error('Human review attestation required');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query("SELECT pg_advisory_xact_lock(hashtext('catalog-active'))");
      const release = await client.query(
        'SELECT status FROM knowledge_v2_releases WHERE id=$1 FOR UPDATE',
        [id],
      );
      if (!release.rowCount || release.rows[0].status === 'building')
        throw new Error('Complete release required');
      const coverage = await client.query(
        'SELECT count(DISTINCT job)::int AS count FROM knowledge_v2_bindings WHERE release=$1',
        [id],
      );
      if (coverage.rows[0].count !== manifest.jobs) throw new Error('Incomplete role coverage');
      if (action === 'rollback' && release.rows[0].status !== 'published')
        throw new Error('Published release required');
      if (action === 'preview' && release.rows[0].status !== 'draft')
        throw new Error('Draft release required');
      if (action === 'retire')
        await client.query(
          "UPDATE knowledge_v2_releases SET status='retired',active=false WHERE id=$1",
          [id],
        );
      else {
        await client.query('UPDATE knowledge_v2_releases SET active=false WHERE active');
        await client.query(
          `UPDATE knowledge_v2_releases SET active=true,status=CASE WHEN $2 THEN 'published' ELSE status END,
          manifest=CASE WHEN $2 THEN manifest||jsonb_build_object('reviewer',$3::text) ELSE manifest END WHERE id=$1`,
          [id, action === 'publish', reviewer ?? null],
        );
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
}
main().catch(() => {
  console.error(
    'All-role knowledge command failed; inspect configuration, release state and coverage. Private details suppressed.',
  );
  process.exitCode = 1;
});
