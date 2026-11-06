'use client';
import Link from 'next/link';
import { useCallback } from 'react';
import { ArrowRight, FileText, ChartNoAxesCombined, MessageSquare } from 'lucide-react';
import { STATUS_LABELS } from '@interviewlab/core';
import { useSession } from '../../components/session-provider';
import { EmptyState, Loading } from '../../components/shared';
import { Button } from '../../components/ui/button';
import { interviewsApi } from '../../lib/api/interviews';
import { ErrorNotice, useLiveResource } from '../live-interview/common';
import { WorkspaceFrame } from './workspace-frame';
export default function AccountOverview() {
  const { state } = useSession();
  const load = useCallback((signal: AbortSignal) => interviewsApi.list('?limit=5', signal), []);
  const resource = useLiveResource(load, () => false);
  return (
    <WorkspaceFrame section="overview">
      <header className="personal-page-header">
        <div>
          <h1>
            {state.status === 'signed_in' ? `${state.session.user.name}，欢迎回来` : '练习概览'}
          </h1>
          <p>接着上次的经历，再练得具体一点。</p>
        </div>
        <Button asChild>
          <Link href="/interview/setup">
            开始模拟面试 <ArrowRight size={18} />
          </Link>
        </Button>
      </header>
      <nav className="workspace-shortcuts" aria-label="练习快捷入口">
        <Link href="/me/resumes">
          <FileText size={24} />
          <div>
            <h2>准备简历</h2>
            <p>整理经历，明确个人贡献</p>
          </div>
          <ArrowRight size={18} />
        </Link>
        <Link href="/me/profile">
          <ChartNoAxesCombined size={24} />
          <div>
            <h2>查看成长画像</h2>
            <p>比较同一岗位的练习表现</p>
          </div>
          <ArrowRight size={18} />
        </Link>
      </nav>
      <section className="library-panel overview-recent">
        <div className="section-title-row">
          <h2>最近的练习</h2>
          <Link href="/me/interviews">
            全部记录 <ArrowRight size={16} />
          </Link>
        </div>
        <ErrorNotice message={resource.error} retry={() => void resource.refresh()} />
        {!resource.value && !resource.error && <Loading />}
        {resource.value &&
          (!resource.value.items.length ? (
            <EmptyState
              title="从第一次练习开始"
              description="完成后，可以在这里回看对话与报告。"
              href="/interview/setup"
              action="开始面试"
            />
          ) : (
            resource.value.items.map((item) => (
              <article key={item.id} className="overview-interview-row">
                <span className="workspace-row-icon">
                  <MessageSquare size={22} />
                </span>
                <div>
                  <h3>{item.job_title}</h3>
                  <p>
                    {new Date(item.created_at).toLocaleString('zh-CN', {
                      year: 'numeric',
                      month: 'numeric',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                    <span>·</span>
                    {STATUS_LABELS[item.status]}
                    {item.parent_interview_id && (
                      <>
                        <span>·</span>单题重练
                      </>
                    )}
                  </p>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link
                    href={
                      item.status === 'completed' ? `/reports/${item.id}` : `/interview/${item.id}`
                    }
                  >
                    {item.status === 'completed'
                      ? '查看报告'
                      : item.status === 'in_progress' || item.status === 'paused'
                        ? '继续面试'
                        : '查看面试'}
                    <ArrowRight size={16} />
                  </Link>
                </Button>
              </article>
            ))
          ))}
      </section>
    </WorkspaceFrame>
  );
}
