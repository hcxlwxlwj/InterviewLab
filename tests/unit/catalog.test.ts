import {
  CONTENT_SOURCES,
  JOB_CLASSES,
  JOBS,
  LATEST_ROLE_SUPPLEMENTS,
  PUBLIC_INTERVIEW_SUPPLEMENTS,
  ROLE_TAXONOMY,
  getJob,
  localKnowledgeRetriever,
  searchJobs,
} from '@interviewlab/backend/content';
import { createJobCatalog, knowledgeEntries } from '@interviewlab/core';
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildCatalog,
  catalogManifest,
  catalogSources,
} from '../../code/backend/src/modules/knowledge/catalog';
import { structuredInterviewKnowledge } from '../../code/backend/src/modules/interviews/knowledge';

test('teacher questions and runtime question documents have exact catalog counts', () => {
  const documents = buildCatalog();
  const teacher = documents.filter((doc) => doc.id.startsWith('teacher-issue-'));
  assert.equal(teacher.length, 98);
  assert.equal(new Set(teacher.map((doc) => doc.id)).size, teacher.length);
  assert.equal(documents.filter((doc) => doc.kind === 'question').length, 10294);
  assert.equal(catalogManifest(documents).questions, 10294);
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

test('the published catalog preserves original records and adds active latest-role content', () => {
  const originalJobs = JOBS.filter((job) => !job.id.startsWith('latest-role-'));
  const latestJobs = JOBS.filter((job) => job.id.startsWith('latest-role-'));
  const originalQuestions = originalJobs.flatMap((job) => job.questions);
  const latestQuestions = latestJobs.flatMap((job) => job.questions);
  const activeMain = JOBS.flatMap((job) => job.questions).filter(
    (question) => question.status !== 'merged',
  );
  const merged = JOBS.flatMap((job) => job.questions).filter(
    (question) => question.status === 'merged',
  );
  const sources = new Set(CONTENT_SOURCES.map((source) => source.id));

  assert.equal(JOBS.length, 1269);
  assert.equal(originalJobs.length, 1000);
  assert.equal(latestJobs.length, 269);
  assert.equal(originalQuestions.length, 8000);
  assert.equal(
    originalQuestions.filter((question) => question.status !== 'merged').length,
    7996,
  );
  assert.equal(latestQuestions.length, 2152);
  assert.equal(latestQuestions.filter((question) => question.status === 'active').length, 2152);
  assert.equal(activeMain.length, 10148);
  assert.equal(merged.length, 4);
  assert.equal(CONTENT_SOURCES.length, 1962);
  assert.equal(CONTENT_SOURCES.filter((source) => source.kind === 'public_interview').length, 54);
  assert.equal(
    CONTENT_SOURCES.filter((source) => source.id.startsWith('latest-role-source-')).length,
    269,
  );

  for (const job of JOBS) {
    assert.equal(job.status, 'published');
    assert.ok(job.primary_class_id && job.role_family_id && job.scenario_tags);
    assert.ok(job.stages.length && job.version > 0);
    assert.ok(job.source_refs.every((id) => sources.has(id)));
    assert.ok(
      job.questions.every(
        (question) =>
          question.origin === 'platform_authored' &&
          question.source_refs.every((id) => sources.has(id)) &&
          question.question_type &&
          question.competencies?.length &&
          question.interview_types?.length &&
          question.original_text !== undefined &&
          question.review_action,
      ),
    );
  }
  assert.equal(getJob('java-backend')?.id, 'backend');
  assert.equal(getJob('unknown'), undefined);
});

test('primary-class filtering composes with category and stage filtering', () => {
  const classes = searchJobs({ primary_class: 'frontend-client' });
  assert.ok(classes.length > 0);
  assert.ok(classes.every((job) => job.primary_class_id === 'frontend-client'));
  const first = classes[0];
  const combined = searchJobs({
    primary_class: first.primary_class_id,
    category: first.category_id,
    stage: first.stages[0],
  });
  assert.ok(combined.length > 0);
  assert.ok(
    combined.every(
      (job) =>
        job.primary_class_id === first.primary_class_id &&
        job.category_id === first.category_id &&
        job.stages.includes(first.stages[0]),
    ),
  );
  assert.equal(searchJobs({ primary_class: 'unknown-class' }).length, 0);
  assert.equal(JOB_CLASSES.length, 16);
  assert.equal(ROLE_TAXONOMY.classes.length, 16);
  assert.equal(JOB_CLASSES.reduce((count, jobClass) => count + jobClass.published_count, 0), 1269);
});

test('merged questions are excluded from retrieval, outlines and catalog documents', async () => {
  const documents = buildCatalog();
  const documentIds = new Set(documents.map((document) => document.id));
  const merged = JOBS.flatMap((job) =>
    job.questions.filter((question) => question.status === 'merged'),
  );
  assert.equal(merged.length, 4);
  for (const question of merged) {
    const job = JOBS.find((candidate) =>
      candidate.questions.some((item) => item.id === question.id),
    )!;
    const canonical = job.questions.find((item) => item.id === question.merged_into);
    assert.ok(canonical && canonical.status === 'active');
    assert.ok(!documentIds.has(question.id));
    assert.ok(documentIds.has(canonical.id));
    assert.ok(!knowledgeEntries(job).some((entry) => entry.id === `${question.id}-outline-v${job.version}`));
    const retrieved = await localKnowledgeRetriever.retrieve({ job_id: job.id });
    assert.ok(!retrieved.items.some((item) => item.id === question.id));
    assert.ok(retrieved.items.some((item) => item.id === canonical.id));
  }
  assert.equal(
    documents.filter(
      (document) => document.kind === 'question' && document.evidence_level === 'platform_authored',
    ).length,
    10148,
  );
});

test('runtime-enabled public interview supplements remain a separate filtered retrieval layer', async () => {
  const supplements = PUBLIC_INTERVIEW_SUPPLEMENTS;
  assert.equal(supplements.runtime_enabled, true);
  assert.equal(supplements.human_approved, false);
  assert.equal(supplements.release_eligible, false);
  assert.equal(supplements.questions.length, 48);
  assert.equal(supplements.representative_jobs.length, 20);
  assert.equal(new Set(supplements.questions.map((question) => question.primary_class_id)).size, 16);
  assert.deepEqual(
    supplements.questions.reduce((counts, question) => {
      counts[question.question_type] = (counts[question.question_type] ?? 0) + 1;
      return counts;
    }, {} as Record<string, number>),
    { project: 19, behavioral: 14, hr: 15 },
  );
  const sourceIds = new Set(CONTENT_SOURCES.map((source) => source.id));
  const supplementalIds = new Set(supplements.questions.map((question) => question.id));
  for (const question of supplements.questions) {
    const job = getJob(question.job_id);
    assert.ok(job);
    assert.equal(job.questions.length, 8);
    assert.ok(question.eligible_job_ids.includes(question.job_id));
    assert.ok(job.questions.every((published) => !supplementalIds.has(published.id)));
    assert.equal(question.runtime_enabled, true);
    assert.equal(question.human_approved, false);
    assert.equal(question.release_eligible, false);
    assert.ok(question.source_refs.length && question.source_refs.every((id) => sourceIds.has(id)));
    assert.ok(question.interview_types.length && question.competencies.length);
  }

  const question = supplements.questions.find((item) => item.job_id === 'frontend')!;
  const retrieved = await localKnowledgeRetriever.retrieve({
    job_id: question.job_id,
    stage: question.stages[0],
    topic: question.topic,
    difficulty: question.difficulty,
    interview_type: question.interview_types[0],
  });
  assert.equal(retrieved.items.length, 0);
  assert.ok(retrieved.items.every((item) => !supplementalIds.has(item.id)));
  const mainOnly = await localKnowledgeRetriever.retrieve({ job_id: question.job_id });
  assert.equal(mainOnly.items.length, 8);
  assert.ok(mainOnly.items.every((item) => !supplementalIds.has(item.id)));
  assert.ok(retrieved.supplemental_questions.some((item) => item.id === question.id));
  assert.ok(
    retrieved.supplemental_questions.every((item) => item.eligible_job_ids.includes(question.job_id)),
  );
  const eligibleJob = question.eligible_job_ids.find((id) => id !== question.job_id)!;
  assert.ok(
    (await localKnowledgeRetriever.retrieve({ job_id: eligibleJob })).supplemental_questions.some(
      (item) => item.id === question.id,
    ),
  );
  const ineligibleJob = question.job_id === 'backend' ? 'frontend' : 'backend';
  assert.equal(
    (await localKnowledgeRetriever.retrieve({ job_id: ineligibleJob })).supplemental_questions.some(
      (item) => item.id === question.id,
    ),
    false,
  );
  assert.equal(
    (
      await localKnowledgeRetriever.retrieve({
        job_id: question.job_id,
        topic: '不存在的补充主题',
      })
    ).supplemental_questions.length,
    0,
  );

  const disabled = createJobCatalog(JOBS, CONTENT_SOURCES, [{ ...question, runtime_enabled: false }]);
  assert.equal(
    (await disabled.localKnowledgeRetriever.retrieve({ job_id: question.job_id }))
      .supplemental_questions.length,
    0,
  );
});

test('supplemental catalog records have one document and one binding per eligible job', () => {
  const documents = buildCatalog();
  const supplementalIds = new Set(PUBLIC_INTERVIEW_SUPPLEMENTS.questions.map((question) => question.id));
  const supplemental = documents.filter((document) => supplementalIds.has(document.id));
  assert.equal(supplemental.length, 48);
  assert.equal(
    supplemental.reduce((count, document) => count + document.bindings.length, 0),
    PUBLIC_INTERVIEW_SUPPLEMENTS.questions.reduce(
      (count, question) => count + question.eligible_job_ids.length,
      0,
    ),
  );
  for (const document of supplemental) {
    const question = PUBLIC_INTERVIEW_SUPPLEMENTS.questions.find((item) => item.id === document.id)!;
    assert.equal(document.kind, 'question');
    assert.equal(document.evidence_level, 'source_summary');
    assert.ok(document.text.includes(question.limitations));
    assert.deepEqual(document.source_refs, question.source_refs);
    assert.deepEqual(
      document.bindings.map((binding) => binding.job),
      question.eligible_job_ids,
    );
    assert.ok(
      document.bindings.every(
        (binding) =>
          binding.job &&
          binding.stages.every((stage) =>
            question.stages.includes(stage as (typeof question.stages)[number]),
          ) &&
          binding.types.every((type) => question.interview_types.includes(type)) &&
          binding.goals.every((goal) => question.competencies.includes(goal)),
      ),
    );
  }
});

test('structured interview knowledge combines active main and applicable supplemental questions', async () => {
  const question = PUBLIC_INTERVIEW_SUPPLEMENTS.questions.find(
    (item) => item.job_id === 'frontend' && item.difficulty === '基础',
  )!;
  const knowledge = await structuredInterviewKnowledge.read({
    job: question.job_id,
    career_stage: question.stages[0],
    interview_type: 'mixed',
    difficulty: '基础',
    duration_minutes: 10,
    interviewer_style: '标准',
    interaction_mode: 'text_fallback',
  });
  assert.ok(knowledge.questions.some((item) => item.id.startsWith('frontend-q')));
  assert.ok(knowledge.questions.some((item) => item.id === question.id));
  assert.ok(
    knowledge.questions.some((item) => item.id === 'public-interview-fe-c001' && item.difficulty === '进阶'),
  );
  assert.ok(knowledge.sources.some((source) => question.source_refs.includes(source.id)));

  const advancedOnlyJob = getJob('ecommerce-llm-train')!;
  const fallback = await structuredInterviewKnowledge.read({
    job: advancedOnlyJob.id,
    career_stage: advancedOnlyJob.stages[0],
    interview_type: 'technical_qa',
    difficulty: '基础',
    duration_minutes: 10,
    interviewer_style: '标准',
    interaction_mode: 'text_fallback',
  });
  assert.equal(fallback.questions.length, 8);
  assert.ok(fallback.questions.every((item) => item.difficulty !== '基础'));
});

test('latest-role source candidates remain review-only while published templates use the runtime catalog', async () => {
  const supplements = LATEST_ROLE_SUPPLEMENTS;
  assert.equal(supplements.runtime_enabled, false);
  assert.equal(supplements.human_approved, false);
  assert.equal(supplements.release_eligible, false);
  assert.equal(supplements.roles.length, 269);
  assert.equal(supplements.sources.length, 269);
  assert.equal(new Set(supplements.roles.map((role) => role.primary_class_id)).size, 16);
  assert.equal(JOBS.filter((job) => job.id.startsWith('latest-role-')).length, 269);
  const sourceIds = new Set(supplements.sources.map((source) => source.source_id));
  assert.equal(sourceIds.size, 269);
  assert.ok(supplements.roles.every((role) => sourceIds.has(role.source_id)));
  assert.ok(supplements.roles.every((role) => role.evidence_grade === 'A'));
  assert.ok(supplements.sources.every((source) => source.evidence_grade === 'A'));
  for (const role of supplements.roles) {
    assert.equal(role.review_status, 'in_review');
    assert.equal(role.human_approved, false);
    assert.equal(role.release_eligible, false);
    assert.equal(role.runtime_enabled, false);
    assert.equal(getJob(role.role_id)?.id, role.role_id);
    assert.equal(getJob(role.candidate_id), undefined);
    assert.equal(searchJobs({ search: role.candidate_id }).length, 0);
  }
  const published = await localKnowledgeRetriever.retrieve({
    job_id: supplements.roles[0].role_id,
  });
  assert.equal(published.items.length, 8);
});

test('structured retrieval filters role, stage, topic and supported difficulty without mixing roles', async () => {
  const result = await localKnowledgeRetriever.retrieve({
    job_id: 'ai-product',
    stage: 'campus',
    topic: '评测',
  });
  assert.equal(result.items.length, 1);
  assert.equal(result.template_id, 'ai-product');
  assert.equal(
    (await localKnowledgeRetriever.retrieve({ job_id: 'ai-product', difficulty: '挑战' })).items
      .length,
    0,
  );
  await assert.rejects(() => localKnowledgeRetriever.retrieve({ job_id: 'retired-or-unknown' }));
  assert.ok(searchJobs({ search: 'RAG' }).some((job) => job.id === 'llm-app'));
});

test('retirement excludes a role from new catalog lookup and structured retrieval', async () => {
  const job = getJob('ai-product')!;
  try {
    job.status = 'retired';
    assert.equal(getJob(job.id), undefined);
    assert.equal(searchJobs({ search: job.title }).length, 0);
    await assert.rejects(() => localKnowledgeRetriever.retrieve({ job_id: job.id }));
  } finally {
    job.status = 'published';
  }
});
