import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { Pool } from 'pg';
import { config as dotenv } from 'dotenv';
import { loadConfig } from '../../../code/backend/src/foundation/config';
import { createAllRoleKnowledge } from '../../../code/backend/src/modules/knowledge/all-roles';
import { JOBS } from '../../../code/backend/src/content/index';
import type { InterviewConfig } from '@interviewlab/core';

test(
  'full catalog imports into pgvector, resumes partial builds, keeps old releases and filters every retrieval by role and type',
  { timeout: 180000 },
  async () => {
    dotenv({ quiet: true });
    const url = process.env.TEST_DATABASE_URL;
    if (!url || !/^interviewlab_test[a-z0-9_]*$/.test(new URL(url).pathname.slice(1)))
      throw new Error('Dedicated knowledge test database required');
    let embeddingRequests = 0;
    const server = createServer(async (req, res) => {
      const parts: Buffer[] = [];
      for await (const chunk of req) parts.push(Buffer.from(chunk));
      const body = JSON.parse(Buffer.concat(parts).toString());
      embeddingRequests++;
      const inputs = body.input as string[];
      assert.ok(inputs.length <= 6);
      assert.ok(inputs.join('').length <= 6000);
      res.setHeader('content-type', 'application/json');
      res.end(
        JSON.stringify({
          data: inputs.map((_s, index) => ({ index, embedding: [1, ...Array(1023).fill(0)] })),
        }),
      );
    });
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    const port = (server.address() as { port: number }).port;
    const pool = new Pool({ connectionString: url });
    const run = (...args: string[]) =>
      new Promise<{ code: number | null; output: string }>((resolve, reject) => {
        const child = spawn(
          process.execPath,
          [
            'node_modules/tsx/dist/cli.mjs',
            'code/backend/src/modules/knowledge/catalog-command.ts',
            ...args,
          ],
          {
            windowsHide: true,
            env: {
              ...process.env,
              NODE_ENV: 'test',
              KNOWLEDGE_DATABASE_URL: url,
              LLM_BASE_URL: `http://127.0.0.1:${port}`,
              LLM_API_KEY: 'synthetic-embedding-test',
              KNOWLEDGE_PREVIEW: 'true',
            },
            stdio: ['ignore', 'pipe', 'pipe'],
          },
        );
        let output = '';
        child.stdout.on('data', (b) => (output += b));
        child.stderr.on('data', (b) => (output += b));
        child.on('error', reject);
        child.on('exit', (code) => resolve({ code, output }));
      });
    try {
      let result = await run('migrate');
      assert.equal(result.code, 0, result.output);
      await pool.query('TRUNCATE knowledge_v2_releases,knowledge_v2_vectors CASCADE');
      // Simulate an interrupted build: the exact manifest exists but no chunks have been committed.
      const { catalogManifest } = await import(
        '../../../code/backend/src/modules/knowledge/catalog'
      );
      const manifest = catalogManifest();
      await pool.query(
        "INSERT INTO knowledge_v2_releases(id,checksum,manifest,status) VALUES('all-roles-controlled-v1',$1,$2,'building')",
        [manifest.checksum, manifest],
      );
      result = await run('build', 'all-roles-controlled-v1');
      assert.equal(result.code, 0, result.output);
      const counts = (
        await pool.query(
          "SELECT count(DISTINCT job)::int AS jobs FROM knowledge_v2_bindings WHERE release='all-roles-controlled-v1'",
        )
      ).rows[0];
      assert.equal(counts.jobs, 1000);
      assert.equal(
        (
          await pool.query(
            "SELECT count(DISTINCT card_id)::int AS n FROM knowledge_v2_chunks WHERE kind='question'",
          )
        ).rows[0].n,
        8000,
      );
      assert.ok(embeddingRequests < 2000, 'embedding is batched and hash deduplicated');
      assert.equal(
        (
          await pool.query(
            "SELECT active FROM knowledge_v2_releases WHERE id='all-roles-controlled-v1'",
          )
        ).rows[0].active,
        false,
      );
      result = await run('preview', 'all-roles-controlled-v1');
      assert.equal(result.code, 0, result.output);
      const config = loadConfig({
        NODE_ENV: 'test',
        KNOWLEDGE_DATABASE_URL: url,
        KNOWLEDGE_PREVIEW: 'true',
        LLM_BASE_URL: `http://127.0.0.1:${port}`,
        LLM_API_KEY: 'synthetic',
      });
      const knowledge = createAllRoleKnowledge(config);
      try {
        for (const family of [...new Set(JOBS.map((j) => j.category_id))]) {
          const job = JOBS.find((j) => j.category_id === family)!;
          for (const type of ['technical_qa', 'hr'] as const) {
            const c: InterviewConfig = {
              job: job.id,
              career_stage: job.stages[0],
              interview_type: type,
              difficulty: '基础',
              duration_minutes: 10,
              interviewer_style: '标准',
              interaction_mode: 'text_fallback',
            };
            const k = await knowledge.read(c);
            assert.equal(k.content_version, 'all-roles-controlled-v1');
            knowledge.prefetch(c, k);
            const found = await knowledge.context(c, k, null, '', new AbortController().signal);
            assert.ok(found.chunks.length);
            for (const chunk of found.chunks) {
              assert.ok(
                (
                  await pool.query(
                    'SELECT 1 FROM knowledge_v2_bindings WHERE release=$1 AND chunk_id=$2 AND job=$3',
                    [k.content_version, chunk.id, job.id],
                  )
                ).rowCount,
              );
              if (type === 'hr')
                assert.ok(['job_profile', 'interview_method'].includes(chunk.kind!));
            }
          }
        }
        const job = JOBS[0];
        const c: InterviewConfig = {
          job: job.id,
          career_stage: job.stages[0],
          interview_type: 'technical_qa',
          difficulty: '基础',
          duration_minutes: 10,
          interviewer_style: '标准',
          interaction_mode: 'text_fallback',
        };
        const frozen = await knowledge.read(c);
        const stored = (
          await pool.query(
            "SELECT manifest FROM knowledge_v2_releases WHERE id='all-roles-controlled-v1'",
          )
        ).rows[0].manifest;
        assert.equal(stored.lineage[0].version, job.version);
        assert.equal(stored.lineage[0].review_method, job.review_method);
        assert.equal(stored.sources.length, manifest.sources.length);
        await pool.query(
          "UPDATE knowledge_v2_releases SET manifest=jsonb_set(manifest,'{lineage,0,version}',$1::jsonb) WHERE id='all-roles-controlled-v1'",
          [JSON.stringify(job.version + 1)],
        );
        assert.notEqual(
          (await knowledge.read(c)).content_version,
          'all-roles-controlled-v1',
          'new source versions cannot silently mix with an old active index',
        );
        await pool.query(
          "UPDATE knowledge_v2_releases SET manifest=$1 WHERE id='all-roles-controlled-v1'",
          [stored],
        );
        result = await run('retire', 'all-roles-controlled-v1');
        assert.equal(result.code, 0, result.output);
        const historic = await knowledge.search(c, frozen, ['contribution'], '本人职责');
        assert.ok(historic.chunks.length);
        assert.equal(historic.release, frozen.content_version);
      } finally {
        await knowledge.close();
      }
      const calls = embeddingRequests;
      result = await run('build', 'all-roles-controlled-v1');
      assert.notEqual(result.code, 0);
      assert.equal(embeddingRequests, calls, 'complete releases cannot be overwritten');
      result = await run('publish', 'all-roles-controlled-v1');
      assert.notEqual(result.code, 0, 'publication requires real review attestation');
      assert.equal(
        (
          await pool.query(
            "SELECT count(*)::int AS n FROM knowledge_v2_chunks WHERE release='all-roles-controlled-v1'",
          )
        ).rows[0].n > 9000,
        true,
      );
    } finally {
      await pool.end();
      await new Promise<void>((r, reject) => server.close((e) => (e ? reject(e) : r())));
    }
  },
);
