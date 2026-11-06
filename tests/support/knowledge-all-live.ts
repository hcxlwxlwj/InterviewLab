/** Small real-embedding smoke in an explicitly named test database. Never activates a release. */
import { config as dotenv } from 'dotenv';
import { Pool } from 'pg';
import { mkdir, writeFile } from 'node:fs/promises';
import { readFile } from 'node:fs/promises';
import { JOBS } from '../../code/backend/src/content/index';
import { loadConfig } from '../../code/backend/src/foundation/config';
import {
  buildCatalog,
  contentHash,
  catalogTerms as tokens,
} from '../../code/backend/src/modules/knowledge/catalog';
import { embed } from '../../code/backend/src/modules/knowledge/embedding';
import { createAllRoleKnowledge } from '../../code/backend/src/modules/knowledge/all-roles';
import { testDatabaseUrl } from './test-database';
import type { InterviewConfig } from '@interviewlab/core';
async function main() {
  dotenv({ quiet: true });
  const url = testDatabaseUrl();
  const config = loadConfig({
    NODE_ENV: 'test',
    KNOWLEDGE_DATABASE_URL: url,
    KNOWLEDGE_PREVIEW: 'true',
    LLM_API_KEY: process.env.LLM_API_KEY,
    LLM_BASE_URL: process.env.LLM_BASE_URL,
  });
  const pool = new Pool({ connectionString: url }),
    knowledge = createAllRoleKnowledge(config);
  const release = `all-roles-embedding-smoke-${Date.now()}`,
    docs = buildCatalog().filter((d) => d.kind === 'professional');
  const records: object[] = [];
  try {
    await pool.query(await readFile('code/backend/src/modules/knowledge/migrate-v2.sql', 'utf8'));
    await pool.query(
      "INSERT INTO knowledge_v2_releases(id,checksum,manifest,status,active) VALUES($1,$2,$3,'draft',false)",
      [release, contentHash(docs), { test_only: true, documents: docs.length }],
    );
    for (let at = 0; at < docs.length; at += 6) {
      const batch = docs.slice(at, at + 6),
        vectors = await embed(
          config,
          batch.map((d) => d.text),
        );
      for (let i = 0; i < batch.length; i++) {
        const d = batch[i],
          hash = contentHash(d.text);
        await pool.query(
          'INSERT INTO knowledge_v2_vectors(hash,model,embedding) VALUES($1,$2,$3::vector) ON CONFLICT DO NOTHING',
          [hash, config.EMBEDDING_MODEL, JSON.stringify(vectors[i])],
        );
        await pool.query(
          'INSERT INTO knowledge_v2_chunks(release,id,hash,model,card_id,kind,body,terms,source_refs,evidence_level) VALUES($1,$2,$3,$4,$2,$5,$6,$7,$8,$9)',
          [
            release,
            d.id,
            hash,
            config.EMBEDDING_MODEL,
            d.kind,
            d.text,
            tokens(d.text),
            d.source_refs,
            d.evidence_level,
          ],
        );
        for (const b of d.bindings)
          await pool.query(
            'INSERT INTO knowledge_v2_bindings(release,chunk_id,job,stages,types,goals) VALUES($1,$2,$3,$4,$5,$6)',
            [release, d.id, b.job, b.stages, b.types, b.goals],
          );
      }
    }
    for (const d of docs) {
      const binding = d.bindings[0],
        job = JOBS.find((j) => j.id === binding.job)!;
      const c: InterviewConfig = {
        job: job.id,
        career_stage: job.stages[0],
        interview_type: 'technical_qa',
        difficulty: '基础',
        duration_minutes: 10,
        interviewer_style: '标准',
        interaction_mode: 'text_fallback',
      };
      const k = { ...(await knowledge.read(c)), content_version: release };
      const begin = performance.now();
      const found = await knowledge.search(
        c,
        k,
        ['understanding', 'verification'],
        d.text.slice(0, 80),
      );
      records.push({
        family: job.category_id,
        expected: d.id,
        hit: found.chunks.some((x) => x.card_id === d.id),
        elapsed_ms: performance.now() - begin,
      });
    }
    await mkdir('tests/artifacts', { recursive: true });
    await writeFile(
      'tests/artifacts/knowledge-all-live.json',
      JSON.stringify(
        {
          release,
          limitations:
            '九类基础摘要的真实嵌入冒烟，不代表1000岗位专业语义质量验收；不激活发布版本。',
          records,
        },
        null,
        2,
      ),
    );
    console.log(
      JSON.stringify({
        queries: records.length,
        hits: records.filter((r) => 'hit' in r && r.hit).length,
      }),
    );
  } finally {
    await knowledge.close();
    await pool.end();
  }
}
main().catch(() => {
  console.error('Real embedding smoke failed; private configuration suppressed');
  process.exitCode = 1;
});
