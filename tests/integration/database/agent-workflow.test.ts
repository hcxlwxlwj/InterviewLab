import { before, beforeEach, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { config as dotenv } from 'dotenv';
import {
  emptyResumeTemplate,
  type InterviewConfig,
  type PersonalMaterial,
} from '@interviewlab/core';
import { JOBS } from '../../../code/backend/src/content/index';
import { loadConfig } from '../../../code/backend/src/foundation/config';
import { createDatabase } from '../../../code/backend/src/database/connection';
import { migrateDatabase } from '../../../code/backend/src/database/migrate';
import { createInterviewRuntime } from '../../../code/backend/src/modules/interview-runtime';
import { createInterviewAgent } from '../../../code/backend/src/modules/interviews/agent';
import { createWorkflowModels } from '../../../code/backend/src/modules/interviews/workflow-models';
import { simpleResume } from '../../../code/backend/src/modules/interviews/preparation';
import { runTask, TaskDeliveryError } from '../../../code/backend/src/tasks/runner';
import type { WorkflowModels } from '../../../code/backend/src/modules/interviews/workflow-models';
import { buildApp } from '../../../code/backend/src/server/app';

dotenv({ quiet: true });
const url = process.env.TEST_DATABASE_URL;
if (!url || !/^interviewlab_test[a-z0-9_]*$/.test(new URL(url).pathname.slice(1)))
  throw new Error('Dedicated test database required');
const config = loadConfig({
  DATABASE_URL: url,
  NODE_ENV: 'test',
  LOG_LEVEL: 'silent',
  LLM_API_KEY: 'synthetic',
});
const db = createDatabase(config);
const identity = { owner_id: 'workflow-synthetic-owner', roles: [] };
const configuration: InterviewConfig = {
  job: 'backend',
  career_stage: 'internship',
  interview_type: 'project_deep_dive',
  difficulty: '基础',
  duration_minutes: 5,
  interviewer_style: '标准',
  interaction_mode: 'text_fallback',
};
const materialInput = {
  kind: 'resume' as const,
  title: '合成课程简历',
  text: '',
  confirmed: true,
  structure: {
    ...emptyResumeTemplate(),
    projects: '课程项目：用于同学预约教室，本人负责接口。',
    skills: 'Java、SQL',
  },
};
const runtimes: ReturnType<typeof createInterviewRuntime>[] = [];
function runtime(overrides: Partial<WorkflowModels> = {}, runtimeConfig = config) {
  const agent = createInterviewAgent(runtimeConfig, () => {}, async () => {
    throw new Error('No generation needed in preparation tests');
  });
  const models: WorkflowModels = {
    ...createWorkflowModels(runtimeConfig),
    analyze: async (m) => simpleResume(m)!,
    prepare: async (_c, k, a) => ({
      goals: [
        {
          goal: k.agent_release!.profile.goals[0],
          focus: '了解实际行动及验证',
          material_refs: a?.facts.slice(0, 1).map((f) => f.evidence) ?? [],
        },
      ],
      limitations: ['受控测试，不代表模型质量'],
    }),
    ...overrides,
  };
  const rt = createInterviewRuntime(db, runtimeConfig, {
    agent,
    workflowModels: models,
    onFinalize: async () => {},
  });
  runtimes.push(rt);
  return rt;
}
async function execute(rt: ReturnType<typeof runtime>, type: string) {
  const task = (
    await db.pool.query(
      "SELECT id FROM tasks WHERE type=$1 AND status IN ('queued','failed') ORDER BY created_at LIMIT 1",
      [type],
    )
  ).rows[0];
  assert.ok(task, `missing ${type}`);
  await runTask(db, task.id, rt.handlers, 60000, rt.isCancelled);
  return task.id;
}
before(async () => migrateDatabase(db));
beforeEach(async () => {
  while (runtimes.length) await runtimes.pop()!.close();
  await db.pool.query('TRUNCATE interviews,tasks,idempotency_records,resume_materials CASCADE');
});
after(async () => {
  while (runtimes.length) await runtimes.pop()!.close();
  await db.close();
});

test('three modes wait for versioned resume analysis and preparation without starting timers, then share the same start gate', async () => {
  for (const mode of ['text_fallback', 'realtime_voice', 'realtime_video'] as const) {
    const rt = runtime(),
      m = await rt.materials.save(identity.owner_id, materialInput);
    const cfg = {
      ...configuration,
      interaction_mode: mode,
      resume_ref: { id: m.id, version: m.version },
    };
    let view = await rt.interviews.create(identity, cfg, randomUUID());
    assert.equal(view.preparation?.status, 'waiting_material');
    assert.equal(view.started_at, null);
    assert.equal(view.generation_status, 'idle');
    assert.equal(view.turns.length, 0);
    await assert.rejects(
      rt.interviews.start(identity, view.id, { version: view.version }, randomUUID()),
    );
    await execute(rt, 'resumes.analyze.v1');
    await rt.maintain();
    view = await rt.interviews.read(identity, view.id);
    assert.equal(view.preparation?.status, 'pending');
    await execute(rt, 'preparation.plan.v1');
    view = await rt.interviews.read(identity, view.id);
    assert.equal(view.preparation?.status, 'ready');
    const readyVersion = view.version;
    view = await rt.interviews.start(identity, view.id, { version: view.version }, randomUUID());
    assert.equal(view.status, 'in_progress');
    assert.ok(view.started_at);
    assert.equal(view.turns[0].stage, 'introduction');
    assert.ok(view.version > readyVersion);
    const saved = (await db.pool.query('SELECT snapshot FROM interviews WHERE id=$1', [view.id]))
      .rows[0].snapshot;
    assert.equal(saved.runtime_version, 'graph-v1');
    assert.equal(saved.personal_material.version, 1);
    assert.ok(saved.resume_analysis.facts.length);
    assert.ok(saved.preparation_plan.goals.length);
    const listed = await rt.materials.versions(identity.owner_id, m.id);
    assert.equal(listed[0].analysis?.status, 'ready');
  }
});
test('analysis versions do not drift, shared requests deduplicate, and private results are not in the interview DTO', async () => {
  const rt = runtime(),
    first = await rt.materials.save(identity.owner_id, materialInput);
  await Promise.all([
    rt.materials.analyze(identity.owner_id, first.id, 1, randomUUID()),
    rt.materials.analyze(identity.owner_id, first.id, 1, randomUUID()),
  ]);
  assert.equal(
    (await db.pool.query("SELECT count(*)::int AS n FROM tasks WHERE type='resumes.analyze.v1'"))
      .rows[0].n,
    1,
  );
  const view = await rt.interviews.create(
    identity,
    { ...configuration, resume_ref: { id: first.id, version: 1 } },
    randomUUID(),
  );
  await rt.materials.save(
    identity.owner_id,
    {
      ...materialInput,
      structure: { ...materialInput.structure, projects: '新项目：本人负责页面。' },
    },
    first.id,
    1,
  );
  await execute(rt, 'resumes.analyze.v1');
  await rt.maintain();
  await execute(rt, 'preparation.plan.v1');
  const read = await rt.interviews.read(identity, view.id);
  assert.ok(!JSON.stringify(read).includes(materialInput.structure.projects));
  const snapshot = (await db.pool.query('SELECT snapshot FROM interviews WHERE id=$1', [view.id]))
    .rows[0].snapshot;
  assert.equal(snapshot.personal_material.version, 1);
  await assert.rejects(rt.materials.versions('other-user', first.id));
  await assert.rejects(
    rt.interviews.prepare(
      { owner_id: 'other-user', roles: [] },
      view.id,
      { version: read.version, mode: 'fallback' },
      randomUUID(),
    ),
  );
});
test('failed analysis leaves the saved resume intact and explicit fallback can prepare and start', async () => {
  const rt = runtime({
      analyze: async () => {
        throw new Error('controlled failure');
      },
    }),
    m = await rt.materials.save(identity.owner_id, materialInput);
  let view = await rt.interviews.create(
    identity,
    { ...configuration, resume_ref: { id: m.id, version: 1 } },
    randomUUID(),
  );
  await assert.rejects(execute(rt, 'resumes.analyze.v1'), TaskDeliveryError);
  await execute(rt, 'resumes.analyze.v1');
  await rt.maintain();
  view = await rt.interviews.read(identity, view.id);
  assert.equal(view.preparation?.status, 'failed');
  assert.equal((await rt.materials.versions(identity.owner_id, m.id))[0].confirmed, true);
  view = await rt.interviews.prepare(
    identity,
    view.id,
    { version: view.version, mode: 'fallback' },
    randomUUID(),
  );
  assert.equal(view.preparation?.status, 'fallback');
  view = await rt.interviews.start(identity, view.id, { version: view.version }, randomUUID());
  assert.equal(view.status, 'in_progress');
});
test('deleting a resume fences in-flight analysis and invalidates waiting preparation', async () => {
  let release = () => {};
  const gate = new Promise<void>((r) => {
    release = r;
  });
  let entered = () => {};
  const running = new Promise<void>((r) => {
    entered = r;
  });
  const rt = runtime({
      analyze: async (m) => {
        entered();
        await gate;
        return simpleResume(m)!;
      },
    }),
    m = await rt.materials.save(identity.owner_id, materialInput);
  const view = await rt.interviews.create(
    identity,
    { ...configuration, resume_ref: { id: m.id, version: 1 } },
    randomUUID(),
  );
  const task = execute(rt, 'resumes.analyze.v1');
  await running;
  await rt.materials.remove(identity.owner_id, m.id);
  release();
  await task;
  await rt.maintain();
  assert.equal((await rt.interviews.read(identity, view.id)).preparation?.status, 'failed');
  assert.equal(
    (await db.pool.query('SELECT count(*)::int AS n FROM resume_analyses')).rows[0].n,
    0,
  );
  await assert.rejects(
    rt.interviews.start(
      identity,
      view.id,
      { version: (await rt.interviews.read(identity, view.id)).version },
      randomUUID(),
    ),
  );
});
test('preparation endpoints preserve Cookie/Origin guards and expose only status', async () => {
  const app = await buildApp({
    database: db,
    config,
    identity: {
      async authenticate() {
        return identity;
      },
    },
    logger: false,
    interview: {
      workflowModels: {
        ...createWorkflowModels(config),
        analyze: async (m: PersonalMaterial) => simpleResume(m)!,
        prepare: async () => ({
          goals: [{ goal: 'contribution', focus: '本人职责', material_refs: [] }],
          limitations: [],
        }),
      },
      onFinalize: async () => {},
    },
  });
  try {
    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/interviews',
      headers: { origin: config.PUBLIC_ORIGIN, 'idempotency-key': randomUUID() },
      payload: configuration,
    });
    assert.equal(created.statusCode, 201, created.body);
    const view = created.json();
    assert.equal(view.preparation.status, 'pending');
    const bad = await app.inject({
      method: 'POST',
      url: `/api/v1/interviews/${view.id}/prepare`,
      headers: { origin: 'https://untrusted.example', 'idempotency-key': randomUUID() },
      payload: { version: view.version, mode: 'fallback' },
    });
    assert.equal(bad.statusCode, 403);
  } finally {
    await app.close();
  }
});

test('configuration changes fence a late preparation result and a repeated prepare key replays safely', async () => {
  let release = () => {};
  const gate = new Promise<void>((r) => {
    release = r;
  });
  let entered = () => {};
  const running = new Promise<void>((r) => {
    entered = r;
  });
  const rt = runtime({
    prepare: async () => {
      entered();
      await gate;
      return {
        goals: [{ goal: 'contribution', focus: '旧计划不可提交', material_refs: [] }],
        limitations: [],
      };
    },
  });
  let view = await rt.interviews.create(identity, configuration, randomUUID());
  const task = execute(rt, 'preparation.plan.v1');
  await running;
  view = await rt.interviews.patch(
    identity,
    view.id,
    { version: view.version, configuration: { ...configuration, interview_type: 'hr' } },
    randomUUID(),
  );
  release();
  await task;
  view = await rt.interviews.read(identity, view.id);
  assert.equal(view.preparation?.status, 'pending');
  assert.equal(view.preparation?.task_id, null);
  const snapshot = (await db.pool.query('SELECT snapshot FROM interviews WHERE id=$1', [view.id]))
    .rows[0].snapshot;
  assert.equal(snapshot, null);
  const key = randomUUID(),
    body = { version: view.version, mode: 'fallback' as const };
  const ready = await rt.interviews.prepare(identity, view.id, body, key);
  const replay = await rt.interviews.prepare(identity, view.id, body, key);
  assert.equal(replay.version, ready.version);
  assert.equal(replay.preparation?.status, 'fallback');
});

test('deleting an interview during preparation prevents late publication', async () => {
  let release = () => {};
  const gate = new Promise<void>((r) => {
    release = r;
  });
  let entered = () => {};
  const running = new Promise<void>((r) => {
    entered = r;
  });
  const rt = runtime({
    prepare: async () => {
      entered();
      await gate;
      return {
        goals: [{ goal: 'verification', focus: '不可复活', material_refs: [] }],
        limitations: [],
      };
    },
  });
  const view = await rt.interviews.create(identity, configuration, randomUUID());
  const task = execute(rt, 'preparation.plan.v1');
  await running;
  await rt.interviews.delete(identity, view.id, { version: view.version }, randomUUID());
  release();
  await task;
  await assert.rejects(rt.interviews.read(identity, view.id));
  assert.equal(
    (await db.pool.query('SELECT id FROM interviews WHERE id=$1', [view.id])).rowCount,
    0,
  );
});

test('every job family can create all five interview types in the graph runtime', async () => {
  const rt = runtime();
  for (const family of new Set(JOBS.map((j) => j.category_id))) {
    const job = JOBS.find((j) => j.category_id === family)!;
    for (const type of [
      'technical_qa',
      'project_deep_dive',
      'business_scenario',
      'hr',
      'mixed',
    ] as const) {
      const view = await rt.interviews.create(
        identity,
        { ...configuration, job: job.id, career_stage: job.stages[0], interview_type: type },
        randomUUID(),
      );
      assert.equal(view.preparation?.status, 'pending');
      assert.equal(view.started_at, null);
    }
  }
});
