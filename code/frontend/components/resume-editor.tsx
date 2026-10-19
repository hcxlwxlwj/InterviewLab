'use client';
import { JOBS, getJob } from '@interviewlab/content';
import { type Experience, type ResumeContent, type ResumeDocument } from '@interviewlab/core';
import { ArrowDown, ArrowUp, Plus, Save, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { demoClient, emptyResumeContent } from '../lib/demo-client';
import { WorkspaceFrame } from './personal-workspace';
import { DemoNotice, EmptyState, Loading, useDemoState } from './shared';
import { Button } from './ui/button';

export default function ResumeEditor() {
  const { id } = useParams<{ id: string }>(),
    state = useDemoState();
  const [draft, setDraft] = useState<ResumeDocument | null>(null),
    [experiences, setExperiences] = useState<Experience[]>([]),
    [dirty, setDirty] = useState(false),
    [message, setMessage] = useState(''),
    [error, setError] = useState(''),
    [showPreview, setShowPreview] = useState(false);
  useEffect(() => {
    if (!state || draft?.id === id) return;
    const r = state.resumes.find((r) => r.id === id);
    if (r) {
      setDraft(structuredClone({ ...r, content: r.content ?? emptyResumeContent() }));
      setExperiences(structuredClone(state.experiences.filter((e) => e.resume_document_id === id)));
    }
  }, [state, id, draft?.id]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  function edit(changes: Partial<ResumeDocument>) {
    setDraft((d) => (d ? { ...d, ...changes } : d));
    setDirty(true);
    setMessage('');
  }
  function content(key: keyof ResumeContent, value: string) {
    if (draft) edit({ content: { ...(draft.content ?? emptyResumeContent()), [key]: value } });
  }
  function experience(index: number, changes: Partial<Experience>) {
    setExperiences((items) => items.map((e, i) => (i === index ? { ...e, ...changes } : e)));
    setDirty(true);
    setMessage('');
  }
  function move(index: number, delta: number) {
    setExperiences((items) => {
      const next = [...items];
      [next[index], next[index + delta]] = [next[index + delta], next[index]];
      return next;
    });
    setDirty(true);
  }
  function addExperience() {
    setExperiences((items) => [
      ...items,
      {
        id: crypto.randomUUID(),
        title: '',
        kind: 'course_project',
        personal_role: '',
        actions: '',
        technical_decisions: '',
        results: '',
        confirmed: false,
        version: 1,
        resume_document_id: id,
      },
    ]);
    setDirty(true);
  }
  function save(e: React.FormEvent) {
    e.preventDefault();
    if (!draft) return;
    try {
      const saved = demoClient.saveResume(draft, experiences, draft.version);
      setDraft(saved);
      setExperiences(demoClient.listExperiences(id));
      setDirty(false);
      setMessage('已保存当前标签页中的简历。');
      setError('');
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <WorkspaceFrame section="resumes">
      {!state ? (
        <Loading />
      ) : !state.resumes.some((r) => r.id === id) ? (
        <EmptyState
          title="简历已不可用"
          description="它可能已被删除。历史面试材料仍可以在对应记录中查看。"
          href="/me/resumes"
          action="返回简历库"
        />
      ) : !draft ? (
        <Loading />
      ) : (
        <>
          <div className="workspace-heading">
            <div>
              <Link className="text-link" href="/me/resumes">
                ← 我的简历
              </Link>
              <h1>编辑简历</h1>
            </div>
            <Button variant="outline" onClick={() => setShowPreview((v) => !v)}>
              {showPreview ? '返回编辑' : '预览简历'}
            </Button>
          </div>
          <DemoNotice compact />
          <form onSubmit={save} className={`resume-editor ${showPreview ? 'preview-only' : ''}`}>
            <div className="resume-edit-fields">
              <section className="library-panel library-form">
                <h2>简历信息</h2>
                <label>
                  简历名称
                  <input
                    required
                    maxLength={100}
                    value={draft.name}
                    onChange={(e) => edit({ name: e.target.value })}
                  />
                </label>
                <label>
                  目标方向
                  <select
                    value={draft.target_job ?? 'frontend'}
                    onChange={(e) => edit({ target_job: e.target.value })}
                  >
                    {JOBS.map((j) => (
                      <option key={j.id} value={j.id}>
                        {j.title}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="field-pair">
                  <label>
                    姓名
                    <input
                      maxLength={100}
                      value={draft.content?.full_name ?? ''}
                      onChange={(e) => content('full_name', e.target.value)}
                    />
                  </label>
                  <label>
                    联系电话
                    <input
                      type="tel"
                      maxLength={50}
                      value={draft.content?.phone ?? ''}
                      onChange={(e) => content('phone', e.target.value)}
                    />
                  </label>
                </div>
                <label>
                  邮箱
                  <input
                    type="email"
                    maxLength={200}
                    value={draft.content?.email ?? ''}
                    onChange={(e) => content('email', e.target.value)}
                  />
                </label>
                {(
                  [
                    ['education', '教育背景', 3],
                    ['skills', '技能', 3],
                    ['summary', '自我介绍', 3],
                    ['raw_text', '粘贴补充文本', 5],
                  ] as const
                ).map(([key, label, rows]) => (
                  <label key={key}>
                    {label}
                    <textarea
                      maxLength={12000}
                      rows={rows}
                      value={draft.content?.[key] ?? ''}
                      onChange={(e) => content(key, e.target.value)}
                    />
                  </label>
                ))}
                <p className="muted">PDF / DOCX 文件上传、解析和下载尚未接入。</p>
              </section>
              <section className="library-panel library-form">
                <div className="section-title-row">
                  <h2>经历</h2>
                  <Button type="button" variant="outline" size="sm" onClick={addExperience}>
                    <Plus size={17} />
                    添加经历
                  </Button>
                </div>
                {!experiences.length && (
                  <p className="muted">添加课程、比赛、科研、实习或其他经历。</p>
                )}
                {experiences.map((exp, i) => (
                  <fieldset key={exp.id} className="experience-editor">
                    <legend>经历 {i + 1}</legend>
                    <div className="row-actions">
                      <button
                        type="button"
                        className="icon-button"
                        aria-label={`上移经历${i + 1}`}
                        disabled={i === 0}
                        onClick={() => move(i, -1)}
                      >
                        <ArrowUp size={17} />
                      </button>
                      <button
                        type="button"
                        className="icon-button"
                        aria-label={`下移经历${i + 1}`}
                        disabled={i === experiences.length - 1}
                        onClick={() => move(i, 1)}
                      >
                        <ArrowDown size={17} />
                      </button>
                      <button
                        type="button"
                        className="icon-button"
                        aria-label={`移除经历${i + 1}`}
                        onClick={() => {
                          setExperiences((items) => items.filter((e) => e.id !== exp.id));
                          setDirty(true);
                        }}
                      >
                        <Trash2 size={17} />
                      </button>
                    </div>
                    <label>
                      经历名称
                      <input
                        required
                        maxLength={200}
                        value={exp.title}
                        onChange={(e) => experience(i, { title: e.target.value })}
                      />
                    </label>
                    <label>
                      经历类型
                      <select
                        value={exp.kind}
                        onChange={(e) =>
                          experience(i, { kind: e.target.value as Experience['kind'] })
                        }
                      >
                        {Object.entries({
                          course_project: '课程项目',
                          competition: '比赛',
                          research: '科研',
                          graduation_project: '毕业设计',
                          internship: '实习',
                          other: '其他',
                        }).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>
                    {(
                      [
                        ['personal_role', '我的职责'],
                        ['actions', '实际完成的工作'],
                        ['technical_decisions', '方案选择与依据'],
                        ['results', '结果与验证'],
                      ] as const
                    ).map(([key, label]) => (
                      <label key={key}>
                        {label}
                        <textarea
                          rows={2}
                          maxLength={5000}
                          value={exp[key]}
                          onChange={(e) => experience(i, { [key]: e.target.value })}
                        />
                      </label>
                    ))}
                    <label className="inline-check">
                      <input
                        type="checkbox"
                        checked={exp.confirmed}
                        onChange={(e) => experience(i, { confirmed: e.target.checked })}
                      />
                      我已确认这段经历及个人贡献，可用于面试
                    </label>
                  </fieldset>
                ))}
              </section>
            </div>
            <aside className="resume-live-preview library-panel" aria-label="简历内容预览">
              <span className="muted">
                内容预览 · v{draft.version}
                {dirty ? ' · 有未保存修改' : ''}
              </span>
              <h2>{draft.content?.full_name || '姓名待填写'}</h2>
              <p>{getJob(draft.target_job ?? '')?.title}</p>
              {(draft.content?.email || draft.content?.phone) && (
                <p>{[draft.content.email, draft.content.phone].filter(Boolean).join(' · ')}</p>
              )}
              {(
                [
                  ['education', '教育背景'],
                  ['skills', '技能'],
                  ['summary', '自我介绍'],
                ] as const
              ).map(([key, title]) =>
                draft.content?.[key] ? (
                  <section key={key}>
                    <h3>{title}</h3>
                    <p>{draft.content[key]}</p>
                  </section>
                ) : null,
              )}
              {experiences.length > 0 && (
                <section>
                  <h3>经历</h3>
                  {experiences.map((e) => (
                    <div className="preview-experience" key={e.id}>
                      <h4>{e.title || '经历名称待填写'}</h4>
                      <p>{e.personal_role}</p>
                      <p>{e.actions}</p>
                      <p>{e.technical_decisions}</p>
                      <p>{e.results}</p>
                      {!e.confirmed && (
                        <span className="muted">尚未确认，不会作为重点经历使用</span>
                      )}
                    </div>
                  ))}
                </section>
              )}
              {draft.content?.raw_text && (
                <section>
                  <h3>补充内容</h3>
                  <p>{draft.content.raw_text}</p>
                </section>
              )}
            </aside>
            <div className="resume-savebar">
              {error ? (
                <span role="alert" className="error-inline">
                  {error}
                </span>
              ) : (
                <span role="status">
                  {message || (dirty ? '有未保存的修改' : '已与当前标签页同步')}
                </span>
              )}
              <Button type="submit">
                <Save size={17} />
                保存简历
              </Button>
            </div>
          </form>
        </>
      )}
    </WorkspaceFrame>
  );
}
