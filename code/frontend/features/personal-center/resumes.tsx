'use client';
import { getJob } from '@interviewlab/backend/content';
import { Copy, FileText, Pencil, Search, Star, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { EmptyState, formatDate } from '../../components/shared';
import { Button } from '../../components/ui/button';
import { demoClient } from '../../lib/demo-client';

import type { LoadedWorkspace } from './use-workspace';
export function ResumesSection({ workspace }: { workspace: LoadedWorkspace }) {
  const { router, query, setQuery, setMessage, setDeletion, setRenaming, act, filteredResumes } =
    workspace;
  return (
    <section className="library-panel">
      <div className="library-toolbar">
        <label className="search-box">
          <Search size={19} />
          <input
            aria-label="搜索简历"
            placeholder="搜索简历名称或方向"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <span>{filteredResumes.length} 份简历</span>
        <Button
          variant="outline"
          onClick={() => setMessage('PDF / DOCX 上传尚未接入，可先新建文本简历。')}
        >
          导入文件 · 未接入
        </Button>
      </div>
      {filteredResumes.length ? (
        <div className="resume-list">
          {filteredResumes.map((r) => (
            <article className="resume-library-row" key={r.id}>
              <span className="document-icon">
                <FileText size={29} />
              </span>
              <div className="resume-row-main">
                <h2>
                  <Link href={`/me/resumes/${r.id}`}>{r.name}</Link>
                  {r.is_default && <span className="badge badge-yellow">默认</span>}
                </h2>
                <p>
                  {getJob(r.target_job ?? '')?.title ?? '未指定方向'} · v{r.version}
                </p>
                <span className="muted">
                  更新于 {formatDate(r.updated_at ?? r.created_at)}
                  {r.is_sample ? ' · 合成样例' : ''}
                </span>
              </div>
              <div className="row-actions wrap">
                <Button asChild variant="outline" size="sm">
                  <Link href={`/me/resumes/${r.id}`}>
                    <Pencil size={16} />
                    编辑
                  </Link>
                </Button>
                <button
                  className="icon-button"
                  aria-label={`复制${r.name}`}
                  onClick={() =>
                    act(() => {
                      const copy = demoClient.duplicateResume(r.id);
                      router.push(`/me/resumes/${copy.id}`);
                    })
                  }
                >
                  <Copy size={18} />
                </button>
                <button
                  className="icon-button"
                  aria-label={`重命名${r.name}`}
                  onClick={() => setRenaming({ id: r.id, name: r.name })}
                >
                  <Pencil size={18} />
                </button>
                <button
                  className="icon-button"
                  aria-label={`将${r.name}设为默认`}
                  aria-pressed={r.is_default}
                  onClick={() => act(() => demoClient.setDefaultResume(r.id), '默认简历已更新。')}
                >
                  <Star size={18} fill={r.is_default ? 'currentColor' : 'none'} />
                </button>
                <button
                  className="icon-button"
                  aria-label={`删除${r.name}`}
                  onClick={() => setDeletion({ kind: 'resume', id: r.id })}
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState
          title={query ? '没有找到这份简历' : '还没有简历'}
          description="可以按不同岗位创建材料，也可以不使用简历开始面试。"
        />
      )}
    </section>
  );
}
