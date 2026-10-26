import { config as dotenv } from 'dotenv';
import { Pool } from 'pg';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { loadConfig } from '../../foundation/config';
import { readKnowledgeSeed, checksum, embed, tokens } from './service';
async function main() {
  dotenv({ quiet: true });
  const config = loadConfig();
  const action = process.argv[2];
  const path = process.argv[3];
  if (action === 'review') {
    const reviewer = process.argv[4];
    if (!path || !reviewer) throw new Error('review requires file and human reviewer identity');
    const seed = await readKnowledgeSeed(path);
    seed.review_state = 'reviewed';
    seed.reviewer = reviewer;
    seed.sources.forEach((s) => (s.reviewed_at = new Date().toISOString().slice(0, 10)));
    await writeFile(path, JSON.stringify(seed, null, 2) + '\n');
    console.log('Human review attestation recorded');
    return;
  }
  if (!config.KNOWLEDGE_DATABASE_URL) throw new Error('KNOWLEDGE_DATABASE_URL required');
  const pool = new Pool({ connectionString: config.KNOWLEDGE_DATABASE_URL });
  try {
    if (action === 'migrate') {
      await pool.query(
        await readFile(fileURLToPath(new URL('./migrate.sql', import.meta.url)), 'utf8'),
      );
      console.log('Knowledge schema ready');
      return;
    }
    if (action === 'retire' || action === 'rollback') {
      if (!path) throw new Error('Release id required');
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query("SELECT pg_advisory_xact_lock(hashtext('knowledge-release'))");
        if (action === 'retire')
          await client.query(
            "UPDATE knowledge_releases SET status='retired',active=false WHERE id=$1",
            [path],
          );
        else {
          const found = await client.query(
            "SELECT id FROM knowledge_releases WHERE id=$1 AND status='published'",
            [path],
          );
          if (!found.rowCount) throw new Error('Published release required');
          await client.query('UPDATE knowledge_releases SET active=false WHERE active');
          await client.query('UPDATE knowledge_releases SET active=true WHERE id=$1', [path]);
        }
        await client.query('COMMIT');
        console.log('Release updated');
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      } finally {
        client.release();
      }
      return;
    }
    if (!['preview', 'publish', 'validate'].includes(action))
      throw new Error('Use migrate/validate/preview/review/publish/retire/rollback');
    const seed = await readKnowledgeSeed(path);
    if (action === 'validate') {
      console.log(
        JSON.stringify({
          id: seed.id,
          cards: seed.cards.length,
          questions: seed.questions.length,
          review_state: seed.review_state,
        }),
      );
      return;
    }
    if (action === 'preview' && config.NODE_ENV === 'production')
      throw new Error('No draft preview in production');
    if (action === 'publish' && seed.review_state !== 'reviewed')
      throw new Error('Human review required before publication');
    const existing = await pool.query<{ checksum: string; status: string }>(
      'SELECT checksum,status FROM knowledge_releases WHERE id=$1',
      [seed.id],
    );
    if (existing.rowCount) {
      if (existing.rows[0].checksum !== checksum(seed))
        throw new Error('Release is immutable; use a new id');
      console.log('Identical release already imported');
      return;
    }
    const chunks = seed.cards.flatMap((c) => {
      const parts: string[] = [];
      for (let at = 0; at < c.text.length; at += 550) {
        parts.push(c.text.slice(at, at + 650));
        if (at + 650 >= c.text.length) break;
      }
      return parts.map((text, i) => ({ ...c, text, id: `${c.id}-${i}`, card_id: c.id }));
    });
    const vectors: number[][] = [];
    for (let i = 0; i < chunks.length; i += 6)
      vectors.push(
        ...(await embed(
          config,
          chunks.slice(i, i + 6).map((c) => c.text),
        )),
      );
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query("SELECT pg_advisory_xact_lock(hashtext('knowledge-release'))");
      await client.query('UPDATE knowledge_releases SET active=false WHERE active');
      await client.query(
        'INSERT INTO knowledge_releases(id,status,active,body,checksum) VALUES($1,$2,true,$3,$4)',
        [seed.id, action === 'publish' ? 'published' : 'draft', seed, checksum(seed)],
      );
      for (let i = 0; i < chunks.length; i++) {
        const c = chunks[i];
        await client.query(
          'INSERT INTO knowledge_chunks(id,release,card_id,job,stages,types,goals,text,terms,source_refs,embedding) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::vector)',
          [
            c.id,
            seed.id,
            c.card_id,
            c.job,
            c.stages,
            c.types,
            c.goals,
            c.text,
            tokens(c.text),
            c.source_refs,
            JSON.stringify(vectors[i]),
          ],
        );
      }
      await client.query('COMMIT');
      console.log(
        JSON.stringify({
          id: seed.id,
          status: action === 'publish' ? 'published' : 'draft',
          chunks: chunks.length,
          dimensions: 1024,
        }),
      );
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
}
main().catch(() => {
  console.error(
    'Knowledge command failed; check configuration, schema and review state (private details suppressed)',
  );
  process.exitCode = 1;
});
