'use client';
import { JOBS } from '@interviewlab/backend/content';
import { type JobTarget, type ResumeDocument } from '@interviewlab/core';
import { useState } from 'react';
import { demoClient } from '../lib/demo-client';
import { Modal } from './shared';
import { Button } from './ui/button';

export function TargetEditor({
  target,
  resumes,
  onClose,
}: {
  target: JobTarget;
  resumes: ResumeDocument[];
  onClose: (saved?: JobTarget) => void;
}) {
  const [draft, setDraft] = useState(target),
    [error, setError] = useState('');
  function set<K extends keyof JobTarget>(key: K, value: JobTarget[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }
  return (
    <Modal
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={target.version ? '编辑个人 JD' : '保存个人 JD'}
      description="仅保留在当前标签页，用于面试配置；当前不自动分析 JD。"
    >
      <form
        className="library-form"
        onSubmit={(e) => {
          e.preventDefault();
          try {
            const saved = demoClient.saveJobTarget(draft, target.version);
            onClose(saved);
          } catch (e) {
            setError((e as Error).message);
          }
        }}
      >
        <div className="field-pair">
          <label>
            岗位名称
            <input
              required
              maxLength={100}
              value={draft.title}
              onChange={(e) => set('title', e.target.value)}
            />
          </label>
          <label>
            企业 / 团队
            <input
              maxLength={100}
              value={draft.company}
              onChange={(e) => set('company', e.target.value)}
            />
          </label>
        </div>
        <label>
          岗位方向
          <select value={draft.job} onChange={(e) => set('job', e.target.value)}>
            {JOBS.map((j) => (
              <option value={j.id} key={j.id}>
                {j.title}
              </option>
            ))}
          </select>
        </label>
        <label>
          JD 原文
          <textarea
            required
            rows={7}
            maxLength={10000}
            value={draft.jd_text}
            onChange={(e) => set('jd_text', e.target.value)}
          />
        </label>
        <label>
          来源链接
          <input
            type="url"
            placeholder="https://…（可选）"
            value={draft.source_url}
            onChange={(e) => set('source_url', e.target.value)}
          />
        </label>
        <div className="field-pair">
          <label>
            常用简历
            <select
              value={draft.preferred_resume_id ?? ''}
              onChange={(e) => set('preferred_resume_id', e.target.value || undefined)}
            >
              <option value="">使用默认简历</option>
              {resumes.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            备注
            <input
              maxLength={1000}
              value={draft.notes}
              onChange={(e) => set('notes', e.target.value)}
            />
          </label>
        </div>
        {error && (
          <p role="alert" className="error-inline">
            {error}
          </p>
        )}
        <div className="row-actions">
          <Button type="button" variant="outline" onClick={() => onClose()}>
            取消
          </Button>
          <Button type="submit">保存 JD</Button>
        </div>
      </form>
    </Modal>
  );
}
export function emptyTarget(job = 'frontend'): JobTarget {
  return {
    id: crypto.randomUUID(),
    title: '',
    company: '',
    job,
    jd_text: '',
    source_url: '',
    notes: '',
    source_kind: 'custom_jd',
    version: 0,
    created_at: '',
    updated_at: '',
  };
}
