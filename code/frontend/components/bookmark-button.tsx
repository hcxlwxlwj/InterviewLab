'use client';
import {useEffect,useState} from 'react';
import {Bookmark} from 'lucide-react';
import {apiRequest} from '../lib/api/http';
export function BookmarkButton({id}:{id:string}){
 const [saved,setSaved]=useState(false),[busy,setBusy]=useState(true),[error,setError]=useState('');
 useEffect(()=>{setBusy(true);apiRequest<{saved:boolean}>('/bookmarks/'+encodeURIComponent(id)).then(v=>{setSaved(v.saved);setError('');}).catch(()=>setError('收藏状态读取失败，请点击重试')).finally(()=>setBusy(false));},[id]);
 return <span className="bookmark-control"><button type="button" className="bookmark-action" aria-pressed={saved} disabled={busy} onClick={async()=>{setBusy(true);setError('');try{if(error){const v=await apiRequest<{saved:boolean}>('/bookmarks/'+encodeURIComponent(id));setSaved(v.saved);}else{const v=await apiRequest<{saved:boolean}>('/bookmarks/'+encodeURIComponent(id),{method:saved?'DELETE':'PUT'});setSaved(v.saved);}}catch(e){setError(e instanceof Error?e.message:'收藏失败，请重试');}finally{setBusy(false);}}}><Bookmark size={18} fill={saved?'currentColor':'none'}/>{busy?'处理中':error?'重试':saved?'已收藏':'收藏岗位'}</button>{error&&<small role="alert">{error}</small>}</span>;
}
