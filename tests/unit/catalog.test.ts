import { CONTENT_SOURCES, JOBS, getJob, localKnowledgeRetriever, searchJobs } from '@interviewlab/backend/content';
import assert from 'node:assert/strict';
import test from 'node:test';
import { buildCatalog, catalogManifest, catalogSources } from '../../code/backend/src/modules/knowledge/catalog';

test('teacher questions are indexed for their matching campus roles with resolvable sources', () => {
  const documents = buildCatalog();
  const teacher = documents.filter((doc) => doc.id.startsWith('teacher-issue-'));
  assert.equal(teacher.length, 98);
  assert.equal(new Set(teacher.map((doc) => doc.id)).size, teacher.length);
  assert.equal(catalogManifest(documents).questions, 8098);
  const roles = new Map([
    ['teacher-issue-12', 'agent-platform'],
    ['teacher-issue-13', 'llm-app'],
    ['teacher-issue-14', 'ai-agent-product'],
    ['teacher-issue-15', 'llm-training'],
  ]);
  for (const doc of teacher) {
    const [source] = doc.source_refs;
    assert.equal(doc.kind, 'question');
    assert.ok(catalogSources.some((entry) => entry.id === source && entry.kind === 'course_feedback'));
    assert.equal(doc.bindings.length, 1);
    assert.equal(doc.bindings[0].job, roles.get(source));
    assert.deepEqual(doc.bindings[0].stages, ['campus']);
    assert.ok(doc.bindings[0].types.includes('mixed'));
  }
});

test('the current catalog publishes 1000 versioned roles and 8000 source-linked original questions', () => {
  assert.equal(JOBS.length,1000);
  assert.equal(JOBS.reduce((n,j)=>n+j.questions.length,0),8000);
  const sources=new Set(CONTENT_SOURCES.map(s=>s.id));
  for (const job of JOBS) {
    assert.equal(job.status,'published');
    assert.ok(job.stages.length && job.version>0);
    assert.ok(job.source_refs.every(id=>sources.has(id)));
    assert.ok(job.questions.every(q=>q.origin==='platform_authored' && q.source_refs.every(id=>sources.has(id))));
  }
  assert.equal(getJob('java-backend')?.id,'backend');
  assert.equal(getJob('unknown'),undefined);
});
test('structured retrieval filters role, stage, topic and supported difficulty without mixing roles', async () => {
  const r=await localKnowledgeRetriever.retrieve({job_id:'ai-product',stage:'campus',topic:'评测'});
  assert.equal(r.items.length,1);
  assert.equal(r.template_id,'ai-product');
  assert.equal((await localKnowledgeRetriever.retrieve({job_id:'ai-product',difficulty:'挑战'})).items.length,0);
  await assert.rejects(()=>localKnowledgeRetriever.retrieve({job_id:'retired-or-unknown'}));
  assert.ok(searchJobs({search:'RAG'}).some(j=>j.id==='llm-app'));
});
test('retirement excludes a role from new catalog lookup and structured retrieval', async () => {
  const job=getJob('ai-product')!;
  try {
    job.status='retired';
    assert.equal(getJob(job.id),undefined);
    assert.equal(searchJobs({search:job.title}).length,0);
    await assert.rejects(()=>localKnowledgeRetriever.retrieve({job_id:job.id}));
  } finally {job.status='published';}
});
