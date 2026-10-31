'use client';
import { useEffect, useState } from 'react';
import type { PersonalMaterial, PersonalSettings } from '@interviewlab/core';
import { apiRequest } from '../../lib/api/http';
import { WorkspaceFrame } from './workspace-frame';
const empty={title:'',text:'',kind:'resume' as 'resume'|'experience',confirmed:false};
export default function MaterialsWorkspace({settingsOnly=false}:{settingsOnly?:boolean}) {
 const [items,setItems]=useState<PersonalMaterial[]>([]);
 const [settings,setSettings]=useState<PersonalSettings>();
 const [draft,setDraft]=useState(empty);
 const [editing,setEditing]=useState<PersonalMaterial>();
 const [history,setHistory]=useState<PersonalMaterial[]>([]);
 const [error,setError]=useState(''); const [busy,setBusy]=useState(false); const [loaded,setLoaded]=useState(false); const [notice,setNotice]=useState('');
 async function load(){setError('');try{const [m,s]=await Promise.all([apiRequest<PersonalMaterial[]>('/materials'),apiRequest<PersonalSettings>('/me/settings')]);setItems(m);setSettings(s);setLoaded(true);}catch(e){setError(e instanceof Error?e.message:'加载失败');}}
 useEffect(()=>{void load();},[]);
 async function action(work:()=>Promise<unknown>){setBusy(true);setError('');setNotice('');try{await work();await load();setNotice('操作已完成');}catch(e){setError(e instanceof Error?e.message:'操作失败');}finally{setBusy(false);}}
 return <WorkspaceFrame section={settingsOnly?'preferences':'resumes'}><section className="library-panel">
 <h1>{settingsOnly?'账号与个人设置':'简历与经历'}</h1>
 {error && <p role="alert">{error} <button onClick={()=>void load()}>重试</button></p>}
 {notice && <p role="status">{notice}</p>}{!loaded && !error && <p>正在加载…</p>}
 {loaded && settingsOnly && settings && <form onSubmit={e=>{e.preventDefault();void action(()=>apiRequest('/me/settings',{method:'PUT',body:settings}));}}>
 <label>个人显示名<input value={settings.display_name} maxLength={80} onChange={e=>setSettings({...settings,display_name:e.target.value})}/></label>
 <label>个人简介<textarea value={settings.bio} maxLength={1000} onChange={e=>setSettings({...settings,bio:e.target.value})}/></label>
 <label>目标岗位<input value={settings.target_role} maxLength={100} onChange={e=>setSettings({...settings,target_role:e.target.value})}/></label>
 <label>练习时长（分钟）<input type="number" min={5} max={120} value={settings.practice_minutes} onChange={e=>setSettings({...settings,practice_minutes:Number(e.target.value)})}/></label>
 <label>默认简历<select value={settings.default_resume_id??''} onChange={e=>setSettings({...settings,default_resume_id:e.target.value||null})}><option value="">不设置</option>{items.filter(x=>x.kind==='resume'&&x.confirmed).map(x=><option key={x.id} value={x.id}>{x.title}</option>)}</select></label>
 <button disabled={busy}>保存设置</button></form>}
 {loaded && !settingsOnly && <>
 <p>材料只属于当前账号。导入的文本是候选内容，请核对后确认；每次保存生成独立版本。</p>
 <form onSubmit={e=>{e.preventDefault();void action(async()=>{await apiRequest('/materials'+(editing?'/'+editing.id:''),{method:editing?'PUT':'POST',body:{...draft,...(editing?{expected_version:editing.version}:{})}});setDraft(empty);setEditing(undefined);setHistory([]);});}}>
 <select value={draft.kind} disabled={!!editing} onChange={e=>setDraft({...draft,kind:e.target.value as 'resume'|'experience'})}><option value="resume">简历</option><option value="experience">经历</option></select>
 <label>名称<input required maxLength={200} value={draft.title} onChange={e=>setDraft({...draft,title:e.target.value})}/></label>
 <label>导入文本文件<input type="file" accept=".txt,text/plain" onChange={async e=>{const file=e.target.files?.[0];if(!file)return;if(file.size>200000){setError('请选择小于 200KB 的文本文件');return;}setDraft({...draft,title:draft.title||file.name,text:await file.text(),confirmed:false});}}/></label>
 <label>内容<textarea required rows={14} maxLength={100000} value={draft.text} onChange={e=>setDraft({...draft,text:e.target.value,confirmed:false})}/></label>
 <label><input type="checkbox" checked={draft.confirmed} onChange={e=>setDraft({...draft,confirmed:e.target.checked})}/>我已核对以上内容，确认其为本人真实材料</label>
 <button disabled={busy}>{editing?'保存新版本':'创建材料'}</button><button type="button" onClick={()=>{setEditing(undefined);setDraft(empty);setHistory([]);}}>取消编辑</button>
 </form>
 {!items.length && <p>还没有简历或经历，可以在上方创建。</p>}
 {items.map(item=><article key={item.id} className="resume-summary-row"><div><strong>{item.title}</strong><p>{item.kind==='resume'?'简历':'经历'} · v{item.version} · {item.confirmed?'已确认':'待确认'}</p></div><button disabled={busy} onClick={()=>{setEditing(item);setDraft({title:item.title,text:item.text,kind:item.kind,confirmed:item.confirmed});setHistory([]);}}>编辑</button><button disabled={busy} onClick={()=>void action(async()=>setHistory(await apiRequest<PersonalMaterial[]>('/materials/'+item.id+'/versions')))}>版本历史</button><button disabled={busy} onClick={()=>{if(window.confirm('确定删除这份材料？'))void action(()=>apiRequest('/materials/'+item.id,{method:'DELETE'}));}}>删除</button></article>)}
 {history.length>0 && <section><h2>版本历史</h2>{history.map(v=><details key={v.version}><summary>{v.title} · v{v.version} · {v.confirmed?'已确认':'待确认'}</summary><pre style={{whiteSpace:'pre-wrap'}}>{v.text}</pre></details>)}</section>}
 </>}
 </section></WorkspaceFrame>;
}
