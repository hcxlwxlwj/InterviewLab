'use client';
import { getJob } from '@interviewlab/content';
import { ArrowRight, Bookmark, FileText, FolderOpen } from 'lucide-react';
import Link from 'next/link';
import { EmptyState } from '../../components/shared';
import { Button } from '../../components/ui/button';

import { SectionTitle, SessionTable } from './session-table';
import type { LoadedWorkspace } from './use-workspace';
export function OverviewSection({ workspace }: { workspace: LoadedWorkspace }) {
  const { state } = workspace;
  return (
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
  );
}
