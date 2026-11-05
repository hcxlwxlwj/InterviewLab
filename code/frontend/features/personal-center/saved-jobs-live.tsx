'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {Bookmark,ArrowUpRight} from 'lucide-react';
import {apiRequest} from '../../lib/api/http';
import {WorkspaceFrame} from './workspace-frame';
type SavedJob={id:string;title:string;slug:string;tags:string[];available:boolean;saved_at:string};
export default function SavedJobs(){const [items,setItems]=useState<SavedJob[]>(),[error,setError]=useState(''),[busy,setBusy]=useState('');
 async function load(){setError('');try{setItems(await apiRequest<SavedJob[]>('/bookmarks'));}catch(e){setError(e instanceof Error?e.message:'加载失败');}}
 useEffect(()=>{void load();},[]);
 return <WorkspaceFrame section="saved-jobs"><section className="personal-heading"><span className="personal-eyebrow">MY CAREER COLLECTION</span><h1>目标岗位</h1><p>在岗位库收藏心仪的方向，把下一次练习变得更具体。</p><Link className="personal-primary" href="/jobs">探索岗位库 <ArrowUpRight size={18}/></Link></section>{error&&<p role="alert">{error}<button onClick={()=>void load()}>重试</button></p>}{!items&&!error&&<p>正在读取收藏…</p>}{items&&!items.length&&<section className="personal-empty"><Bookmark size={36}/><h2>还没有收藏的岗位</h2><p>去岗位库点击“收藏岗位”，它就会出现在这里。</p><Link href="/jobs">去发现适合你的岗位 →</Link></section>}<div className="saved-job-grid">{items?.map(job=><article className="saved-job-card" key={job.id}><span className="personal-eyebrow">已收藏 · {new Date(job.saved_at).toLocaleDateString('zh-CN')}</span><h2>{job.title}</h2><div className="catalog-tags">{job.tags.slice(0,4).map(tag=><span key={tag}>{tag}</span>)}</div><div className="personal-card-actions">{job.available&&<><Link href={'/jobs/'+job.slug}>查看岗位</Link><Link className="personal-primary" href={'/interview/setup?job='+encodeURIComponent(job.id)}>模拟面试 →</Link></>}<button disabled={!!busy} onClick={async()=>{setBusy(job.id);try{await apiRequest('/bookmarks/'+encodeURIComponent(job.id),{method:'DELETE'});await load();}catch(e){setError(e instanceof Error?e.message:'取消失败');}finally{setBusy('');}}}>{busy===job.id?'处理中':'取消收藏'}</button></div></article>)}</div></WorkspaceFrame>;
}
