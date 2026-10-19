'use client';
import { getJob } from '@interviewlab/content';
import { Bookmark, Search, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { EmptyState, formatDate } from '../../components/shared';
import { Button } from '../../components/ui/button';
import { demoClient } from '../../lib/demo-client';

import type { LoadedWorkspace } from './use-workspace';
export function SavedJobsSection({ workspace }: { workspace: LoadedWorkspace }) {
  const {
    state,
    query,
    setQuery,
    setTarget,
    setBookmark,
    savedTab,
    setSavedTab,
    setDeletion,
    act,
    queryLower,
  } = workspace;
  return (
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
              [getJob(b.template_id)?.title, b.notes].join(' ').toLowerCase().includes(queryLower),
            )
            .map((b) => {
              const j = getJob(b.template_id);
              return (
                <article className="saved-job-row" key={b.template_id}>
                  <div>
                    <h2>{j ? <Link href={`/jobs/${j.slug}`}>{j.title}</Link> : '模板已不可用'}</h2>
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
            [getJob(b.template_id)?.title, b.notes].join(' ').toLowerCase().includes(queryLower),
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
                  <span className="muted">{t.notes || `更新于 ${formatDate(t.updated_at)}`}</span>
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
  );
}
