'use client';
import { JOBS } from '@interviewlab/backend/content';
import { STATUS_LABELS } from '@interviewlab/core';
import { EmptyState } from '../../components/shared';
import { Button } from '../../components/ui/button';

import { SessionTable } from './session-table';
import type { LoadedWorkspace } from './use-workspace';
export function InterviewsSection({ workspace }: { workspace: LoadedWorkspace }) {
  const {
    job,
    setJob,
    resume,
    setResume,
    status,
    setStatus,
    period,
    setPeriod,
    page,
    setPage,
    setDeletion,
    records,
    resumeOptions,
  } = workspace;
  return (
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
  );
}
