import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FEEDBACK_INTERVIEW_GOALS,
  type InterviewConfig,
  type InterviewKnowledge,
} from '@interviewlab/core';
import { JOBS, getJob } from '../../code/backend/src/content/index';
import {
  buildCatalog,
  planningRoleContext,
  PROFILE_GOALS,
} from '../../code/backend/src/modules/knowledge/catalog';
import { createWorkflowModels } from '../../code/backend/src/modules/interviews/workflow-models';
import { loadConfig } from '../../code/backend/src/foundation/config';

const configuration: InterviewConfig = {
  job: 'frontend',
  career_stage: 'internship',
  interview_type: 'technical_qa',
  duration_minutes: 10,
  difficulty: '基础',
  interviewer_style: '标准',
  interaction_mode: 'text_fallback',
};
const job = getJob(configuration.job)!;
const knowledge: InterviewKnowledge = {
  content_version: 'synthetic',
  questions: job.questions,
  sources: [],
  missing_reason: null,
};
const response = (value: unknown) =>
  new Response(
    JSON.stringify({
      id: 'planning-test',
      object: 'chat.completion',
      model: 'ecnu-plus',
      created: 0,
      choices: [
        {
          index: 0,
          finish_reason: 'stop',
          message: { role: 'assistant', content: JSON.stringify(value) },
        },
      ],
    }),
    { headers: { 'content-type': 'application/json' } },
  );

test('planning freezes existing role duties and requirements independently from candidate claims', () => {
  const role = planningRoleContext(configuration);
  assert.equal(role.job_id, job.id);
  assert.equal(role.job_version, job.version);
  assert.deepEqual(role.responsibilities, job.responsibilities);
  assert.deepEqual(role.requirements, job.requirements);
  assert.deepEqual(role.source_refs, job.source_refs);
  assert.equal(role.usage, 'role_requirements_not_candidate_evidence');
  role.requirements.push('仅改变本次快照');
  assert.ok(!job.requirements.includes('仅改变本次快照'));
  assert.throws(() => planningRoleContext({ ...configuration, job: 'nonexistent-test-role' }));
});

test('planning separates business tasks and HR arrangements from technical question material, and fills whole-session coverage', async () => {
  for (const type of ['technical_qa', 'business_scenario', 'mixed', 'hr'] as const) {
    const cfg = { ...configuration, interview_type: type };
    let supplied: { input: ReturnType<typeof JSON.parse>; system: string } | undefined;
    const models = createWorkflowModels(loadConfig({ LLM_API_KEY: 'test' }), async (_url, init) => {
      const body = JSON.parse(String(init?.body));
      const { input } = JSON.parse(body.messages[1].content);
      supplied = { input, system: body.messages[0].content };
      return response({
        goals: [{ goal: PROFILE_GOALS[type][0], focus: '了解岗位相关依据', evidence_indices: [] }],
        limitations: [],
      });
    });
    const plan = await models.prepare(cfg, knowledge, undefined, new AbortController().signal);
    assert.ok(supplied);
    const { input } = supplied;
    assert.deepEqual(input.job_context.responsibilities, job.responsibilities);
    assert.deepEqual(input.job_context.requirements, job.requirements);
    assert.equal(input.job_context.usage, 'role_requirements_not_candidate_evidence');
    assert.equal(input.resume, null);
    if (type === 'hr' || type === 'business_scenario')
      assert.deepEqual(input.question_materials, []);
    else assert.ok(input.question_materials.length);
    if (type === 'business_scenario' || type === 'mixed')
      assert.deepEqual(input.task_context, job.responsibilities);
    assert.match(supplied.system, /不是候选人已做过或已掌握的事实/);
    assert.deepEqual(plan.role_context, planningRoleContext(cfg));
    assert.ok(plan.goals.length <= 6);
    assert.equal(new Set(plan.goals.map((g) => g.goal)).size, plan.goals.length);
    if (type === 'hr')
      assert.deepEqual(
        plan.goals.slice(0, 3).map((g) => g.goal),
        ['motivation', 'availability', 'expectations'],
      );
    else
      for (const options of Object.values(FEEDBACK_INTERVIEW_GOALS))
        if (options.length)
          assert.ok(plan.goals.some((g) => (options as readonly string[]).includes(g.goal)));
  }
});

test('business work judgement can retrieve professional foundations without inheriting code-exam questions or HR specialist material', () => {
  const documents = buildCatalog();
  for (const family of new Set(JOBS.map((j) => j.category_id))) {
    const representative = JOBS.find((j) => j.category_id === family)!;
    const professional = documents.filter(
      (d) => d.kind === 'professional' && d.bindings.some((b) => b.job === representative.id),
    );
    assert.ok(
      professional.some((d) =>
        d.bindings.some(
          (b) => b.job === representative.id && b.types.includes('business_scenario'),
        ),
      ),
    );
    assert.ok(professional.every((d) => d.bindings.every((b) => !b.types.includes('hr'))));
  }
  assert.equal(documents.filter((d) => d.kind === 'question').length, 8000);
  assert.ok(
    documents
      .filter((d) => d.kind === 'question')
      .every((d) => d.bindings.every((b) => !b.types.includes('business_scenario'))),
  );
});
