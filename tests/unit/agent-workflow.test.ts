import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type {
  PersonalMaterial,
  InterviewSnapshot,
  InterviewTurn,
  InterviewComparison,
} from '@interviewlab/core';
import { emptyResumeTemplate } from '@interviewlab/core';
import { JOBS } from '../../code/backend/src/content/index';
import {
  buildCatalog,
  catalogManifest,
  PROFILE_GOALS,
  catalogTerms,
} from '../../code/backend/src/modules/knowledge/catalog';
import { createAllRoleKnowledge } from '../../code/backend/src/modules/knowledge/all-roles';
import { loadConfig } from '../../code/backend/src/foundation/config';
import {
  createWorkflowModels,
  materialFields,
  assertMaterialEvidence,
} from '../../code/backend/src/modules/interviews/workflow-models';
import { langChainFetch } from '../../code/backend/src/modules/interviews/model';
import { createInterviewAgent } from '../../code/backend/src/modules/interviews/agent';
import { newInterviewState } from '../../code/backend/src/modules/interviews/repository';
import { interviewInputDigest } from '../../code/backend/src/modules/interviews/service';

const config = loadConfig({ LLM_API_KEY: 'synthetic-key' });
test('retired interview snapshots never invoke a fallback model or rewrite the stored snapshot', async () => {
  let calls = 0;
  const agent = createInterviewAgent(config, () => {}, async () => {
    calls++;
    throw new Error('Retired snapshots must not execute');
  });
  const state = newInterviewState('synthetic', {
    job: 'backend', career_stage: 'internship', interview_type: 'technical_qa',
    difficulty: '基础', duration_minutes: 5, interviewer_style: '标准', interaction_mode: 'text_fallback',
  });
  const snapshot: InterviewSnapshot = {
    job_title: '后端', model: 'ecnu-plus', prompt_version: 'historical', rubric_version: 'historical',
    knowledge: { content_version: 'historical', questions: [], sources: [], missing_reason: null },
  };
  const before = structuredClone(snapshot);
  await assert.rejects(agent.advance(state.view, snapshot, false, new AbortController().signal, false),
    (error: { code?: string }) => error.code === 'unsupported_input');
  assert.equal(calls, 0);
  assert.deepEqual(snapshot, before);
});
const material: PersonalMaterial = {
  id: randomUUID(),
  kind: 'resume',
  version: 1,
  title: '合成简历',
  text: '',
  confirmed: true,
  created_at: new Date().toISOString(),
  structure: {
    ...emptyResumeTemplate(),
    full_name: '合成姓名',
    email: 'synthetic@example.test',
    phone: '13800000000',
    projects: '课程项目：预约系统；本人负责接口和冲突处理。',
    skills: 'Java、SQL',
  },
};
const response = (value: unknown, finish = 'stop') =>
  new Response(
    JSON.stringify({
      id: 'test',
      object: 'chat.completion',
      model: 'ecnu-plus',
      choices: [
        {
          index: 0,
          finish_reason: finish,
          message: { role: 'assistant', content: JSON.stringify(value) },
        },
      ],
      usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 },
    }),
    { headers: { 'content-type': 'application/json' } },
  );
const signal = () => new AbortController().signal;

test('all 1000 roles and 8000 original questions have applicable typed records, without cloning shared foundations', async () => {
  const documents = buildCatalog(),
    manifest = catalogManifest(documents);
  assert.equal(manifest.jobs, 1000);
  assert.equal(manifest.lineage.length,1000);
  assert.equal(manifest.lineage[0].review_method,JOBS[0].review_method);
  assert.equal(manifest.lineage.reduce((n,j)=>n+j.question_ids.length,0),8000);
  assert.ok(manifest.sources.some(s=>s.verification==='search_index'),'old source verification is preserved');
  assert.ok(catalogTerms('数仓 数据约束 机器人 可用性 state effect').includes('state'));
  assert.ok(!catalogTerms('state effect').includes('副作用'));
  assert.equal(manifest.questions, 8000);
  assert.equal(manifest.families.length, 9);
  assert.ok(manifest.coverage.every((c) => c.professional_cards >= 1));
  for (const job of JOBS) {
    const applicable = documents.flatMap((d) =>
      d.bindings.filter((b) => b.job === job.id).map((b) => ({ d, b })),
    );
    assert.ok(applicable.some(({ d }) => d.kind === 'job_profile'));
    for (const stage of job.stages)
      for (const type of Object.keys(PROFILE_GOALS) as (keyof typeof PROFILE_GOALS)[]) {
        assert.ok(
          applicable.some(
            ({ d, b }) =>
              d.kind !== 'evaluation_reference' &&
              b.stages.includes(stage) &&
              b.types.includes(type) &&
              b.goals.some((g) => PROFILE_GOALS[type].includes(g)),
          ),
        );
      }
    for (const q of job.questions)
      assert.ok(
        applicable.some(
          ({ d, b }) =>
            d.id === q.id &&
            d.kind === 'question' &&
            d.evidence_level === 'platform_authored' &&
            q.stages.every((stage) => b.stages.includes(stage)),
        ),
      );
  }
  assert.equal(documents.filter((d) => d.kind === 'professional').length, 9);
  assert.ok(documents.some((d) => d.kind === 'interview_method' && d.bindings.length === 1000));
  const knowledge = createAllRoleKnowledge(config);
  for (const job of JOBS)
    for (const stage of job.stages) {
      const profiles = await knowledge.profiles({ job: job.id, career_stage: stage });
      assert.equal(profiles.profiles.length, Object.keys(PROFILE_GOALS).length);
      assert.ok(profiles.profiles.every((p) => p.goals.length));
    }
  await knowledge.close();
});
test('resume workflow sends no contact fields, validates exact source evidence, and emits only node metadata', async () => {
  const logs: object[] = [];
  const models = createWorkflowModels(
    config,
    async (_url, init) => {
      const body = String(init?.body);
      assert.ok(!body.includes('synthetic@example.test'));
      assert.ok(!body.includes('13800000000'));
      assert.ok(!body.includes('合成姓名'));
      return response({
        facts: [{ kind: 'experience', anchor: 0 }],
        clarification_points: ['如何验证冲突处理？'],
      });
    },
    (e) => logs.push(e),
  );
  const result = await models.analyze(material, signal());
  assert.equal(result.facts[0].text, material.structure!.projects);
  assert.ok(logs.some((e) => JSON.stringify(e).includes('prepare_context')));
  assert.ok(!JSON.stringify(logs).includes(material.structure!.projects));
  assert.throws(() =>
    assertMaterialEvidence({ ...result.facts[0].evidence, quote: '提升了50%' }, material),
  );
  await assert.rejects(models.analyze({ ...material, confirmed: false }, signal()));
  assert.equal(materialFields(material).email, undefined);
});
test('resume and preparation reject fabricated quotes and nonexistent evidence indices', async () => {
  const models = createWorkflowModels(config, async () =>
    response({ facts: [{ kind: 'result', anchor: 999 }], clarification_points: [] }),
  );
  await assert.rejects(models.analyze(material, signal()));
  const knowledge = createAllRoleKnowledge(config);
  const state = newInterviewState('synthetic', {
    job: 'backend',
    career_stage: 'internship',
    interview_type: 'hr',
    difficulty: '基础',
    duration_minutes: 5,
    interviewer_style: '标准',
    interaction_mode: 'text_fallback',
  });
  const k = await knowledge.read(state.view.configuration);
  const planner = createWorkflowModels(config, async () =>
    response({
      goals: [{ goal: 'motivation', focus: '了解选择依据', evidence_indices: [9] }],
      limitations: [],
    }),
  );
  await assert.rejects(planner.prepare(state.view.configuration, k, undefined, signal()));
  await knowledge.close();
});
test('LangChain compatible transport keeps strict stop/length semantics, cancellation and no SDK retries', async () => {
  let calls = 0;
  const transport = langChainFetch(config, async () => {
    calls++;
    return response({}, 'length');
  });
  const res = await transport('unused', {
    body: JSON.stringify({
      model: 'ecnu-plus',
      messages: [{ role: 'user', content: 'synthetic' }],
      stream: false,
    }),
  });
  assert.equal((await res.json()).choices[0].finish_reason, 'length');
  assert.equal(calls, 1);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    transport('unused', {
      signal: controller.signal,
      body: JSON.stringify({ model: 'ecnu-plus', messages: [], stream: false }),
    }),
  );
});
test('new non-frontend turns execute the graph and retain answer revision fencing across all interaction modes', async () => {
  for (const mode of ['text_fallback', 'realtime_voice', 'realtime_video'] as const) {
    const state = newInterviewState('synthetic', {
      job: 'backend',
      career_stage: 'internship',
      interview_type: 'project_deep_dive',
      difficulty: '基础',
      duration_minutes: 5,
      interviewer_style: '标准',
      interaction_mode: mode,
    });
    const knowledge = createAllRoleKnowledge(config),
      k = await knowledge.read(state.view.configuration);
    const turn = {
      id: randomUUID(),
      text: '请介绍你的项目。',
      topic: '项目',
      purpose: '职责',
      knowledge_question_id: null,
      source_refs: [],
      evidence_refs: [],
      main_question_index: 1,
      follow_up_index: 0,
      generation_id: randomUUID(),
      presented_at: null,
      answer_status: 'answered' as const,
      answer_text: '我做了一个用于让同学预约教室的系统，本人负责接口和错误处理。',
      revision: 1,
      input_mode: 'text_fallback' as const,
      answered_at: new Date().toISOString(),
      stage: 'introduction' as const,
    };
    state.view.turns = [turn];
    state.view.status = 'in_progress';
    const snapshot: InterviewSnapshot = {
      runtime_version: 'graph-v1',
      model: 'ecnu-plus',
      job_title: 'Java后端',
      knowledge: k,
      prompt_version: 'interview-graph-v1',
      rubric_version: 'unchanged',
    };
    state.snapshot = snapshot;
    const fetcher: typeof fetch = async (_url, init) => {
      const body = JSON.parse(String(init?.body));
      assert.equal(body.stream, true);
      const value = { a: 'f', g: 0, e: 0, o: 1, q: '你如何验证错误处理的结果？', s: [], r: [] };
      return new Response(
        `data: ${JSON.stringify({ id: 's', object: 'chat.completion.chunk', choices: [{ index: 0, delta: { role: 'assistant', content: JSON.stringify(value) }, finish_reason: null }] })}\n\ndata: ${JSON.stringify({ id: 's', object: 'chat.completion.chunk', choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] })}\n\ndata: [DONE]\n\n`,
        { headers: { 'content-type': 'text/event-stream' } },
      );
    };
    const agent = createInterviewAgent(config, () => {}, fetcher);
    const result = await agent.advance(state.view, snapshot, false, signal(), false, {
      memory: null,
      retrieval: {
        release: k.content_version,
        chunks: [],
        missing_reason: 'synthetic',
        mode: 'empty',
      },
      preview: async () => {},
    });
    assert.equal(result.question?.text, '你如何验证错误处理的结果？');
    assert.equal(result.question?.evidence_refs[0].revision, 1);
    const digest = interviewInputDigest(state);
    state.memory = result.memory;
    assert.notEqual(interviewInputDigest(state), digest);
    const next = interviewInputDigest(state);
    state.view.turns[0].revision++;
    assert.notEqual(interviewInputDigest(state), next);
    await knowledge.close();
  }
});

test('LangChain report and comparison preserve the legacy input, output, evidence and frozen model contract', async () => {
  const turn: InterviewTurn = {
    id: 'turn-original',
    text: '你负责什么？',
    topic: '职责',
    purpose: '本人行动',
    knowledge_question_id: null,
    source_refs: [],
    evidence_refs: [],
    main_question_index: 1,
    follow_up_index: 0,
    generation_id: 'generation',
    presented_at: null,
    answer_status: 'answered',
    answer_text: '我负责接口。',
    revision: 1,
    input_mode: 'text_fallback',
    answered_at: null,
  };
  const pinned: InterviewSnapshot = {
    job_title: '后端',
    model: 'frozen-model',
    prompt_version: 'preserved',
    rubric_version: 'evidence-uncalibrated-v1',
    knowledge: {
      content_version: 'empty',
      questions: [],
      sources: [],
      missing_reason: '无专业资料',
    },
  };
  const comparison: InterviewComparison = {
    id: 'comparison',
    version: 1,
    task_id: null,
    original_interview_id: 'original',
    retry_interview_id: 'retry',
    original_turn_id: turn.id,
    retry_turn_id: 'turn-retry',
    original_revision: 1,
    retry_revision: 1,
    original_text: turn.answer_text!,
    retry_text: '我负责接口，并测试重复请求。',
    goal: '说明验证',
    question: turn.text,
    status: 'pending',
    changes: [],
    remaining_gaps: [],
    limitations: [],
  };
  const inputs: unknown[][] = [],
    outputs: unknown[][] = [];
  for (const runtime of ['legacy', 'graph-v1'] as const) {
    const requests: unknown[] = [];
    const fetcher: typeof fetch = async (_url, init) => {
      const request = JSON.parse(String(init?.body)),
        task = JSON.parse(request.messages[1].content);
      assert.equal(request.model, 'frozen-model');
      requests.push(task);
      if (task.input.allowed_quotes)
        return response({
          turn_id: turn.id,
          revision: 1,
          strengths: [
            { text: '说明职责', evidence_refs: [{ turn_id: turn.id, revision: 1, quote: 'q0' }] },
          ],
          gaps: [],
          reference_points: [],
          retry_goal: '说明验证',
          dimensions: ['project_communication'],
          limitations: [],
        });
      return response({
        changes: [
          {
            text: '补充验证行动',
            evidence_refs: [
              { turn_id: turn.id, revision: 1, quote: comparison.original_text },
              { turn_id: 'turn-retry', revision: 1, quote: comparison.retry_text },
            ],
          },
        ],
        remaining_gaps: [],
        limitations: [],
      });
    };
    const agent = createInterviewAgent(config, () => {}, fetcher);
    const snapshot = { ...pinned, ...(runtime === 'graph-v1' ? { runtime_version: runtime } : {}) };
    const evaluated = await agent.evaluate(turn, snapshot, signal(), false);
    const compared = await agent.compare(comparison, signal(), false, {
      runtime_version: snapshot.runtime_version,
      model: snapshot.model,
    });
    inputs.push(requests);
    outputs.push([evaluated, compared]);
  }
  assert.deepEqual(inputs[0], inputs[1]);
  assert.deepEqual(outputs[0], outputs[1]);
});
