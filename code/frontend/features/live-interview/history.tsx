'use client';
import Link from 'next/link';
import { useCallback, useState } from 'react';
import { STATUS_LABELS, LIVE_TYPE_LABELS, type Interview } from '@interviewlab/core';
import { EmptyState, Loading, Modal, formatDate } from '../../components/shared';
import { Button } from '../../components/ui/button';
import { WorkspaceFrame } from '../personal-center/workspace-frame';
import { interviewsApi } from '../../lib/api/interviews';
import { useSession } from '../../components/session-provider';
import { CommandNotice, ErrorNotice, SessionGate, useLiveCommand, useLiveResource } from './common';
function HistoryBody() {
  const { isDevelopment } = useSession();
  const [status, setStatus] = useState('');
  const [job, setJob] = useState('');
  const [cursor, setCursor] = useState('');
  const [deletion, setDeletion] = useState<Interview | null>(null);
  const command = useLiveCommand();
  const load = useCallback(
    (signal: AbortSignal) => {
      const query = new URLSearchParams({ limit: '20' });
      if (status) query.set('status', status);
      if (job) query.set('job', job);
      if (cursor) query.set('cursor', cursor);
      return interviewsApi.list(`?${query}`, signal);
    },
    [status, job, cursor],
  );
  const resource = useLiveResource(load, () => false);
  const jobsLoad = useCallback((signal: AbortSignal) => interviewsApi.jobs(signal), []);
  const jobs = useLiveResource(jobsLoad, () => false);
  return (
    <>
      <div className="workspace-heading">
        <h1>面试记录</h1>
        <Button asChild>
          <Link href="/interview/setup">开始 AI 面试</Link>
        </Button>
      </div>
      <section className="library-panel">
        <div className="record-filters">
          <label>
            状态
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setCursor('');
              }}
            >
              <option value="">全部状态</option>
              {Object.entries(STATUS_LABELS).map(([key, title]) => (
                <option key={key} value={key}>
                  {title}
                </option>
              ))}
            </select>
          </label>
          <label>
            岗位
            <select
              value={job}
              onChange={(e) => {
                setJob(e.target.value);
                setCursor('');
              }}
            >
              <option value="">全部岗位</option>
              {jobs.value?.items.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.title}
                </option>
              ))}
            </select>
          </label>
          <Button variant="outline" size="sm" onClick={() => void resource.refresh()}>
            刷新记录
          </Button>
        </div>
        <ErrorNotice message={resource.error} retry={() => void resource.refresh()} />
        <CommandNotice command={command} refresh={() => void resource.refresh()} />
        {!resource.value && !resource.error && <Loading />}
        {resource.value && (
          <>
            {!resource.value.items.length ? (
              <EmptyState
                title="暂无面试记录"
                description="选择岗位开始练习，记录会保存在当前账号中。"
                href="/interview/setup"
                action="开始一次文字面试"
              />
            ) : (
              <div className="table-scroll">
                <table className="library-table">
                  <thead>
                    <tr>
                      <th scope="col">岗位 / 面试类型</th>
                      <th scope="col">创建时间</th>
                      <th scope="col">状态</th>
                      <th scope="col">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resource.value.items.map((v) => (
                      <tr key={v.id}>
                        <td>
                          <strong>{v.job_title}</strong>
                          <span>
                            {LIVE_TYPE_LABELS[v.configuration.interview_type]}
                            {v.parent_interview_id ? ' · 单题重练' : ''}
                          </span>
                        </td>
                        <td>
                          <time dateTime={v.created_at}>{formatDate(v.created_at)}</time>
                        </td>
                        <td>
                          <span
                            className={`status-chip ${v.status === 'completed' ? 'success' : ''}`}
                          >
                            {STATUS_LABELS[v.status]}
                          </span>
                        </td>
                        <td>
                          <div className="row-actions">
                            <Link
                              className="text-link"
                              href={
                                !isDevelopment && ['completed', 'failed'].includes(v.status)
                                  ? `/reports/${v.id}`
                                  : `/interview/${v.id}`
                              }
                            >
                              {['completed', 'failed'].includes(v.status)
                                ? isDevelopment
                                  ? '查看面试'
                                  : '查看报告'
                                : '继续面试'}
                            </Link>
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={command.blocked}
                              onClick={() => setDeletion(v)}
                              aria-label={`删除${v.job_title}面试记录`}
                            >
                              删除
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="library-pagination">
              {cursor && (
                <Button variant="outline" size="sm" onClick={() => setCursor('')}>
                  回到最新
                </Button>
              )}
              {resource.value.next_cursor && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCursor(resource.value!.next_cursor!)}
                >
                  下一页
                </Button>
              )}
            </div>
          </>
        )}
      </section>
      {deletion && (
        <Modal
          open={Boolean(deletion)}
          onOpenChange={(open) => {
            if (!open && !command.blocked) setDeletion(null);
          }}
          title="删除面试及关联复盘"
        >
          <p>
            会删除本场问题、回答、报告和包含本场内容的比较。独立重练的回答会保留，来源关联将解除。此操作无法撤销。
          </p>
          <Button
            variant="danger"
            disabled={command.blocked}
            onClick={() =>
              command.run(
                (key) => interviewsApi.remove(deletion.id, deletion.version, key),
                () => {
                  setDeletion(null);
                  void resource.refresh();
                },
              )
            }
          >
            确认删除
          </Button>
          <CommandNotice
            command={command}
            refresh={() => {
              setDeletion(null);
              void resource.refresh();
            }}
          />
        </Modal>
      )}
    </>
  );
}
export default function LiveHistory() {
  return (
    <WorkspaceFrame section="interviews">
      <SessionGate>
        <HistoryBody />
      </SessionGate>
    </WorkspaceFrame>
  );
}
