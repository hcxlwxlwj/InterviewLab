'use client';
import { getJob } from '@interviewlab/content';
import { STATUS_LABELS, TYPE_LABELS, type Session } from '@interviewlab/core';
import { ArrowRight, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { formatDate } from '../../components/shared';

export const destination = (s: Session) =>
  ['completed', 'failed', 'ending'].includes(s.status) ? `/reports/${s.id}` : `/interview/${s.id}`;
export function sessionTitle(s: Session) {
  return (
    s.material_snapshot.job_target?.title ||
    s.material_snapshot.job_template?.title ||
    getJob(s.configuration.job)?.title ||
    '历史岗位'
  );
}
export function SessionTable({
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
export function SectionTitle({
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
