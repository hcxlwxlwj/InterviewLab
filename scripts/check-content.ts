import assert from 'node:assert/strict';
import {
  ALL_JOB_TEMPLATES,
  CONTENT_SOURCES,
  JOB_CATEGORIES,
} from '../code/core_engine/src/catalog';

export function validateContent() {
  const sourceIds = new Set(CONTENT_SOURCES.map((s) => s.id)),
    jobIds = new Set<string>(),
    questionIds = new Set<string>();
  assert.equal(sourceIds.size, CONTENT_SOURCES.length, '来源ID重复');
  for (const source of CONTENT_SOURCES) {
    assert.match(source.url, /^https:\/\//);
    assert.ok(source.reviewed_at && source.acquired_at);
    assert.equal(source.usage, 'reference_only');
  }
  for (const job of ALL_JOB_TEMPLATES) {
    assert.ok(!jobIds.has(job.id), `岗位ID重复 ${job.id}`);
    jobIds.add(job.id);
    assert.ok(JOB_CATEGORIES.some((c) => c.id === job.category_id));
    assert.ok(['draft', 'reviewed', 'published', 'retired'].includes(job.status));
    if (job.status !== 'published') continue;
    assert.ok(job.version > 0 && job.review_method && job.authorship === 'platform_original');
    assert.ok(job.topics.length >= 6 && job.topics.length <= 10, `${job.id} 主题数`);
    assert.equal(job.questions.length, 8, `${job.id} 主问题数`);
    assert.ok(job.responsibilities.length && job.requirements.length && job.preferred.length);
    assert.ok(job.source_refs.length >= 2 && job.source_refs.every((id) => sourceIds.has(id)));
    const sources = CONTENT_SOURCES.filter((s) => job.source_refs.includes(s.id));
    assert.ok(
      sources.some((s) => s.kind === 'recruitment') &&
        sources.some((s) => s.kind === 'official_documentation'),
    );
    const days = (Date.parse(job.review_due_at) - Date.parse(job.reviewed_at)) / 86400000;
    assert.equal(
      days,
      job.category_id === 'ai' || job.id === 'ai-product' ? 30 : 90,
      `${job.id} 复核周期`,
    );
    for (const q of job.questions) {
      assert.ok(!questionIds.has(q.id), `题目ID重复 ${q.id}`);
      questionIds.add(q.id);
      assert.ok(
        job.topics.includes(q.topic) &&
          q.text.length > 8 &&
          q.intent &&
          q.observation_points.length,
      );
      assert.ok(
        q.follow_ups.length >= 1 && q.follow_ups.length <= 2 && q.follow_ups.every(Boolean),
      );
      assert.ok(
        q.stages.length && q.source_refs.length && q.source_refs.every((id) => sourceIds.has(id)),
      );
      assert.equal(q.origin, 'platform_authored');
    }
  }
  return { templates: jobIds.size, questions: questionIds.size, sources: sourceIds.size };
}
console.log('内容校验通过', validateContent());
const due = ALL_JOB_TEMPLATES.filter(
  (j) => j.status === 'published' && Date.parse(j.review_due_at) <= Date.now(),
);
console.log(`到期复核 ${due.length} 项`);
for (const j of due) console.log(`${j.id}\t${j.title}\t${j.review_due_at}`);
