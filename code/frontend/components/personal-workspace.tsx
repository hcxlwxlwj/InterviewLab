'use client';
import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowRight,
  Bookmark,
  FileText,
  FolderOpen,
  LayoutDashboard,
  Settings2,
  Plus,
  Copy,
  Pencil,
  Trash2,
  Star,
  Search,
  RotateCcw,
} from 'lucide-react';
import {
  JOBS,
  STATUS_LABELS,
  TYPE_LABELS,
  getJob,
  templateJd,
  type Session,
  type JobTarget,
  type JobBookmark,
} from '@interviewlab/core';
import { demoClient, deleteDemoSession } from '../lib/demo-client';
import {
  Header,
  Footer,
  DemoNotice,
  Loading,
  EmptyState,
  Modal,
  useDemoState,
  formatDate,
} from './shared';
import { Button } from './ui/button';
import { TargetEditor, emptyTarget } from './target-editor';

export type PersonalSection = 'overview' | 'resumes' | 'interviews' | 'saved-jobs' | 'preferences';
const navigation = [
  { id: 'overview', title: '概览', Icon: LayoutDashboard, href: '/me' },
  { id: 'resumes', title: '我的简历', Icon: FileText, href: '/me/resumes' },
  { id: 'interviews', title: '面试记录', Icon: FolderOpen, href: '/me/interviews' },
  { id: 'saved-jobs', title: '目标岗位', Icon: Bookmark, href: '/me/saved-jobs' },
  { id: 'preferences', title: '偏好设置', Icon: Settings2, href: '/me/preferences' },
];
export function WorkspaceFrame({
  section,
  children,
}: {
  section: PersonalSection;
  children: ReactNode;
}) {
  return (
    <>
      <Header />
      <main id="main-content" className="container workspace-layout">
        <aside className="workspace-nav">
          <h2>个人中心</h2>
          <nav aria-label="个人中心导航">
            {navigation.map((n) => (
              <Link key={n.id} href={n.href} aria-current={section === n.id ? 'page' : undefined}>
                <n.Icon size={20} />
                {n.title}
              </Link>
            ))}
          </nav>
          <p>
            简历、目标与练习，
            <br />
            放在同一个地方。
          </p>
        </aside>
        <div className="workspace-content">{children}</div>
      </main>
      <Footer />
    </>
  );
}
const destination = (s: Session) =>
  ['completed', 'failed', 'ending'].includes(s.status) ? `/reports/${s.id}` : `/interview/${s.id}`;
export function sessionTitle(s: Session) {
  return (
    s.material_snapshot.job_target?.title ||
    s.material_snapshot.job_template?.title ||
    getJob(s.configuration.job)?.title ||
    '历史岗位'
  );
}
function SessionTable({
  sessions,
  onDelete,
}: {
  sessions: Session[];
  onDelete?: (id: string) => void;
}) {
  return (
    <div className="table-scroll">
      <table className="library-table">
        <thead>
          <tr>
            <th>岗位 / 面试类型</th>
            <th>使用简历</th>
            <th>开始时间</th>
            <th>状态</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {sessions.map((s) => (
            <tr key={s.id}>
              <td>
                <strong>{sessionTitle(s)}</strong>
                <span>
                  {TYPE_LABELS[s.interview_type]}
                  {s.parent_session_id ? ' · 单题重练' : ''}
                  {s.is_sample ? ' · 合成示例' : ''}
                </span>
              </td>
              <td>{s.material_snapshot.resume?.name ?? '未使用简历'}</td>
              <td>{formatDate(s.started_at)}</td>
              <td>
                <span className={`status-chip ${s.status === 'completed' ? 'success' : ''}`}>
                  {STATUS_LABELS[s.status]}
                </span>
              </td>
              <td>
                <div className="row-actions">
                  <Link className="text-link" href={destination(s)}>
                    {['completed', 'failed', 'ending'].includes(s.status) ? '查看报告' : '继续面试'}
                  </Link>
                  {onDelete && (
                    <button
                      className="icon-button"
                      aria-label={`删除${sessionTitle(s)}面试记录`}
                      onClick={() => onDelete(s.id)}
                    >
                      <Trash2 size={17} />
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function SectionTitle({
  title,
  href,
  action = '查看全部',
}: {
  title: string;
  href: string;
  action?: string;
}) {
  return (
    <div className="section-title-row">
      <h2>{title}</h2>
      <Link className="text-link" href={href}>
        {action}
        <ArrowRight size={16} />
      </Link>
    </div>
  );
}
export default function PersonalWorkspace({ section = 'overview' }: { section?: PersonalSection }) {
  const state = useDemoState(),
    router = useRouter(),
    search = useSearchParams();
  const [query, setQuery] = useState(''),
    [job, setJob] = useState(''),
    [resume, setResume] = useState(''),
    [status, setStatus] = useState(''),
    [period, setPeriod] = useState(''),
    [page, setPage] = useState(0);
  const [message, setMessage] = useState(''),
    [error, setError] = useState('');
  const [target, setTarget] = useState<JobTarget | null>(null),
    [bookmark, setBookmark] = useState<JobBookmark | null>(null),
    [savedTab, setSavedTab] = useState<'templates' | 'custom'>('templates');
  const [deletion, setDeletion] = useState<{
    kind: 'resume' | 'session' | 'target' | 'reset';
    id: string;
  } | null>(null);
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  useEffect(() => {
    const tab = search.get('tab');
    const old: Record<string, string> = {
      records: 'interviews',
      resumes: 'resumes',
      preferences: 'preferences',
    };
    if (section === 'overview' && tab && old[tab]) router.replace(`/me/${old[tab]}`);
  }, [search, router, section]);
  const copyParam = search.get('create');
  useEffect(() => {
    if (section !== 'saved-jobs' || !copyParam) return;
    const j = getJob(copyParam);
    if (j) {
      setTarget({
        ...emptyTarget(j.id),
        title: j.title,
        jd_text: templateJd(j),
        source_kind: 'template_copy',
        template_id: j.id,
        template_version: j.version,
      });
      setSavedTab('custom');
    } else setError('岗位模板已不可用。');
    router.replace('/me/saved-jobs', { scroll: false });
  }, [copyParam, section, router]);
  function act(fn: () => void, success?: string) {
    try {
      fn();
      setError('');
      if (success) setMessage(success);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  function confirmDelete() {
    if (!deletion) return;
    act(
      () => {
        if (deletion.kind === 'resume') demoClient.deleteResume(deletion.id);
        if (deletion.kind === 'session') deleteDemoSession(deletion.id);
        if (deletion.kind === 'target') demoClient.deleteJobTarget(deletion.id);
        if (deletion.kind === 'reset') demoClient.reset();
        setDeletion(null);
        setPage(0);
      },
      deletion.kind === 'reset' ? '已恢复初始演示数据。' : '已删除，历史面试快照保持原样。',
    );
  }
  function create() {
    act(() => {
      const r = demoClient.createResume('未命名简历');
      router.push(`/me/resumes/${r.id}`);
    });
  }
  const title =
    section === 'overview' ? '我的工作区' : navigation.find((n) => n.id === section)!.title;
  const filteredResumes =
    state?.resumes.filter((r) =>
      [r.name, getJob(r.target_job ?? '')?.title]
        .join(' ')
        .toLowerCase()
        .includes(query.toLowerCase()),
    ) ?? [];
  const records =
    state?.sessions.filter(
      (s) =>
        (!job || s.configuration.job === job) &&
        (!resume || s.material_snapshot.resume?.id === resume) &&
        (!status || s.status === status) &&
        (!period || Date.parse(s.started_at) >= Date.now() - Number(period) * 86400000),
    ) ?? [];
  const resumeOptions = state
    ? [
        ...new Map([
          ...state.sessions.flatMap((s) =>
            s.material_snapshot.resume
              ? [[s.material_snapshot.resume.id, s.material_snapshot.resume.name] as const]
              : [],
          ),
          ...state.resumes.map((r) => [r.id, r.name] as const),
        ]).entries(),
      ]
    : [];
  const queryLower = query.trim().toLowerCase();
  return (
    <WorkspaceFrame section={section}>
      <div className="workspace-heading">
        <div>
          <h1>{title}</h1>
          {section === 'overview' && <p>准备好自己的材料，把每一次练习留在这里。</p>}
        </div>
        {section === 'resumes' ? (
          <Button onClick={create}>
            <Plus size={18} />
            新建简历
          </Button>
        ) : section === 'saved-jobs' ? (
          <Button onClick={() => setTarget(emptyTarget())}>
            <Plus size={18} />
            新建个人 JD
          </Button>
        ) : (
          <Button asChild>
            <Link href="/interview/setup">
              开始模拟
              <ArrowRight size={18} />
            </Link>
          </Button>
        )}
      </div>
      <DemoNotice compact />
      {message && (
        <p className="toast-inline" role="status">
          {message}
        </p>
      )}
      {error && (
        <p className="error-inline" role="alert">
          {error}
        </p>
      )}
      {!state ? (
        <Loading />
      ) : (
        <>
          {section === 'overview' && (
            <>
              <div className="workspace-counts">
                <Link href="/me/resumes">
                  <FileText />
                  <strong>{state.resumes.length}</strong>份简历
                </Link>
                <Link href="/me/interviews">
                  <FolderOpen />
                  <strong>{state.sessions.length}</strong>次面试
                </Link>
                <Link href="/me/saved-jobs">
                  <Bookmark />
                  <strong>{state.bookmarks.length + state.job_targets.length}</strong>个目标岗位
                </Link>
              </div>
              <div className="workspace-overview">
                <div>
                  <section className="library-panel">
                    <SectionTitle title="我的简历" href="/me/resumes" />
                    {state.resumes.length ? (
                      state.resumes.slice(0, 3).map((r) => (
                        <div className="resume-summary-row" key={r.id}>
                          <span className="document-icon">
                            <FileText size={24} />
                          </span>
                          <div>
                            <strong>
                              {r.name}
                              {r.is_default && <span className="badge badge-yellow">默认</span>}
                            </strong>
                            <p>{getJob(r.target_job ?? '')?.title ?? '尚未指定方向'}</p>
                          </div>
                          <Link className="text-link" href={`/me/resumes/${r.id}`}>
                            编辑
                          </Link>
                          <Button asChild size="sm">
                            <Link
                              href={`/interview/setup?job=${r.target_job ?? 'frontend'}&resume=${r.id}`}
                            >
                              使用
                            </Link>
                          </Button>
                        </div>
                      ))
                    ) : (
                      <EmptyState
                        title="准备第一份简历"
                        description="按不同方向维护材料，再选择适合的版本练习。"
                        href="/me/resumes"
                        action="管理简历"
                      />
                    )}
                  </section>
                  <section className="library-panel">
                    <SectionTitle title="最近的面试" href="/me/interviews" />
                    {state.sessions.length ? (
                      <SessionTable sessions={state.sessions.slice(0, 4)} />
                    ) : (
                      <EmptyState
                        title="还没有面试记录"
                        description="选择岗位开始第一次模拟。"
                        href="/jobs"
                        action="浏览岗位"
                      />
                    )}
                  </section>
                </div>
                <aside className="library-panel overview-targets">
                  <SectionTitle title="目标岗位" href="/me/saved-jobs" />
                  {state.bookmarks.length + state.job_targets.length ? (
                    <>
                      {state.bookmarks.slice(0, 4).map((b) => (
                        <Link
                          className="target-summary"
                          href={`/jobs/${b.template_id}`}
                          key={b.template_id}
                        >
                          <strong>{getJob(b.template_id)?.title ?? '模板已不可用'}</strong>
                          <span>
                            收藏的模板
                            <ArrowRight size={16} />
                          </span>
                        </Link>
                      ))}
                      {state.job_targets.slice(0, 3).map((t) => (
                        <Link
                          className="target-summary"
                          href={`/interview/setup?target=${t.id}`}
                          key={t.id}
                        >
                          <strong>{t.title}</strong>
                          <span>
                            {t.company || '个人 JD'}
                            <ArrowRight size={16} />
                          </span>
                        </Link>
                      ))}
                    </>
                  ) : (
                    <div className="quiet-empty">
                      <Bookmark size={28} />
                      <p>把关心的岗位收在这里。</p>
                      <Link className="text-link" href="/jobs">
                        去岗位库看看
                        <ArrowRight size={16} />
                      </Link>
                    </div>
                  )}
                </aside>
              </div>
            </>
          )}
          {section === 'resumes' && (
            <section className="library-panel">
              <div className="library-toolbar">
                <label className="search-box">
                  <Search size={19} />
                  <input
                    aria-label="搜索简历"
                    placeholder="搜索简历名称或方向"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </label>
                <span>{filteredResumes.length} 份简历</span>
                <Button
                  variant="outline"
                  onClick={() => setMessage('PDF / DOCX 上传尚未接入，可先新建文本简历。')}
                >
                  导入文件 · 未接入
                </Button>
              </div>
              {filteredResumes.length ? (
                <div className="resume-list">
                  {filteredResumes.map((r) => (
                    <article className="resume-library-row" key={r.id}>
                      <span className="document-icon">
                        <FileText size={29} />
                      </span>
                      <div className="resume-row-main">
                        <h2>
                          <Link href={`/me/resumes/${r.id}`}>{r.name}</Link>
                          {r.is_default && <span className="badge badge-yellow">默认</span>}
                        </h2>
                        <p>
                          {getJob(r.target_job ?? '')?.title ?? '未指定方向'} · v{r.version}
                        </p>
                        <span className="muted">
                          更新于 {formatDate(r.updated_at ?? r.created_at)}
                          {r.is_sample ? ' · 合成样例' : ''}
                        </span>
                      </div>
                      <div className="row-actions wrap">
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/me/resumes/${r.id}`}>
                            <Pencil size={16} />
                            编辑
                          </Link>
                        </Button>
                        <button
                          className="icon-button"
                          aria-label={`复制${r.name}`}
                          onClick={() =>
                            act(() => {
                              const copy = demoClient.duplicateResume(r.id);
                              router.push(`/me/resumes/${copy.id}`);
                            })
                          }
                        >
                          <Copy size={18} />
                        </button>
                        <button
                          className="icon-button"
                          aria-label={`重命名${r.name}`}
                          onClick={() => setRenaming({ id: r.id, name: r.name })}
                        >
                          <Pencil size={18} />
                        </button>
                        <button
                          className="icon-button"
                          aria-label={`将${r.name}设为默认`}
                          aria-pressed={r.is_default}
                          onClick={() =>
                            act(() => demoClient.setDefaultResume(r.id), '默认简历已更新。')
                          }
                        >
                          <Star size={18} fill={r.is_default ? 'currentColor' : 'none'} />
                        </button>
                        <button
                          className="icon-button"
                          aria-label={`删除${r.name}`}
                          onClick={() => setDeletion({ kind: 'resume', id: r.id })}
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <EmptyState
                  title={query ? '没有找到这份简历' : '还没有简历'}
                  description="可以按不同岗位创建材料，也可以不使用简历开始面试。"
                />
              )}
            </section>
          )}
          {section === 'interviews' && (
            <section className="library-panel">
              <div className="record-filters">
                <label>
                  岗位方向
                  <select
                    value={job}
                    onChange={(e) => {
                      setJob(e.target.value);
                      setPage(0);
                    }}
                  >
                    <option value="">全部岗位</option>
                    {JOBS.map((j) => (
                      <option key={j.id} value={j.id}>
                        {j.title}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  关联简历
                  <select
                    value={resume}
                    onChange={(e) => {
                      setResume(e.target.value);
                      setPage(0);
                    }}
                  >
                    <option value="">全部简历</option>
                    {resumeOptions.map(([id, name]) => (
                      <option key={id} value={id}>
                        {name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  面试状态
                  <select
                    value={status}
                    onChange={(e) => {
                      setStatus(e.target.value);
                      setPage(0);
                    }}
                  >
                    <option value="">全部状态</option>
                    {Object.entries(STATUS_LABELS).map(([id, label]) => (
                      <option key={id} value={id}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  开始时间
                  <select
                    value={period}
                    onChange={(e) => {
                      setPeriod(e.target.value);
                      setPage(0);
                    }}
                  >
                    <option value="">全部时间</option>
                    <option value="7">最近7天</option>
                    <option value="30">最近30天</option>
                  </select>
                </label>
              </div>
              {records.length ? (
                <>
                  <SessionTable
                    sessions={records.slice(page * 8, page * 8 + 8)}
                    onDelete={(id) => setDeletion({ kind: 'session', id })}
                  />
                  <div className="library-pagination">
                    <span>{records.length} 条记录</span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!page}
                      onClick={() => setPage((p) => p - 1)}
                    >
                      上一页
                    </Button>
                    <span>
                      {page + 1} / {Math.ceil(records.length / 8)}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={(page + 1) * 8 >= records.length}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      下一页
                    </Button>
                  </div>
                </>
              ) : (
                <EmptyState
                  title="没有符合条件的记录"
                  description="试试调整筛选，或开始一次新的模拟。"
                  href="/interview/setup"
                />
              )}
            </section>
          )}
          {section === 'saved-jobs' && (
            <section className="library-panel">
              <div className="library-toolbar">
                <div className="segmented" role="group" aria-label="目标岗位分类">
                  <button
                    aria-pressed={savedTab === 'templates'}
                    onClick={() => {
                      setSavedTab('templates');
                      setQuery('');
                    }}
                  >
                    收藏的模板 ({state.bookmarks.length})
                  </button>
                  <button
                    aria-pressed={savedTab === 'custom'}
                    onClick={() => {
                      setSavedTab('custom');
                      setQuery('');
                    }}
                  >
                    个人 JD ({state.job_targets.length})
                  </button>
                </div>
                <label className="search-box">
                  <Search size={18} />
                  <input
                    aria-label="搜索目标岗位"
                    placeholder="搜索岗位、企业或备注"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </label>
              </div>
              {savedTab === 'templates' ? (
                <>
                  {state.bookmarks
                    .filter((b) =>
                      [getJob(b.template_id)?.title, b.notes]
                        .join(' ')
                        .toLowerCase()
                        .includes(queryLower),
                    )
                    .map((b) => {
                      const j = getJob(b.template_id);
                      return (
                        <article className="saved-job-row" key={b.template_id}>
                          <div>
                            <h2>
                              {j ? <Link href={`/jobs/${j.slug}`}>{j.title}</Link> : '模板已不可用'}
                            </h2>
                            <p>{b.notes || j?.description || '可以取消收藏或重新选择岗位。'}</p>
                            <span className="muted">
                              常用简历：
                              {state.resumes.find((r) => r.id === b.preferred_resume_id)?.name ??
                                '默认简历'}
                            </span>
                          </div>
                          <div className="row-actions wrap">
                            <Button asChild variant="outline" size="sm">
                              <Link
                                href={`/interview/setup?job=${b.template_id}${b.preferred_resume_id ? `&resume=${b.preferred_resume_id}` : ''}`}
                              >
                                开始模拟
                              </Link>
                            </Button>
                            <button className="text-link" onClick={() => setBookmark({ ...b })}>
                              备注与简历
                            </button>
                            <button
                              className="icon-button"
                              aria-label={`取消收藏${j?.title ?? '岗位'}`}
                              onClick={() =>
                                act(() => {
                                  demoClient.toggleBookmark(b.template_id);
                                }, '已取消收藏。')
                              }
                            >
                              <Bookmark size={19} fill="currentColor" />
                            </button>
                          </div>
                        </article>
                      );
                    })}
                  {!state.bookmarks.some((b) =>
                    [getJob(b.template_id)?.title, b.notes]
                      .join(' ')
                      .toLowerCase()
                      .includes(queryLower),
                  ) && (
                    <EmptyState
                      title={query ? '没有匹配的收藏' : '还没有收藏岗位'}
                      description="在岗位库中收藏你关心的方向。"
                      href="/jobs"
                      action="浏览岗位库"
                    />
                  )}
                </>
              ) : (
                <>
                  {state.job_targets
                    .filter((t) =>
                      [t.title, t.company, t.notes].join(' ').toLowerCase().includes(queryLower),
                    )
                    .map((t) => (
                      <article className="saved-job-row" key={t.id}>
                        <div>
                          <h2>{t.title}</h2>
                          <p>
                            {t.company || '个人目标'} · {getJob(t.job)?.title ?? '岗位不可用'}
                          </p>
                          <span className="muted">
                            {t.notes || `更新于 ${formatDate(t.updated_at)}`}
                          </span>
                        </div>
                        <div className="row-actions wrap">
                          <Button asChild size="sm">
                            <Link href={`/interview/setup?target=${t.id}`}>开始模拟</Link>
                          </Button>
                          <button className="text-link" onClick={() => setTarget(t)}>
                            编辑 JD
                          </button>
                          <button
                            className="icon-button"
                            aria-label={`删除${t.title}个人JD`}
                            onClick={() => setDeletion({ kind: 'target', id: t.id })}
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </article>
                    ))}
                  {!state.job_targets.some((t) =>
                    [t.title, t.company, t.notes].join(' ').toLowerCase().includes(queryLower),
                  ) && (
                    <EmptyState
                      title={query ? '没有匹配的个人 JD' : '保存你的第一个目标岗位'}
                      description="粘贴企业JD，或从模板复制后补充自己的目标。"
                    />
                  )}
                </>
              )}
            </section>
          )}
          {section === 'preferences' && (
            <section className="library-panel preference-library">
              <h2>新面试的默认设置</h2>
              <label>
                默认岗位方向
                <select
                  value={state.preferences.default_job_direction}
                  onChange={(e) =>
                    act(
                      () => demoClient.updatePreferences({ default_job_direction: e.target.value }),
                      '偏好已保存，仅用于新的面试配置。',
                    )
                  }
                >
                  <option value="">暂不指定</option>
                  {JOBS.map((j) => (
                    <option key={j.id} value={j.id}>
                      {j.title}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                交互方式
                <select
                  value={state.preferences.interaction_mode}
                  onChange={(e) =>
                    act(
                      () =>
                        demoClient.updatePreferences({
                          interaction_mode: e.target.value as 'text_fallback' | 'realtime_voice',
                        }),
                      '偏好已保存。',
                    )
                  }
                >
                  <option value="text_fallback">文字作答</option>
                  <option value="realtime_voice">语音流程预览（开始时切换文字）</option>
                </select>
              </label>
              <label>
                代码编辑器主题
                <select
                  value={state.preferences.editor_theme}
                  onChange={(e) =>
                    act(
                      () =>
                        demoClient.updatePreferences({
                          editor_theme: e.target.value as 'system' | 'light' | 'dark',
                        }),
                      '偏好已保存。',
                    )
                  }
                >
                  <option value="system">跟随系统</option>
                  <option value="light">浅色</option>
                  <option value="dark">深色</option>
                </select>
              </label>
              <hr />
              <h2>演示数据</h2>
              <p>
                关闭标签页后不保证保留。重置将移除新增简历、个人 JD、收藏和面试记录，恢复合成样例。
              </p>
              <Button variant="outline" onClick={() => setDeletion({ kind: 'reset', id: '' })}>
                <RotateCcw size={17} />
                重置演示
              </Button>
            </section>
          )}
          {target && (
            <TargetEditor
              key={target.id}
              target={target}
              resumes={state.resumes}
              onClose={() => {
                setTarget(null);
                setSavedTab('custom');
              }}
            />
          )}
          {bookmark && (
            <Modal
              open
              onOpenChange={(open) => {
                if (!open) setBookmark(null);
              }}
              title="收藏备注与常用简历"
            >
              <form
                className="library-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  act(() => {
                    demoClient.updateBookmark(
                      bookmark.template_id,
                      { notes: bookmark.notes, preferred_resume_id: bookmark.preferred_resume_id },
                      bookmark.version,
                    );
                    setBookmark(null);
                  }, '收藏已更新。');
                }}
              >
                <label>
                  备注
                  <textarea
                    maxLength={1000}
                    value={bookmark.notes}
                    onChange={(e) => setBookmark({ ...bookmark, notes: e.target.value })}
                  />
                </label>
                <label>
                  常用简历
                  <select
                    value={bookmark.preferred_resume_id ?? ''}
                    onChange={(e) =>
                      setBookmark({ ...bookmark, preferred_resume_id: e.target.value || undefined })
                    }
                  >
                    <option value="">默认简历</option>
                    {state.resumes.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </label>
                {error && <p role="alert">{error}</p>}
                <Button type="submit">保存收藏设置</Button>
              </form>
            </Modal>
          )}
        </>
      )}
      {deletion && (
        <Modal
          open
          onOpenChange={(open) => {
            if (!open) setDeletion(null);
          }}
          title={deletion.kind === 'reset' ? '重置全部演示数据？' : '确认删除？'}
          description={
            deletion.kind === 'resume'
              ? '将移除库内简历及所属经历，并清除目标岗位的简历关联。历史面试仍保留当时材料快照。'
              : deletion.kind === 'session'
                ? '将删除此面试和草稿，解除重练来源关联；独立重练记录保留。'
                : deletion.kind === 'target'
                  ? '删除个人JD不影响已经开始的面试。'
                  : '新增材料、收藏、记录与草稿将被清除。'
          }
        >
          <div className="row-actions">
            <Button variant="outline" onClick={() => setDeletion(null)}>
              取消
            </Button>
            <Button onClick={confirmDelete}>
              确认{deletion.kind === 'reset' ? '重置' : '删除'}
            </Button>
          </div>
        </Modal>
      )}
      {renaming && (
        <Modal
          open
          onOpenChange={(open) => {
            if (!open) setRenaming(null);
          }}
          title="重命名简历"
        >
          <form
            className="library-form"
            onSubmit={(e) => {
              e.preventDefault();
              act(() => {
                demoClient.renameResume(renaming.id, renaming.name);
                setRenaming(null);
              }, '简历已重命名。');
            }}
          >
            <label>
              简历名称
              <input
                required
                maxLength={100}
                value={renaming.name}
                onChange={(e) => setRenaming({ ...renaming, name: e.target.value })}
              />
            </label>
            {error && <p role="alert">{error}</p>}
            <Button type="submit">保存名称</Button>
          </form>
        </Modal>
      )}
    </WorkspaceFrame>
  );
}
