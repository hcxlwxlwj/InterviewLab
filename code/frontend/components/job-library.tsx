'use client';
import {
  STAGE_LABELS,
  type CareerStage,
  type JobTemplate,
  type ContentSource,
} from '@interviewlab/core';
import { ArrowRight, Bookmark, Copy, ExternalLink, Search } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { jobsApi } from '../lib/api/jobs';
import { ErrorNotice, useLiveResource } from '../features/live-interview/common';
import { EmptyState, Footer, Header, Loading } from './shared';
import { Button } from './ui/button';

export function JobLibrary() {
  const params = useSearchParams();
  const [cursor, setCursor] = useState('');
  const [query, setQuery] = useState(''),
    [category, setCategory] = useState(params.get('category') ?? ''),
    [stage, setStage] = useState<CareerStage | ''>('');
  useEffect(() => {
    setCategory(params.get('category') ?? '');
    setCursor('');
  }, [params]);
  const load = useCallback(
    (signal: AbortSignal) => {
      const querystring = new URLSearchParams({ limit: '20' });
      if (query) querystring.set('search', query);
      if (category) querystring.set('category', category);
      if (stage) querystring.set('stage', stage);
      if (cursor) querystring.set('cursor', cursor);
      return jobsApi.list(querystring.toString(), signal);
    },
    [query, category, stage, cursor],
  );
  const resource = useLiveResource(load, () => false);
  const categoriesLoad = useCallback((signal: AbortSignal) => jobsApi.categories(signal), []);
  const categories = useLiveResource(categoriesLoad, () => false);
  const jobs = resource.value?.items ?? [];
  return (
    <>
      <Header />
      <main id="main-content" className="jobs-page">
        <section className="jobs-banner">
          <div className="container jobs-banner-inner">
            <div>
              <h1>岗位库</h1>
              <p>选一个方向，把准备做得更具体。</p>
            </div>
            <div className="jobs-search-controls">
              <label className="search-box">
                <Search size={21} />
                <input
                  aria-label="搜索岗位或技能"
                  placeholder="搜索岗位或技能，如 Agent、产品、SQL"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setCursor('');
                  }}
                />
              </label>
              <div className="row-actions">
                <span>适用阶段</span>
                <div className="segmented" role="group" aria-label="筛选适用阶段">
                  {(['', 'internship', 'campus'] as const).map((s) => (
                    <button
                      key={s}
                      aria-pressed={stage === s}
                      onClick={() => {
                        setStage(s);
                        setCursor('');
                      }}
                    >
                      {s ? STAGE_LABELS[s] : '全部'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
        <div className="container jobs-layout">
          <aside className="job-categories">
            <h2>方向分类</h2>
            <nav aria-label="岗位方向">
              <button
                aria-pressed={!category}
                onClick={() => {
                  setCategory('');
                  setCursor('');
                }}
              >
                全部方向
              </button>
              {categories.value?.items.map((c) => (
                <button
                  key={c.id}
                  aria-pressed={category === c.id}
                  onClick={() => {
                    setCategory(c.id);
                    setCursor('');
                  }}
                >
                  {c.title}
                </button>
              ))}
            </nav>
          </aside>
          <div className="job-results">
            <div className="section-title-row">
              <p>岗位模板</p>
              <Link className="text-link" href="/me/saved-jobs">
                我的目标岗位
                <ArrowRight size={16} />
              </Link>
            </div>
            <ErrorNotice message={resource.error} retry={() => void resource.refresh()} />
            <ErrorNotice message={categories.error} retry={() => void categories.refresh()} />
            {!resource.value && !resource.error && <Loading />}
            <p className="muted">岗位收藏与个人 JD 维护暂未开放。</p>
            <div className="catalog-rows">
              {jobs.map((j) => (
                <article className="catalog-job" key={j.id}>
                  <div>
                    <h2>
                      <Link href={`/jobs/${j.slug}`}>{j.title}</Link>
                    </h2>
                    <p>{j.description}</p>
                    <div className="catalog-tags">
                      {j.tags.map((t) => (
                        <span key={t}>{t}</span>
                      ))}
                    </div>
                  </div>
                  <div className="catalog-actions">
                    <button
                      className="icon-button"
                      disabled
                      title="岗位收藏暂未开放"
                      aria-label="岗位收藏暂未开放"
                    >
                      <Bookmark size={21} />
                    </button>
                    <Link className="text-link" href={`/jobs/${j.slug}`}>
                      查看岗位
                      <ArrowRight size={18} />
                    </Link>
                  </div>
                </article>
              ))}
            </div>
            {resource.value && !jobs.length && (
              <EmptyState
                title="没有找到对应岗位"
                description="试试其他岗位名称、技能关键词，或切换方向分类。"
              />
            )}
            <div className="row-actions">
              {cursor && (
                <Button variant="outline" onClick={() => setCursor('')}>
                  回到第一页
                </Button>
              )}
              {resource.value?.next_cursor && (
                <Button variant="outline" onClick={() => setCursor(resource.value!.next_cursor!)}>
                  下一页
                </Button>
              )}
            </div>
            <p className="catalog-note">
              通用参考模板，面向实习与校招整理。企业实际要求请核对原招聘信息。
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}

export function LiveJobDetail({ id }: { id: string }) {
  const load = useCallback((signal: AbortSignal) => jobsApi.read(id, signal), [id]);
  const resource = useLiveResource(load, () => false);
  if (!resource.value)
    return (
      <>
        <Header />
        <main id="main-content" className="container section">
          <ErrorNotice message={resource.error} retry={() => void resource.refresh()} />
          {!resource.error && <Loading />}
        </main>
        <Footer />
      </>
    );
  return <JobDetail job={resource.value} sources={resource.value.sources} />;
}
export function JobDetail({ job, sources }: { job: JobTemplate; sources: ContentSource[] }) {
  return (
    <>
      <Header />
      <main id="main-content" className="job-detail-page">
        <section className="jobs-banner">
          <div className="container">
            <div className="job-breadcrumb">
              <Link href="/jobs">岗位库</Link>
              <span>/</span>
              <Link href={`/jobs?category=${job.category_id}`}>{job.category_id}</Link>
              <span>/</span>
              <span>{job.title}</span>
            </div>
            <div className="job-detail-heading">
              <div>
                <h1>{job.title}</h1>
                <p>{job.description}</p>
              </div>
              <div className="row-actions wrap">
                <Button asChild>
                  <Link href={`/interview/setup?job=${job.id}`}>
                    使用模板模拟
                    <ArrowRight size={18} />
                  </Link>
                </Button>
                <Button variant="outline" disabled title="岗位收藏暂未开放">
                  <Bookmark size={18} />
                  收藏暂未开放
                </Button>
              </div>
            </div>
          </div>
        </section>
        <div className="container job-detail-layout">
          <div>
            <nav className="job-detail-nav" aria-label="岗位详情章节">
              <a href="#job-jd">岗位 JD</a>
              <a href="#job-topics">考查主题</a>
              <a href="#job-questions">典型问题</a>
              <a href="#job-sources">资料来源</a>
            </nav>
            <article className="job-article library-panel" id="job-jd">
              {(
                [
                  ['responsibilities', '岗位职责'],
                  ['requirements', '基础要求'],
                  ['preferred', '加分项'],
                ] as const
              ).map(([key, title]) => (
                <section key={key}>
                  <h2>{title}</h2>
                  <ol>
                    {job[key].map((text) => (
                      <li key={text}>{text}</li>
                    ))}
                  </ol>
                </section>
              ))}
              <p className="muted">{job.jd_note}</p>
            </article>
            <section id="job-topics" className="library-panel">
              <h2>考查主题</h2>
              <div className="topic-grid">
                {job.topics.map((t, i) => (
                  <div key={t}>
                    <span>{String(i + 1).padStart(2, '0')}</span>
                    <strong>{t}</strong>
                  </div>
                ))}
              </div>
            </section>
            <section id="job-questions" className="library-panel">
              <div className="section-title-row">
                <h2>典型问题</h2>
                <span className="badge badge-mint">平台整理 · 8 题</span>
              </div>
              <p className="muted">
                用于了解准备方向，面试中不展示参考要点。未经过企业真题认证或专业评分校准。
              </p>
              <div className="knowledge-questions">
                {job.questions.map((q, i) => (
                  <details key={q.id}>
                    <summary>
                      <span className="question-number">{i + 1}</span>
                      <strong>{q.text}</strong>
                    </summary>
                    <div className="question-preparation">
                      <p>{q.intent}</p>
                      <h3>观察要点</h3>
                      <p>{q.observation_points.join('、')}</p>
                      <h3>追问方向</h3>
                      <ul>
                        {q.follow_ups.map((f) => (
                          <li key={f}>{f}</li>
                        ))}
                      </ul>
                      <p className="muted">
                        适用：{q.stages.map((s) => STAGE_LABELS[s]).join(' / ')} · {q.difficulty}
                      </p>
                      {q.source_refs.map((id) => {
                        const s = sources.find((s) => s.id === id);
                        return s ? (
                          <a
                            key={id}
                            href={s.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-link"
                          >
                            知识参考
                            <ExternalLink size={14} />
                          </a>
                        ) : null;
                      })}
                    </div>
                  </details>
                ))}
              </div>
            </section>
            <section id="job-sources" className="library-panel source-list">
              <h2>资料来源与版本</h2>
              <p>
                模板 v{job.version} · 核对于 {job.reviewed_at} · 下次复核 {job.review_due_at}
              </p>
              {sources.map((s) => (
                <div key={s.id}>
                  <a href={s.url} target="_blank" rel="noreferrer" className="text-link">
                    {s.title}
                    <ExternalLink size={16} />
                  </a>
                  <p>
                    {s.kind === 'recruitment' ? '岗位需求参考' : '官方知识参考'} ·{' '}
                    {s.verification === 'page_read' ? '已查阅公开页面' : '仅检索摘要可访问'} ·{' '}
                    {s.reviewed_at}
                  </p>
                  <p className="muted">{s.notes}</p>
                </div>
              ))}
            </section>
          </div>
          <aside className="job-preparation">
            <h2>准备这类面试</h2>
            <p>
              {STAGE_LABELS.internship} / {STAGE_LABELS.campus}
            </p>
            <ol>
              {job.topics.slice(0, 4).map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ol>
            <Button variant="outline" disabled>
              <Copy size={17} />
              个人 JD 暂未开放
            </Button>
            <p className="muted">
              简历与个人 JD 维护尚未接入真实账号，可直接使用岗位模板开始文字面试。
            </p>
          </aside>
        </div>
      </main>
      <Footer />
    </>
  );
}
