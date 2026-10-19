import {
  CONTENT_SOURCES,
  JOBS,
  getJob,
  localKnowledgeRetriever,
  searchJobs,
} from '@interviewlab/content';
import type { Configuration } from '@interviewlab/core';
import { buildQuestions, defaultConfiguration } from '@interviewlab/core';
import assert from 'node:assert/strict';
import test from 'node:test';
test('all 36 roles have distinct sourced question banks and a six-main-question session', () => {
  assert.equal(JOBS.length, 36);
  const first = new Set<string>();
  for (const j of JOBS) {
    assert.equal(j.questions.length, 8);
    first.add(j.questions[0].text);
    const questions = questionsFor({
      ...defaultConfiguration(j.id),
      interview_type: 'technical_qa',
    });
    assert.equal(questions.length, 6);
    assert.ok(questions.every((q) => q.template_version === j.version));
    assert.ok(j.source_refs.every((ref) => CONTENT_SOURCES.some((s) => s.id === ref)));
  }
  assert.equal(first.size, 36);
  const deep = questionsFor({
    ...defaultConfiguration('ai-product'),
    interview_type: 'technical_qa',
    interviewer_style: '深入追问',
  });
  assert.equal(deep.filter((q) => q.follow_up_index === 0).length, 6);
  assert.ok(
    deep.some(
      (q) =>
        q.text === '规则系统已足够时为何还需要AI？' &&
        q.source_refs?.includes('ai-product-official'),
    ),
  );
  assert.equal(getJob('java-backend')?.id, 'backend');
  assert.throws(() => questionsFor(defaultConfiguration('unknown')), /不可用/);
});
test('retrieval filters by role, stage, topic and supported difficulty without fallback', async () => {
  const r = await localKnowledgeRetriever.retrieve({
    job_id: 'ai-product',
    stage: 'campus',
    topic: '评测',
  });
  assert.equal(r.items.length, 1);
  assert.equal(r.template_id, 'ai-product');
  assert.equal(r.sources.length, 2);
  assert.equal(
    (await localKnowledgeRetriever.retrieve({ job_id: 'ai-product', difficulty: '挑战' })).items
      .length,
    0,
  );
  await assert.rejects(() => localKnowledgeRetriever.retrieve({ job_id: 'retired-or-unknown' }));
  assert.ok(searchJobs({ search: 'RAG' }).some((j) => j.id === 'llm-app'));
  assert.equal(searchJobs({ category: 'product', stage: 'internship' }).length, 4);
});
test('retirement immediately excludes a role from new retrieval and interview generation', async () => {
  const job = getJob('ai-product')!;
  try {
    job.status = 'retired';
    assert.equal(getJob(job.id), undefined);
    assert.equal(searchJobs({ search: job.title }).length, 0);
    await assert.rejects(() => localKnowledgeRetriever.retrieve({ job_id: job.id }));
    assert.throws(() => questionsFor(defaultConfiguration(job.id)));
  } finally {
    job.status = 'published';
  }
});

function questionsFor(config: Configuration) {
  return buildQuestions(config, getJob(config.job));
}

test('question rules consume the supplied snapshot, independent of the live content registry', () => {
  const template = structuredClone(getJob('ai-product')!);
  template.questions[0].text = '该快照独有的问题';
  const config = { ...defaultConfiguration('ai-product'), interview_type: 'technical_qa' as const };
  assert.equal(buildQuestions(config, template)[0].text, '该快照独有的问题');
  assert.notEqual(getJob('ai-product')!.questions[0].text, template.questions[0].text);
  assert.throws(() => buildQuestions(config, undefined), /不可用/);
});
