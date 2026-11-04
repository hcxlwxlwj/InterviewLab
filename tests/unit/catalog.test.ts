import { CONTENT_SOURCES, JOBS, getJob, localKnowledgeRetriever, searchJobs } from '@interviewlab/backend/content';
import assert from 'node:assert/strict';
import test from 'node:test';

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
