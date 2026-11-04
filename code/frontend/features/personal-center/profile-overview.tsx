'use client';
import Link from 'next/link';
import {useEffect,useState} from 'react';
import type {PersonalMaterial,PersonalSettings} from '@interviewlab/core';
import {apiRequest} from '../../lib/api/http';
export default function ProfileOverview(){
 const [settings,setSettings]=useState<PersonalSettings>();const [resume,setResume]=useState<PersonalMaterial>();const [error,setError]=useState('');
 useEffect(()=>{Promise.all([apiRequest<PersonalSettings>('/me/settings'),apiRequest<PersonalMaterial[]>('/materials')]).then(([s,m])=>{setSettings(s);setResume(m.find(x=>x.id===s.default_resume_id&&x.confirmed));}).catch(()=>setError('个人画像暂时无法加载，请刷新重试。'));},[]);
 return <><section className="library-panel" style={{maxWidth:1100,margin:'24px auto',padding:28}}><h1>我的求职画像</h1>{error&&<p role="alert">{error}</p>}{!settings&&!error&&<p>正在读取个人资料…</p>}{settings&&<><p>{settings.display_name||'尚未填写显示名'} · {settings.city||'城市待补充'} · {settings.career_stage||'求职阶段待补充'}</p><h2>{settings.target_role||'设置你的目标岗位'}</h2><p>{settings.bio||'填写简介，让练习更贴近你的目标。'}</p><p>个人优势：{settings.strengths||'待本人补充'}</p><p>练习目标：{settings.learning_goals||'待本人补充'}</p><p>默认简历：{resume?`${resume.title} · v${resume.version}`:'尚未选择已确认简历'}</p>{resume?.structure&&<p>已确认技能：{resume.structure.skills||'待补充'}<br/>教育背景：{resume.structure.education||'待补充'}</p>}<p>画像来自本人填写及已确认材料，不自动推断性格或能力。</p><Link href="/me/preferences">完善画像与偏好 →</Link></>}</section></>;
}
