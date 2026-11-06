'use client';
import { useCallback, useState } from 'react';
import Link from 'next/link';
import { Bookmark, ArrowRight, Trash2, ArrowUpRight } from 'lucide-react';
import { apiRequest } from '../../lib/api/http';
import { WorkspaceFrame } from './workspace-frame';
import { Button } from '../../components/ui/button';
import { Loading } from '../../components/shared';
import { ErrorNotice, useLiveResource } from '../live-interview/common';
type SavedJob = {
  id: string;
  title: string;
  slug: string;
  tags: string[];
  available: boolean;
  saved_at: string;
};
export default function SavedJobs() {
  const load = useCallback(
    (signal: AbortSignal) => apiRequest<SavedJob[]>('/bookmarks', { signal }),
    [],
  );
  const resource = useLiveResource(load, () => false);
  const [busy, setBusy] = useState(''),
    [error, setError] = useState('');
  return (
    <WorkspaceFrame section="saved-jobs">
      <header className="personal-page-header">
        <div>
          <h1>目标岗位</h1>
          <p>收藏感兴趣的方向，随时开始针对练习。</p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/jobs">
            探索岗位库
            <ArrowUpRight size={18} />
          </Link>
        </Button>
      </header>
      <ErrorNotice message={resource.error || error} retry={() => void resource.refresh()} />
      {!resource.value && !resource.error && <Loading />}
      {resource.value && !resource.value.length && (
        <section className="workspace-empty-state">
          <span className="workspace-empty-symbol">
            <Bookmark size={42} />
          </span>
          <h2>把感兴趣的岗位放在这里</h2>
          <p>在岗位库收藏一个方向，下次就能直接开始练习。</p>
          <Button asChild>
            <Link href="/jobs">
              去发现岗位
              <ArrowRight size={18} />
            </Link>
          </Button>
        </section>
      )}
      <div className="saved-role-list">
        {resource.value?.map((job) => (
          <article className="saved-role-row" key={job.id}>
            <span className="workspace-row-icon">
              <Bookmark size={24} />
            </span>
            <div className="saved-role-info">
              <h2>
                {job.available ? (
                  <Link href={'/jobs/' + job.slug}>
                    {job.title}
                    <ArrowUpRight size={18} />
                  </Link>
                ) : (
                  job.title
                )}
              </h2>
              <div className="catalog-tags">
                {[...new Set(job.tags)].slice(0, 4).map((tag) => (
                  <span key={tag}>{tag}</span>
                ))}
              </div>
              <p>
                {job.available ? '收藏于 ' : '岗位已下架 · '}
                {new Date(job.saved_at).toLocaleDateString('zh-CN')}
              </p>
            </div>
            <div className="saved-role-actions">
              {job.available && (
                <Button asChild>
                  <Link href={'/interview/setup?job=' + encodeURIComponent(job.id)}>
                    模拟面试
                    <ArrowRight size={17} />
                  </Link>
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                aria-label={'取消收藏' + job.title}
                title="取消收藏"
                disabled={!!busy}
                onClick={async () => {
                  setBusy(job.id);
                  setError('');
                  try {
                    await apiRequest('/bookmarks/' + encodeURIComponent(job.id), {
                      method: 'DELETE',
                    });
                    await resource.refresh();
                  } catch (e) {
                    setError(e instanceof Error ? e.message : '取消失败');
                  } finally {
                    setBusy('');
                  }
                }}
              >
                <Trash2 size={19} />
              </Button>
            </div>
          </article>
        ))}
      </div>
    </WorkspaceFrame>
  );
}
