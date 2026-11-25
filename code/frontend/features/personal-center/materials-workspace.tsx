'use client';
import { useEffect, useState, useRef } from 'react';
import { RESUME_FIELDS, emptyResumeTemplate, extractResumeTemplate } from '@interviewlab/core';
import type { PersonalMaterial } from '@interviewlab/core';
import { apiRequest } from '../../lib/api/http';
import ResumeRecords from './resume-records';
import { WorkspaceFrame } from './workspace-frame';
const empty = { structure: emptyResumeTemplate(), title: '', text: '', kind: 'resume' as 'resume' | 'experience' };
export default function MaterialsWorkspace() {
  const [viewing, setViewing] = useState<PersonalMaterial>();
  const [editorOpen, setEditorOpen] = useState(false);
  const uploadRef = useRef<HTMLInputElement>(null);
  const [filename, setFilename] = useState('');
  const [importing, setImporting] = useState(false);
  const [items, setItems] = useState<PersonalMaterial[]>([]);
  const [draft, setDraft] = useState(empty);
  const [editing, setEditing] = useState<PersonalMaterial>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [notice, setNotice] = useState('');
  async function load() {
    setError('');
    try {
      setItems(await apiRequest<PersonalMaterial[]>('/materials'));
      setLoaded(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败');
    }
  }
  useEffect(() => {
    void load();
  }, []);
  async function action(work: () => Promise<unknown>) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await work();
      await load();
      setNotice('档案已保存');
    } catch (e) {
      setError(e instanceof Error ? e.message : '操作失败');
    } finally {
      setBusy(false);
    }
  }
  return (
    <WorkspaceFrame section="resumes">
      <section className="library-panel material-workspace">
        <h1>我的简历档案</h1><p>把经历整理成自己的档案，为每一次面试选择合适的材料。</p><div className="archive-steps"><span>01 导入材料</span><span>02 整理信息</span><span>03 保存档案</span></div>
        {error && (
          <p role="alert">
            {error} <button onClick={() => void load()}>重试</button>
          </p>
        )}
        {notice && <p role="status">{notice}</p>}
        {!loaded && !error && <p>正在加载…</p>}
        {loaded && (
          <>
            <details className="resume-editor-panel" open={editorOpen || !!editing || !items.length} onToggle={e=>setEditorOpen(e.currentTarget.open)}><summary>{editing?'编辑简历':'＋ 新建一份简历'}</summary>
            <form
              className="material-form"
              onSubmit={(e) => {
                e.preventDefault();
                void action(async () => {
                  await apiRequest('/materials' + (editing ? '/' + editing.id : ''), {
                    method: editing ? 'PUT' : 'POST',
                    body: { ...draft, confirmed: true, ...(editing ? { expected_version: editing.version } : {}) },
                  });
                  setDraft(empty);
                  setFilename('');
                  setEditing(undefined);setEditorOpen(false);

                });
              }}
            >
              <label>
                名称
                <input
                  required
                  maxLength={200}
                  value={draft.title}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                />
              </label>
              <div className="material-upload">
                <div>
                  <strong>导入你的简历</strong>
                  <p>支持 PDF、TXT，最大 5MB。导入后可直接编辑并保存档案。</p>
                </div>
                <input
                  ref={uploadRef}
                  className="material-file-input"
                  aria-label="选择 PDF 或文本简历"
                  type="file"
                  accept=".pdf,.txt,application/pdf,text/plain"
                  disabled={busy || importing}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    e.target.value = '';
                    if (!file) return;
                    if (file.size > 5 * 1024 * 1024) {
                      setError('请选择小于 5MB 的文件');
                      return;
                    }
                    if (!/\.(pdf|txt)$/i.test(file.name)) {
                      setError('请选择 PDF 或 TXT 文件');
                      return;
                    }
                    setImporting(true);
                    setError('');
                    setNotice('');
                    try {
                      let text: string;
                      if (/\.pdf$/i.test(file.name)) {
                        const data = await new Promise<string>((resolve, reject) => {
                          const reader = new FileReader();
                          reader.onload = () => resolve(String(reader.result).split(',')[1]);
                          reader.onerror = () => reject(new Error('文件读取失败'));
                          reader.readAsDataURL(file);
                        });
                        text = (
                          await apiRequest<{ text: string }>('/materials/import-pdf', {
                            method: 'POST',
                            body: { data },
                            timeoutMs: 30000,
                          })
                        ).text;
                      } else text = await file.text();
                      if (!text.trim() || text.length > 100000)
                        throw new Error('文件内容为空或超过 10 万字符，请检查后重试');
                      setDraft((current) => ({
                        ...current,
                        title: current.title || file.name.replace(/\.[^.]+$/, ''),
                        text,
                        structure: extractResumeTemplate(text),
                      }));
                      setFilename(file.name);
                      setNotice('导入成功，可编辑下方信息并保存档案。');
                    } catch (e) {
                      setError(e instanceof Error ? e.message : '导入失败，请重试');
                    } finally {
                      setImporting(false);
                    }
                  }}
                />
                <button
                  type="button"
                  className="material-upload-button"
                  disabled={busy || importing}
                  onClick={() => uploadRef.current?.click()}
                >
                  {importing ? '正在读取…' : '选择简历文件'}
                </button>
                {filename && <span className="material-filename">已导入：{filename}</span>}
              </div>
            <section className="resume-template resume-review"><h2>整理你的简历信息</h2><p className="resume-review-status">已填入 {Object.values(draft.structure).filter(value => value.trim()).length} / {Object.keys(RESUME_FIELDS).length} 项</p><p>请核对并补充简历信息。</p><button type="button" disabled={busy||importing||!draft.text.trim()} onClick={()=>{if(Object.values(draft.structure).some(value=>value.trim())&&!window.confirm('重新识别会覆盖当前模板中的手动修改，是否继续？'))return;setDraft({...draft,structure:extractResumeTemplate(draft.text)});setNotice('已重新整理简历信息。');}}>重新识别原文</button><ResumeRecords value={draft.structure} onChange={structure=>setDraft({...draft,structure})} /></section>
              <button disabled={busy || importing}>保存档案</button>
              <button
                type="button"
                onClick={() => {
                  setEditing(undefined);
                  setDraft(empty);
                  setFilename('');

                }}
              >
                取消编辑
              </button>
            </form></details>
            {!items.length && <p>还没有简历或经历，可以在上方创建。</p>}
            <h2>已保存的档案（{items.length}）</h2><p><a className="text-link" href="/jobs">选择岗位开始面试 →</a></p>
            {items.map((item) => (
              <article key={item.id} className="resume-summary-row">
                <div>
                  <strong>{item.title}</strong><p className="archive-meta">{Object.values(item.structure??{}).filter(x=>x.trim()).length} 项信息 · 已保存</p>
                  <p>
                    简历档案
                  </p>
                </div>
                <button type="button" onClick={()=>setViewing(item)}>查看档案</button>
                <button
                  disabled={busy || importing}
                  onClick={() => {
                    setEditing(item);
                    setDraft({
                      title: item.title,
                      text: item.text,
                      kind: item.kind,
                      structure: item.structure ?? extractResumeTemplate(item.text),
                    });

                  }}
                >
                  编辑
                </button>

                <button
                  disabled={busy || importing}
                  onClick={() => {
                    if (window.confirm('确定删除这份材料？'))
                      void action(() => apiRequest('/materials/' + item.id, { method: 'DELETE' }));
                  }}
                >
                  删除
                </button>
              </article>
            ))}
          </>
        )}
        {viewing && <div className="archive-modal" role="dialog" aria-modal="true" aria-label="简历档案"><div className="archive-modal-body"><button type="button" onClick={()=>setViewing(undefined)}>关闭档案</button><h2>{viewing.title}</h2><p>已保存的简历档案</p><ResumeRecords readonly value={viewing.structure??extractResumeTemplate(viewing.text)} /></div></div>}
      </section>
    </WorkspaceFrame>
  );
}
