'use client';
import { useEffect, useState, useRef } from 'react';
import { RESUME_FIELDS, emptyResumeTemplate, extractResumeTemplate } from '@interviewlab/core';
import type { PersonalMaterial, PersonalSettings } from '@interviewlab/core';
import { apiRequest } from '../../lib/api/http';
import { WorkspaceFrame } from './workspace-frame';
const empty = { structure: emptyResumeTemplate(), title: '', text: '', kind: 'resume' as 'resume' | 'experience', confirmed: false };
export default function MaterialsWorkspace({ settingsOnly = false, targetsOnly = false }: { settingsOnly?: boolean; targetsOnly?: boolean }) {
  const uploadRef = useRef<HTMLInputElement>(null);
  const [filename, setFilename] = useState('');
  const [importing, setImporting] = useState(false);
  const [items, setItems] = useState<PersonalMaterial[]>([]);
  const [settings, setSettings] = useState<PersonalSettings>();
  const [draft, setDraft] = useState(empty);
  const [editing, setEditing] = useState<PersonalMaterial>();
  const [history, setHistory] = useState<PersonalMaterial[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [notice, setNotice] = useState('');
  async function load() {
    setError('');
    try {
      const [m, s] = await Promise.all([
        apiRequest<PersonalMaterial[]>('/materials'),
        apiRequest<PersonalSettings>('/me/settings'),
      ]);
      setItems(m);
      setSettings(s);
      setLoaded(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败');
    }
  }
  useEffect(() => {
    void load();
  }, []);
  useEffect(()=>{
    if(!items.some(item=>item.analysis?.status==='pending'))return;
    const timer=setTimeout(()=>void load(),1500);
    return ()=>clearTimeout(timer);
  },[items]);
  async function action(work: () => Promise<unknown>) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await work();
      await load();
      setNotice('操作已完成');
    } catch (e) {
      setError(e instanceof Error ? e.message : '操作失败');
    } finally {
      setBusy(false);
    }
  }
  return (
    <WorkspaceFrame section={targetsOnly ? 'saved-jobs' : settingsOnly ? 'preferences' : 'resumes'}>
      <section className="library-panel material-workspace">
        <h1>{targetsOnly ? '目标岗位与求职方向' : settingsOnly ? '账号与个人设置' : '简历与经历'}</h1>
        {error && (
          <p role="alert">
            {error} <button onClick={() => void load()}>重试</button>
          </p>
        )}
        {notice && <p role="status">{notice}</p>}
        {!loaded && !error && <p>正在加载…</p>}
        {loaded && settingsOnly && settings && (
          <form
            className="material-form"
            onSubmit={(e) => {
              e.preventDefault();
              void action(() => apiRequest('/me/settings', { method: 'PUT', body: settings }));
            }}
          >
            <label>
              个人显示名
              <input
                value={settings.display_name}
                maxLength={80}
                onChange={(e) => setSettings({ ...settings, display_name: e.target.value })}
              />
            </label>
            <label>
              个人简介
              <textarea
                value={settings.bio}
                maxLength={1000}
                onChange={(e) => setSettings({ ...settings, bio: e.target.value })}
              />
            </label>
            <h2>求职方向与个人画像</h2>{[['city','所在城市'],['career_stage','求职阶段（实习 / 校招 / 社招）'],['strengths','个人优势（本人填写）'],['learning_goals','希望重点练习的内容']].map(([key,label])=><label key={key}>{label}<textarea rows={3} maxLength={key==='city'||key==='career_stage'?100:3000} value={String(settings[key as keyof PersonalSettings]??'')} onChange={e=>setSettings({...settings,[key]:e.target.value})}/></label>)}
            <label>默认作答方式<select value={settings.interaction_mode??'text_fallback'} onChange={e=>setSettings({...settings,interaction_mode:e.target.value as 'text_fallback'|'realtime_voice'})}><option value="text_fallback">文字作答</option><option value="realtime_voice">语音作答</option></select></label>
            <label>面试官风格<select value={settings.interviewer_style??'标准'} onChange={e=>setSettings({...settings,interviewer_style:e.target.value as '标准'|'友好'|'深入追问'})}><option>标准</option><option>友好</option><option>深入追问</option></select></label>
            <label>
              目标岗位
              <input
                value={settings.target_role}
                maxLength={100}
                onChange={(e) => setSettings({ ...settings, target_role: e.target.value })}
              />
            </label>
            <label>
              练习时长（分钟）
              <input
                type="number"
                min={5}
                max={120}
                value={settings.practice_minutes}
                onChange={(e) =>
                  setSettings({ ...settings, practice_minutes: Number(e.target.value) })
                }
              />
            </label>
            <label>
              默认简历
              <select
                value={settings.default_resume_id ?? ''}
                onChange={(e) =>
                  setSettings({ ...settings, default_resume_id: e.target.value || null })
                }
              >
                <option value="">不设置</option>
                {items
                  .filter((x) => x.kind === 'resume' && x.confirmed)
                  .map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.title}
                    </option>
                  ))}
              </select>
            </label>
            <button disabled={busy || importing}>保存设置</button>
          </form>
        )}
        {loaded && !settingsOnly && (
          <>
            <p>可分别创建“前端实习版”“后端校招版”等多份简历。每次模拟面试可单独选择一份；导入内容需核对确认。</p>
            <form
              className="material-form"
              onSubmit={(e) => {
                e.preventDefault();
                void action(async () => {
                  await apiRequest('/materials' + (editing ? '/' + editing.id : ''), {
                    method: editing ? 'PUT' : 'POST',
                    body: { ...draft, ...(editing ? { expected_version: editing.version } : {}) },
                  });
                  setDraft(empty);
                  setFilename('');
                  setEditing(undefined);
                  setHistory([]);
                });
              }}
            >
              <select
                value={draft.kind}
                disabled={!!editing}
                onChange={(e) =>
                  setDraft({ ...draft, kind: e.target.value as 'resume' | 'experience' })
                }
              >
                <option value="resume">简历</option>
                <option value="experience">经历</option>
              </select>
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
                  <p>支持 PDF、TXT，最大 5MB。导入后请核对文字再确认。</p>
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
                        confirmed: false,
                      }));
                      setFilename(file.name);
                      setNotice('导入成功，请核对下方内容并确认。');
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
            <section className="resume-template"><h2>标准简历 · 信息核对</h2><p>从文件提取的候选信息需要逐项核对。未识别的内容请根据原文补充，系统不会补写事实。</p><button type="button" disabled={busy||importing||!draft.text.trim()} onClick={()=>{setDraft({...draft,structure:extractResumeTemplate(draft.text),confirmed:false});setNotice('已从原文重新提取，请逐项核对。');}}>从原文重新填入模板</button>{Object.entries(RESUME_FIELDS).map(([key,label])=><label key={key}>{label}<textarea rows={key==='projects'?6:3} value={draft.structure[key as keyof typeof draft.structure]} onChange={e=>setDraft({...draft,confirmed:false,structure:{...draft.structure,[key]:e.target.value}})} /></label>)}</section>
              <label>
                原始文本（供核对，可选）
                <textarea
                  rows={8}
                  maxLength={100000}
                  value={draft.text}
                  onChange={(e) => setDraft({ ...draft, text: e.target.value, confirmed: false })}
                />
              </label>
              <label className="material-confirm">
                <input
                  type="checkbox"
                  checked={draft.confirmed}
                  onChange={(e) => setDraft({ ...draft, confirmed: e.target.checked })}
                />
                我已核对以上内容，确认其为本人真实材料
              </label>
              <button disabled={busy || importing}>{editing ? '保存标准简历版本' : '保存为一份新简历 / 经历'}</button>
              <button
                type="button"
                onClick={() => {
                  setEditing(undefined);
                  setDraft(empty);
                  setFilename('');
                  setHistory([]);
                }}
              >
                取消编辑
              </button>
            </form>
            {!items.length && <p>还没有简历或经历，可以在上方创建。</p>}
            <h2>我的简历与经历（{items.length}）</h2><p><a className="text-link" href="/interview/setup">选择一份简历开始模拟面试 →</a></p>
            {items.map((item) => (
              <article key={item.id} className="resume-summary-row">
                <div>
                  <strong>{item.title}</strong>
                  <p>
                    {item.kind === 'resume' ? '简历' : '经历'} · v{item.version} ·{' '}
                    {item.confirmed ? '已确认' : '待确认'}
                    {item.analysis && ` · ${{pending:'面试线索分析中',ready:'面试线索已准备',failed:'分析失败',unavailable:'尚未分析'}[item.analysis.status]}`}
                  </p>
                </div>
                {item.kind==='resume' && item.confirmed && item.analysis && ['failed','unavailable'].includes(item.analysis.status) && <button type="button" disabled={busy} onClick={()=>void action(()=>apiRequest(`/materials/${item.id}/analysis`,{method:'POST',body:{version:item.version},idempotencyKey:crypto.randomUUID()}))}>准备面试线索</button>}
                {item.kind==='resume' && <button type="button" disabled={busy||importing} onClick={()=>{setEditing(undefined);setDraft({title:item.title+'（新岗位版）',text:item.text,kind:item.kind,structure:item.structure??extractResumeTemplate(item.text),confirmed:false});setHistory([]);setNotice('已复制为新简历草稿，请修改岗位相关内容并确认保存。');window.scrollTo({top:0,behavior:'smooth'});}}>复制为新岗位版</button>}
                <button
                  disabled={busy || importing}
                  onClick={() => {
                    setEditing(item);
                    setDraft({
                      title: item.title,
                      text: item.text,
                      kind: item.kind,
                      structure: item.structure ?? extractResumeTemplate(item.text),
                    confirmed: item.confirmed,
                    });
                    setHistory([]);
                  }}
                >
                  编辑
                </button>
                <button
                  disabled={busy || importing}
                  onClick={() =>
                    void action(async () =>
                      setHistory(
                        await apiRequest<PersonalMaterial[]>('/materials/' + item.id + '/versions'),
                      ),
                    )
                  }
                >
                  版本历史
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
            {history.length > 0 && (
              <section>
                <h2>版本历史</h2>
                {history.map((v) => (
                  <details key={v.version}>
                    <summary>
                      {v.title} · v{v.version} · {v.confirmed ? '已确认' : '待确认'}
                    </summary>
                    <pre style={{ whiteSpace: 'pre-wrap' }}>{v.text}</pre>
                  </details>
                ))}
              </section>
            )}
          </>
        )}
      </section>
    </WorkspaceFrame>
  );
}
