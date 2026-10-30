'use client';
import Link from 'next/link';
import { useCallback } from 'react';
import { STATUS_LABELS } from '@interviewlab/core';
import { useSession } from '../../components/session-provider';
import { EmptyState, Loading } from '../../components/shared';
import { interviewsApi } from '../../lib/api/interviews';
import { ErrorNotice, useLiveResource } from '../live-interview/common';
import { WorkspaceFrame, type PersonalSection } from './workspace-frame';

export function UnavailableWorkspace({ section }: { section: PersonalSection }) {
  const title =
    section === 'resumes' ? '简历管理' : section === 'saved-jobs' ? '目标岗位管理' : '偏好设置';
  return (
    <WorkspaceFrame section={section}>
      <section className="library-panel">
        <EmptyState
          title={`${title}暂未开放`}
          description="该功能尚未接入真实账号，当前没有可展示的个人数据。"
        />
        <Link className="text-link" href="/interview/setup">
          开始文字面试
        </Link>
      </section>
    </WorkspaceFrame>
  );
}

export default function AccountOverview() {
  const { state } = useSession();
  const load = useCallback((signal: AbortSignal) => interviewsApi.list('?limit=5', signal), []);
  const resource = useLiveResource(load, () => false);
  return (
    <WorkspaceFrame section="overview">
      <section className="library-panel">
        <h1>我的账号</h1>
        {state.status === 'signed_in' && (
          <>
            <p>{state.session.user.name}</p>
            <p>{state.session.user.email}</p>
          </>
        )}
        <p className="muted">这里只展示当前账号的真实记录。简历、目标岗位和偏好维护暂未开放。</p>
      </section>
      <section className="library-panel">
        <div className="section-title-row">
          <h2>最近的面试</h2>
          <Link href="/me/interviews">全部记录</Link>
        </div>
        <ErrorNotice message={resource.error} retry={() => void resource.refresh()} />
        {!resource.value && !resource.error && <Loading />}
        {resource.value &&
          (!resource.value.items.length ? (
            <EmptyState
              title="还没有面试记录"
              description="开始第一次文字面试，记录会保存在当前账号中。"
              href="/interview/setup"
              action="开始面试"
            />
          ) : (
            resource.value.items.map((item) => (
              <article key={item.id} className="resume-summary-row">
                <div>
                  <strong>{item.job_title}</strong>
                  <p>{STATUS_LABELS[item.status]}</p>
                </div>
                <Link href={`/interview/${item.id}`}>查看面试</Link>
                {item.status === 'completed' && <Link href={`/reports/${item.id}`}>查看报告</Link>}
              </article>
            ))
          ))}
      </section>
    </WorkspaceFrame>
  );
}
