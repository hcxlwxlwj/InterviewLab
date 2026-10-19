import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { commitAnswer, defaultConfiguration, finishSession } from '@interviewlab/core';
import {
  deleteDemoSession,
  deleteResume,
  demoClient,
  newConfiguration,
  readDemo,
  resetDemo,
  setDefaultResume,
  updatePreferences,
  migrateDemo,
  storageAvailable,
} from '../../code/frontend/lib/demo-client';
class MemoryStorage {
  values = new Map<string, string>();
  get length() {
    return this.values.size;
  }
  key(index: number) {
    return [...this.values.keys()][index] ?? null;
  }
  getItem(key: string) {
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
  removeItem(key: string) {
    this.values.delete(key);
  }
}
const storage = new MemoryStorage();
Object.defineProperty(globalThis, 'window', {
  value: { sessionStorage: storage, dispatchEvent: () => true },
  configurable: true,
});
beforeEach(() => resetDemo());
test('changing resume cannot smuggle experiences from another resume into the snapshot', () => {
  const config = {
    ...defaultConfiguration(),
    resume_document_id: 'resume-backend',
    focus_experience_ids: ['exp-market', 'exp-library'],
  };
  const session = demoClient.createSession(config);
  assert.deepEqual(session.configuration.focus_experience_ids, ['exp-library']);
  assert.equal(session.material_snapshot.resume?.id, 'resume-backend');
  assert.equal(session.material_snapshot.experiences.length, 1);
  assert.equal(session.configuration.interaction_mode, 'text_fallback');
});
test('default deletion leaves selection empty instead of auto-selecting a different resume', () => {
  setDefaultResume('resume-backend');
  deleteResume('resume-backend');
  assert.equal(readDemo().resumes.filter((r) => r.is_default).length, 0);
  assert.equal(newConfiguration().resume_document_id, undefined);
  assert.deepEqual(newConfiguration().focus_experience_ids, []);
});
test('preference changes only affect new configurations', () => {
  const created = demoClient.createSession(defaultConfiguration());
  updatePreferences({ default_job_direction: 'backend' });
  assert.equal(newConfiguration().job, 'backend');
  assert.equal(demoClient.getSession(created.id)?.configuration.job, 'frontend');
});
test('retry preserves original revision and deleting source unlinks without deleting independent retry', () => {
  const original = demoClient.getSession('sample-interview')!;
  const retry = demoClient.createSession(original.configuration, {
    session_id: original.id,
    turn_id: original.turns[0].id,
  });
  assert.equal(retry.questions.length, 1);
  const next = finishSession(
    commitAnswer(retry, '第二份虚构回答', 'answer', 'new', Date.now()),
    Date.now(),
  );
  demoClient.saveSession(next);
  assert.equal(
    demoClient.getSession(original.id)?.turns[0].answer_text,
    original.turns[0].answer_text,
  );
  deleteDemoSession(original.id);
  assert.equal(demoClient.getSession(original.id), undefined);
  assert.equal(demoClient.getSession(retry.id)?.parent_session_id, undefined);
  assert.equal(demoClient.getSession(retry.id)?.turns[0].answer_text, '第二份虚构回答');
});
test('reset clears interview and code drafts while keeping unrelated storage', () => {
  storage.setItem('interviewlab-answer-test', 'draft');
  storage.setItem('interviewlab-code-test', 'code');
  storage.setItem('unrelated', 'keep');
  demoClient.createSession(defaultConfiguration());
  resetDemo();
  assert.equal(storage.getItem('interviewlab-answer-test'), null);
  assert.equal(storage.getItem('interviewlab-code-test'), null);
  assert.equal(storage.getItem('unrelated'), 'keep');
  assert.equal(readDemo().sessions.length, 1);
});
test('corrupt or incompatible storage recovers without crashing', () => {
  storage.setItem('interviewlab-demo-v2', '{broken');
  assert.equal(readDemo().schema, 2);
  storage.setItem('interviewlab-demo-v2', JSON.stringify({ schema: 99 }));
  assert.equal(readDemo().sessions[0].is_sample, true);
});

test('v1 migration preserves records and deleted resumes without reviving their experiences', () => {
  const current = readDemo();
  const migrated = migrateDemo({
    schema: 1,
    sessions: current.sessions,
    resumes: current.resumes.slice(0, 1),
    preferences: current.preferences,
  })!;
  assert.equal(migrated.schema, 2);
  assert.deepEqual(migrated.sessions, current.sessions);
  assert.equal(migrated.resumes.length, 1);
  assert.ok(migrated.experiences.every((e) => e.resume_document_id === migrated.resumes[0].id));
  storage.removeItem('interviewlab-demo-v2');
  storage.setItem(
    'interviewlab-demo-v1',
    JSON.stringify({
      schema: 1,
      sessions: current.sessions,
      resumes: current.resumes,
      preferences: current.preferences,
    }),
  );
  assert.equal(readDemo().schema, 2);
  assert.ok(storage.getItem('interviewlab-demo-v2'));
});

test('resume copies have independent experience ids, optimistic saves, and immutable past snapshots', () => {
  const session = demoClient.createSession(defaultConfiguration());
  const copy = demoClient.duplicateResume('resume-frontend');
  const experiences = demoClient.listExperiences(copy.id);
  assert.equal(experiences.length, 2);
  assert.ok(
    experiences.every(
      (e) => e.resume_document_id === copy.id && !['exp-market', 'exp-schedule'].includes(e.id),
    ),
  );
  const saved = demoClient.saveResume(
    { ...copy, name: 'AI产品方向', target_job: 'ai-product' },
    experiences,
    copy.version,
  );
  assert.throws(() => demoClient.saveResume(copy, experiences, copy.version), /更新/);
  demoClient.renameResume('resume-frontend', '已修改的材料');
  demoClient.deleteResume('resume-frontend');
  assert.equal(demoClient.getSession(session.id)!.material_snapshot.resume?.name, '前端项目版');
  assert.equal(demoClient.listResumes().find((r) => r.id === copy.id)?.version, saved.version);
});

test('bookmarks are unique and deleting a resume clears only future target associations', () => {
  assert.equal(demoClient.toggleBookmark('ai-product'), true);
  let b = readDemo().bookmarks[0];
  demoClient.updateBookmark(
    b.template_id,
    { notes: '准备AI产品', preferred_resume_id: 'resume-frontend' },
    b.version,
  );
  assert.throws(
    () => demoClient.updateBookmark(b.template_id, { notes: 'stale' }, b.version),
    /变化/,
  );
  demoClient.deleteResume('resume-frontend');
  b = readDemo().bookmarks[0];
  assert.equal(b.preferred_resume_id, undefined);
  assert.equal(b.notes, '准备AI产品');
  assert.equal(demoClient.toggleBookmark('ai-product'), false);
  assert.equal(readDemo().bookmarks.length, 0);
});

test('saved JD versions and template sources freeze at session start; unsafe links are rejected', () => {
  const target = demoClient.saveJobTarget(
    {
      id: 'target-1',
      title: 'AI产品实习',
      company: '合成企业',
      job: 'ai-product',
      jd_text: '设计用户访谈与AI评测',
      source_url: 'https://example.com/job',
      notes: '',
      source_kind: 'custom_jd',
      version: 0,
      created_at: '',
      updated_at: '',
    },
    0,
  );
  const config = {
    ...newConfiguration('ai-product'),
    job_target_id: target.id,
    job_target_version: target.version,
    jd_source: 'custom' as const,
    jd_text: target.jd_text,
    interview_type: 'technical_qa' as const,
    code_assessment_enabled: true,
  };
  const session = demoClient.createSession(config);
  assert.equal(session.configuration.code_assessment_enabled, false);
  assert.ok(session.questions.some((q) => q.text.includes('大模型')));
  assert.ok(session.questions.every((q) => q.knowledge_question_id && q.source_refs?.length));
  demoClient.saveJobTarget({ ...target, jd_text: '新版JD' }, target.version);
  assert.equal(
    demoClient.getSession(session.id)!.material_snapshot.job_target?.jd_text,
    target.jd_text,
  );
  assert.throws(() => demoClient.createSession(config), /变化/);
  assert.throws(
    () =>
      demoClient.saveJobTarget({ ...target, id: 'unsafe', source_url: 'javascript:alert(1)' }, 0),
    /http/,
  );
  demoClient.deleteJobTarget(target.id);
  assert.equal(
    demoClient.getSession(session.id)!.material_snapshot.job_template?.version,
    session.configuration.job_template_version,
  );
  assert.equal(demoClient.getSession(session.id)!.material_snapshot.knowledge_sources?.length, 2);
});

test('stale resume and unknown job cannot silently start another interview', () => {
  assert.throws(() => newConfiguration('unknown-role'), /不可用/);
  const config = newConfiguration('frontend');
  demoClient.renameResume('resume-frontend', '新版');
  assert.throws(() => demoClient.createSession(config), /版本/);
  const r = demoClient.createResume('个人版', 'product');
  assert.equal(r.is_sample, false);
  demoClient.reset();
  assert.equal(
    readDemo().resumes.some((x) => x.id === r.id),
    false,
  );
});

test('storage write failure keeps the latest in-memory edit and reports temporary storage', () => {
  const original = storage.setItem;
  storage.setItem = () => {
    throw new Error('quota');
  };
  try {
    const resume = demoClient.createResume('容量不足时的新材料', 'product');
    assert.equal(storageAvailable(), false);
    assert.ok(readDemo().resumes.some((r) => r.id === resume.id));
    demoClient.renameResume(resume.id, '仍保留最新修改');
    assert.equal(readDemo().resumes.find((r) => r.id === resume.id)?.name, '仍保留最新修改');
  } finally {
    storage.setItem = original;
    resetDemo();
  }
});
