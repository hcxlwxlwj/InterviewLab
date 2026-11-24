'use client';
import { RESUME_FIELDS, type ResumeTemplate } from '@interviewlab/core';
const repeated = new Set(['education', 'projects', 'internships']);
export function splitRecords(value: string) {
  return value.split(/\n\s*\n/).map(x => x.trim()).filter(Boolean);
}
export default function ResumeRecords({ value, onChange, readonly = false }: { value: ResumeTemplate; onChange?: (value: ResumeTemplate) => void; readonly?: boolean }) {
  return <div className="archive-sections">{Object.entries(RESUME_FIELDS).map(([field, label]) => {
    const key = field as keyof ResumeTemplate;
    const records = repeated.has(key) ? splitRecords(value[key]) : [value[key]];
    return <section className="archive-section" key={key}><header><h3>{label}</h3><span>{value[key].trim() ? '已填写' : '待补充'}</span></header>
      {readonly ? <div className="archive-content">{value[key] || '暂未填写'}</div> : repeated.has(key) ? <>
        {records.map((record, index) => <div className="archive-record" key={index}><div className="archive-record-title"><strong>第 {index + 1} 段{key === 'projects' ? '项目' : key === 'education' ? '教育' : '实习 / 工作'}经历</strong><button type="button" onClick={() => onChange?.({...value,[key]:records.filter((_,i)=>i!==index).join('\n\n')})}>移除</button></div><label>名称、时间、角色与具体内容<textarea rows={6} value={record} onChange={e => onChange?.({...value,[key]:records.map((x,i)=>i===index?e.target.value:x).join('\n\n')})} /></label></div>)}
        <button type="button" className="archive-add" onClick={() => onChange?.({...value,[key]:[...records,'名称：\n时间：\n角色：\n内容与成果：'].join('\n\n')})}>＋ 添加一段经历</button>
        <small>自动整理可能未能分开相邻经历，可手动添加、调整；空行用于分隔不同经历。</small>
      </> : <label>{label}<textarea rows={['full_name','phone','email','city'].includes(key)?1:4} placeholder="未识别，请对照原文补充" value={value[key]} onChange={e=>onChange?.({...value,[key]:e.target.value})} /></label>}
    </section>;
  })}</div>;
}
