'use client';
import Link from 'next/link';
import { useCallback, useState } from 'react';
import { STATUS_LABELS, LIVE_TYPE_LABELS, type Interview } from '@interviewlab/core';
import { Loading, Modal } from '../../components/shared';
import { interviewsApi } from '../../lib/api/interviews';
import { useSession } from '../../components/session-provider';
import { CommandNotice, ErrorNotice, LiveFrame, useLiveCommand, useLiveResource } from './common';
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
      <section className="panel live-toolbar">
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
        <button className="live-button secondary" onClick={() => void resource.refresh()}>
          刷新记录
        </button>
        <Link href="/me/interviews?demo=1">查看预设流程演示记录</Link>
      </section>
      <ErrorNotice message={resource.error} retry={() => void resource.refresh()} />
      <CommandNotice command={command} refresh={() => void resource.refresh()} />
      {!resource.value && !resource.error && <Loading />}
      {resource.value && (
        <section className="panel">
          {!resource.value.items.length ? (
            <div className="live-state">
              <h2>暂无面试记录</h2>
              <Link className="live-button" href="/interview/setup">
                开始一次文字面试
              </Link>
            </div>
          ) : (
            <div className="live-records">
              {resource.value.items.map((v) => (
                <article key={v.id}>
                  <div>
                    <h2>{v.job_title}</h2>
                    <p>
                      {LIVE_TYPE_LABELS[v.configuration.interview_type]} · {STATUS_LABELS[v.status]}
                      {v.parent_interview_id ? ' · 单题重练' : ''}
                    </p>
                    <time dateTime={v.created_at}>
                      {new Date(v.created_at).toLocaleString('zh-CN')}
                    </time>
                  </div>
                  <div className="live-actions">
                    <Link
                      className="live-button secondary"
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
                    <button
                      className="live-button secondary"
                      disabled={command.blocked}
                      onClick={() => setDeletion(v)}
                    >
                      删除
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
          <div className="live-actions">
            {cursor && (
              <button className="live-button secondary" onClick={() => setCursor('')}>
                回到最新
              </button>
            )}
            {resource.value.next_cursor && (
              <button
                className="live-button secondary"
                onClick={() => setCursor(resource.value!.next_cursor!)}
              >
                下一页
              </button>
            )}
          </div>
        </section>
      )}
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
          <button
            className="live-button"
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
          </button>
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
    <LiveFrame title="我的面试记录">
      <HistoryBody />
    </LiveFrame>
  );
}
