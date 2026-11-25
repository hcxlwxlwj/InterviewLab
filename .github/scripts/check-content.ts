import {
  ALL_JOB_TEMPLATES,
  CONTENT_SOURCES,
  JOB_CATEGORIES,
  JOB_CLASSES,
  LATEST_ROLE_SUPPLEMENTS,
  PUBLIC_INTERVIEW_SUPPLEMENTS,
  ROLE_TAXONOMY,
  teacherAgentQuestions,
} from '@interviewlab/backend/content';
import { buildCatalog } from '../../code/backend/src/modules/knowledge/catalog';
import assert from 'node:assert/strict';

const EXPECTED = {
  jobs: 1269,
  originalJobs: 1000,
  latestJobs: 269,
  originalQuestionRecords: 8000,
  activeOriginalQuestions: 7996,
  mergedQuestions: 4,
  activeMainQuestions: 10148,
  supplementalQuestions: 48,
  teacherQuestions: 98,
  catalogQuestionDocuments: 10294,
  originalSources: 1639,
  latestSources: 269,
  publicInterviewSources: 54,
  sources: 1962,
} as const;

export function validateContent() {
  const sourceIds = new Set(CONTENT_SOURCES.map((source) => source.id));
  const sourcesById = new Map(CONTENT_SOURCES.map((source) => [source.id, source] as const));
  const jobIds = new Set<string>();
  const questionIds = new Set<string>();
  const mergedQuestionIds = new Set<string>();
  const publishedJobs = ALL_JOB_TEMPLATES.filter((job) => job.status === 'published');
  const publishedById = new Map(publishedJobs.map((job) => [job.id, job] as const));
  const classesById = new Map(ROLE_TAXONOMY.classes.map((jobClass) => [jobClass.id, jobClass] as const));
  const questionTypes = new Set(['technical', 'business_scenario', 'behavioral', 'project', 'hr']);
  const interviewTypes = new Set([
    'technical_qa',
    'business_scenario',
    'project_deep_dive',
    'hr',
    'mixed',
  ]);
  let originalJobs = 0;
  let latestJobs = 0;
  let originalQuestionRecords = 0;
  let activeOriginalQuestions = 0;
  let activeMainQuestions = 0;
  let mergedQuestions = 0;

  assert.equal(sourceIds.size, CONTENT_SOURCES.length, '来源ID重复');
  assert.equal(CONTENT_SOURCES.length, EXPECTED.sources);
  assert.equal(JOB_CLASSES.length, 16);
  assert.equal(
    JOB_CLASSES.reduce((count, jobClass) => count + jobClass.published_count, 0),
    EXPECTED.jobs,
  );
  for (const source of CONTENT_SOURCES) {
    assert.match(source.url, /^https?:\/\//);
    assert.ok(source.reviewed_at && source.acquired_at);
    assert.equal(source.usage, 'reference_only');
  }
  assert.equal(
    CONTENT_SOURCES.filter((source) => source.id.startsWith('latest-role-source-')).length,
    EXPECTED.latestSources,
  );
  assert.equal(
    CONTENT_SOURCES.filter((source) => source.kind === 'public_interview').length,
    EXPECTED.publicInterviewSources,
  );
  assert.equal(
    CONTENT_SOURCES.length - EXPECTED.latestSources - EXPECTED.publicInterviewSources,
    EXPECTED.originalSources,
  );

  for (const job of ALL_JOB_TEMPLATES) {
    assert.ok(!jobIds.has(job.id), `岗位ID重复 ${job.id}`);
    jobIds.add(job.id);
    assert.ok(JOB_CATEGORIES.some((category) => category.id === job.category_id));
    assert.ok(['draft', 'reviewed', 'published', 'retired'].includes(job.status));
    if (job.status !== 'published') continue;

    const jobClass = classesById.get(job.primary_class_id ?? '');
    assert.ok(jobClass, `${job.id} 一级大类不存在`);
    assert.ok(
      jobClass.role_families.some((family) => family.id === job.role_family_id),
      `${job.id} 岗位族不属于一级大类`,
    );
    assert.ok(Array.isArray(job.scenario_tags));
    assert.ok(
      job.version > 0 &&
        job.review_method &&
        ['platform_original', 'public_source_original'].includes(job.authorship),
    );
    assert.ok(job.topics.length >= 6 && job.topics.length <= 10, `${job.id} 主题数`);
    assert.equal(job.questions.length, 8, `${job.id} 主问题记录数`);
    assert.ok(job.responsibilities.length && job.requirements.length && job.preferred.length);
    assert.ok(job.source_refs.length >= 2 && job.source_refs.every((id) => sourceIds.has(id)));
    const sources = CONTENT_SOURCES.filter((source) => job.source_refs.includes(source.id));
    assert.ok(
      sources.some((source) => source.kind === 'recruitment') &&
        sources.some((source) => source.kind === 'official_documentation'),
    );
    const days = (Date.parse(job.review_due_at) - Date.parse(job.reviewed_at)) / 86400000;
    assert.equal(
      days,
      job.category_id === 'ai' || job.id === 'ai-product' ? 30 : 90,
      `${job.id} 复核周期`,
    );

    if (job.id.startsWith('latest-role-')) latestJobs += 1;
    else {
      originalJobs += 1;
      originalQuestionRecords += job.questions.length;
    }
    for (const question of job.questions) {
      assert.ok(!questionIds.has(question.id), `题目ID重复 ${question.id}`);
      questionIds.add(question.id);
      assert.ok(
        job.topics.includes(question.topic) &&
          question.text.length > 8 &&
          question.intent &&
          question.observation_points.length,
      );
      assert.ok(
        question.follow_ups.length >= 1 &&
          question.follow_ups.length <= 2 &&
          question.follow_ups.every(Boolean),
      );
      assert.ok(
        question.stages.length &&
          question.source_refs.length &&
          question.source_refs.every((id) => sourceIds.has(id)),
      );
      assert.equal(question.origin, 'platform_authored');
      assert.ok(question.question_type && questionTypes.has(question.question_type));
      assert.ok(question.competencies?.length);
      assert.ok(
        question.interview_types?.length &&
          question.interview_types.every((type) => interviewTypes.has(type)),
      );
      assert.ok(['active', 'merged'].includes(question.status ?? ''));
      assert.ok(
        ['keep', 'rewrite', 'merge', 'adapted_from_audited_question'].includes(
          question.review_action ?? '',
        ),
      );
      assert.equal(typeof question.original_text, 'string');
      if (question.status === 'merged') {
        mergedQuestions += 1;
        mergedQuestionIds.add(question.id);
        if (!job.id.startsWith('latest-role-')) {
          assert.equal(question.review_action, 'merge');
        }
        assert.ok(question.merged_into && question.merged_into !== question.id);
        const canonical = job.questions.find((candidate) => candidate.id === question.merged_into);
        assert.ok(canonical && canonical.status === 'active', `${question.id} 合并目标无效`);
      } else {
        activeMainQuestions += 1;
        if (!job.id.startsWith('latest-role-')) activeOriginalQuestions += 1;
      }
    }
  }

  assert.equal(publishedJobs.length, EXPECTED.jobs);
  assert.equal(originalJobs, EXPECTED.originalJobs);
  assert.equal(latestJobs, EXPECTED.latestJobs);
  assert.equal(originalQuestionRecords, EXPECTED.originalQuestionRecords);
  assert.equal(activeOriginalQuestions, EXPECTED.activeOriginalQuestions);
  assert.equal(activeMainQuestions, EXPECTED.activeMainQuestions);
  assert.equal(mergedQuestions, EXPECTED.mergedQuestions);
  assert.equal(questionIds.size, EXPECTED.originalQuestionRecords + EXPECTED.latestJobs * 8);
  assert.equal(
    teacherAgentQuestions.reduce((count, set) => count + set.questions.length, 0),
    EXPECTED.teacherQuestions,
  );
  const documents = buildCatalog();
  const authoredSupplementalIds = new Set(
    PUBLIC_INTERVIEW_SUPPLEMENTS.questions.map((question) => question.id),
  );
  assert.equal(
    documents.filter((document) => document.kind === 'question').length,
    EXPECTED.catalogQuestionDocuments,
  );
  assert.equal(
    documents.filter(
      (document) => document.kind === 'question' && document.evidence_level === 'platform_authored',
    ).length,
    EXPECTED.activeMainQuestions,
  );
  assert.equal(
    documents.filter(
      (document) => document.kind === 'question' && authoredSupplementalIds.has(document.id),
    ).length,
    EXPECTED.supplementalQuestions,
  );
  assert.equal(
    documents.filter((document) => document.id.startsWith('teacher-issue-')).length,
    EXPECTED.teacherQuestions,
  );
  assert.ok(!documents.some((document) => mergedQuestionIds.has(document.id)));

  const supplements = PUBLIC_INTERVIEW_SUPPLEMENTS;
  assert.equal(supplements.taxonomy_version, 'role-taxonomy-v2');
  assert.equal(supplements.classification_status, 'pending_review');
  assert.equal(supplements.review_status, 'in_review');
  assert.equal(supplements.human_approved, false);
  assert.equal(supplements.release_eligible, false);
  assert.equal(supplements.runtime_enabled, true);
  assert.equal(supplements.preservation.published_job_count, publishedJobs.length);
  assert.equal(supplements.preservation.published_question_count, activeMainQuestions);
  assert.equal(
    supplements.preservation.supplemental_question_count,
    supplements.questions.length,
  );
  assert.equal(supplements.questions.length, EXPECTED.supplementalQuestions);
  assert.equal(supplements.representative_jobs.length, 20);
  assert.equal(new Set(supplements.questions.map((question) => question.primary_class_id)).size, 16);
  const supplementalIds = new Set<string>();
  const sourceUsage = new Map<string, number>();
  for (const question of supplements.questions) {
    assert.ok(!supplementalIds.has(question.id), `审核补充题目ID重复 ${question.id}`);
    assert.ok(!questionIds.has(question.id), `审核补充题目与已发布题目ID冲突 ${question.id}`);
    supplementalIds.add(question.id);
    const representative = publishedById.get(question.job_id);
    assert.ok(representative, `审核补充题目岗位不存在 ${question.job_id}`);
    assert.equal(representative.primary_class_id, question.primary_class_id);
    assert.equal(representative.role_family_id, question.role_family_id);
    const jobClass = classesById.get(question.primary_class_id);
    assert.ok(jobClass?.role_families.some((family) => family.id === question.role_family_id));
    assert.ok(['project', 'behavioral', 'hr'].includes(question.question_type));
    assert.ok(question.text.length > 12 && question.intent && question.topic);
    assert.ok(question.observation_points.length && question.follow_ups.length);
    assert.ok(question.competencies.length);
    assert.ok(
      question.interview_types.length &&
        question.interview_types.every((type) => interviewTypes.has(type)),
    );
    assert.ok(
      question.stages.length &&
        question.stages.every((stage) => ['internship', 'campus'].includes(stage)),
    );
    assert.ok(['基础', '进阶', '挑战'].includes(question.difficulty));
    assert.ok(question.eligible_job_ids.includes(question.job_id));
    assert.equal(new Set(question.eligible_job_ids).size, question.eligible_job_ids.length);
    for (const jobId of question.eligible_job_ids) {
      const job = publishedById.get(jobId);
      assert.ok(job, `审核补充题目适用岗位不存在 ${jobId}`);
      assert.equal(job.primary_class_id, question.primary_class_id);
    }
    assert.ok(question.source_refs.length);
    assert.equal(new Set(question.source_refs).size, question.source_refs.length);
    assert.ok(question.source_refs.every((id) => sourceIds.has(id)));
    assert.ok(
      question.source_refs.every((id) => sourcesById.get(id)?.kind === 'public_interview'),
    );
    assert.ok(question.source_ids.length && question.source_ids.length === question.source_urls.length);
    for (const [index, sourceId] of question.source_ids.entries()) {
      const source = sourcesById.get(sourceId);
      assert.ok(source, `审核补充题目来源不存在 ${sourceId}`);
      assert.ok(question.source_refs.includes(sourceId));
      assert.equal(question.source_urls[index], source.url);
      sourceUsage.set(sourceId, (sourceUsage.get(sourceId) ?? 0) + 1);
    }
    assert.equal(question.evidence_grade, 'B');
    assert.equal(question.review_status, 'in_review');
    assert.equal(question.human_approved, false);
    assert.equal(question.release_eligible, false);
    assert.equal(question.runtime_enabled, true);
    const text = [
      question.text,
      question.intent,
      ...question.follow_ups,
      question.limitations,
    ].join(' ');
    assert.doesNotMatch(text, /[\w.+-]+@[\w-]+\.[\w.-]+/);
    assert.doesNotMatch(text, /(?<!\d)1[3-9]\d{9}(?!\d)/);
    assert.doesNotMatch(text, /(?<!\d)\d{17}[\dXx](?!\d)/);
  }
  assert.ok([...sourceUsage.values()].every((count) => count <= 2));
  for (const representative of supplements.representative_jobs) {
    assert.ok(publishedById.has(representative.job_id));
    assert.equal(representative.candidate_count, representative.candidate_ids.length);
    assert.equal(
      representative.candidate_count,
      supplements.questions.filter((question) => question.job_id === representative.job_id)
        .length,
    );
  }

  const latestRoles = LATEST_ROLE_SUPPLEMENTS;
  assert.equal(latestRoles.taxonomy_version, 'role-taxonomy-v2');
  assert.equal(latestRoles.classification_status, 'pending_review');
  assert.equal(latestRoles.review_status, 'in_review');
  assert.equal(latestRoles.human_approved, false);
  assert.equal(latestRoles.release_eligible, false);
  assert.equal(latestRoles.runtime_enabled, false);
  assert.equal(latestRoles.preservation.published_job_count, publishedJobs.length);
  assert.equal(latestRoles.preservation.published_source_count, sourceIds.size);
  assert.equal(latestRoles.preservation.published_question_count, activeMainQuestions);
  assert.equal(latestRoles.preservation.supplemental_role_candidate_count, EXPECTED.latestJobs);
  assert.equal(latestRoles.roles.length, EXPECTED.latestJobs);
  assert.equal(latestRoles.sources.length, EXPECTED.latestSources);
  assert.equal(new Set(latestRoles.roles.map((role) => role.primary_class_id)).size, 16);
  const latestRoleIds = new Set<string>();
  const latestSourceIds = new Set<string>();
  const latestPostingIds = new Set<string>();
  const latestDomainCounts = new Map<string, number>();
  const latestPageCounts = new Map<string, number>();
  const latestIndependentSources = new Map<string, Set<string>>();
  const latestSourcesById = new Map(
    latestRoles.sources.map((source) => [source.source_id, source] as const),
  );
  for (const role of latestRoles.roles) {
    assert.ok(!latestRoleIds.has(role.role_id), `岗位候选ID重复 ${role.role_id}`);
    latestRoleIds.add(role.role_id);
    const published = publishedById.get(role.role_id);
    assert.ok(published, `已发布最新岗位缺失 ${role.role_id}`);
    assert.equal(published.primary_class_id, role.primary_class_id);
    assert.equal(published.role_family_id, role.role_family_id);
    assert.ok(published.source_refs.includes(role.source_id));
    assert.ok(!publishedById.has(role.candidate_id), '原始候选ID不得进入运行时岗位查找');
    assert.ok(!latestSourceIds.has(role.source_id), `岗位候选来源ID重复 ${role.source_id}`);
    latestSourceIds.add(role.source_id);
    assert.ok(sourceIds.has(role.source_id), `已发布来源缺失 ${role.source_id}`);
    assert.equal(sourcesById.get(role.source_id)?.kind, 'recruitment');
    const postingKey = `${role.source_domain}|${role.source_posting_id}`;
    assert.ok(!latestPostingIds.has(postingKey), `岗位候选来源职位ID重复 ${postingKey}`);
    latestPostingIds.add(postingKey);
    assert.equal(latestSourcesById.get(role.source_id)?.role_id, role.role_id);
    assert.equal(latestSourcesById.get(role.source_id)?.source_posting_id, role.source_posting_id);
    assert.match(role.source_url, /^https:\/\//);
    assert.match(role.source_page_url, /^https:\/\//);
    assert.equal(role.access_status, 'public_full_text_read');
    assert.equal(role.evidence_grade, 'A');
    assert.equal(latestSourcesById.get(role.source_id)?.evidence_grade, 'A');
    assert.ok(role.freshness_date >= '2026-07-01' && role.freshness_date <= '2026-11-25');
    assert.ok(role.freshness_basis && role.title_zh && role.publisher && role.location_scope);
    assert.equal(role.review_status, 'in_review');
    assert.equal(role.human_approved, false);
    assert.equal(role.release_eligible, false);
    assert.equal(role.runtime_enabled, false);
    const text = [
      role.title_zh,
      role.publisher,
      role.responsibilities_summary_zh,
      role.requirements_summary_zh,
      ...role.limitations,
    ].join(' ');
    assert.doesNotMatch(text, /[\w.+-]+@[\w-]+\.[\w.-]+/);
    assert.doesNotMatch(text, /(?<!\d)1[3-9]\d{9}(?!\d)/);
    assert.doesNotMatch(text, /(?<!\d)\d{17}[\dXx](?!\d)/);
    latestDomainCounts.set(role.source_domain, (latestDomainCounts.get(role.source_domain) ?? 0) + 1);
    latestPageCounts.set(role.source_page_url, (latestPageCounts.get(role.source_page_url) ?? 0) + 1);
    if (!role.source_domain.endsWith('.edu.cn')) {
      const sources = latestIndependentSources.get(role.primary_class_id) ?? new Set<string>();
      sources.add(role.source_domain);
      latestIndependentSources.set(role.primary_class_id, sources);
    }
  }
  assert.ok(latestDomainCounts.size >= 8);
  assert.ok([...latestDomainCounts.values()].every((count) => count <= 80));
  assert.ok([...latestPageCounts.values()].every((count) => count <= 60));
  for (const classId of new Set(latestRoles.roles.map((role) => role.primary_class_id))) {
    const minimum = classId === 'game-development' ? 1 : 2;
    assert.ok(
      (latestIndependentSources.get(classId)?.size ?? 0) >= minimum,
      `${classId} 独立来源不足`,
    );
  }
  return {
    templates: publishedJobs.size,
    original_question_records: originalQuestionRecords,
    active_original_questions: activeOriginalQuestions,
    questions: activeMainQuestions,
    merged_questions: mergedQuestions,
    sources: sourceIds.size,
    review_supplements: supplementalIds.size,
    latest_role_candidates: latestRoleIds.size,
  };
}
console.log('内容校验通过', validateContent());
const due = ALL_JOB_TEMPLATES.filter(
  (job) => job.status === 'published' && Date.parse(job.review_due_at) <= Date.now(),
);
console.log(`到期复核 ${due.length} 项`);
for (const job of due) console.log(`${job.id}\t${job.title}\t${job.review_due_at}`);
