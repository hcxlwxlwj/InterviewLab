export const RESUME_FIELDS = {"full_name": "姓名", "phone": "联系电话", "email": "邮箱", "city": "所在城市", "education": "教育背景", "skills": "专业技能", "projects": "项目经历（职责、行动、技术取舍、结果）", "internships": "实习与工作经历", "awards": "竞赛与荣誉", "summary": "个人优势与自我介绍"} as const;
export type ResumeTemplate = Record<keyof typeof RESUME_FIELDS,string>;
export const emptyResumeTemplate = (): ResumeTemplate => Object.fromEntries(Object.keys(RESUME_FIELDS).map(k=>[k,''])) as ResumeTemplate;
export function extractResumeTemplate(text:string):ResumeTemplate {
 const result=emptyResumeTemplate();
 result.email=text.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/)?.[0]??'';
 result.phone=text.match(/(?<!\d)1[3-9]\d{9}(?!\d)/)?.[0]??'';
 const headings:Record<string,keyof ResumeTemplate>={'教育':'education','学历':'education','技能':'skills','项目':'projects','实习':'internships','工作经历':'internships','获奖':'awards','荣誉':'awards','自我评价':'summary','个人优势':'summary'};
 let current:keyof ResumeTemplate|undefined;
 for(const line of text.split(/\n/)){const heading=Object.keys(headings).find(k=>line.trim().length<35&&line.includes(k));if(heading)current=headings[heading];if(current)result[current]+=(result[current]?'\n':'')+line;const name=line.match(/^(?:姓名|名字)[:：\s]+(.{2,30})$/);if(name)result.full_name=name[1];const city=line.match(/^(?:城市|现居地|所在地)[:：\s]+(.{2,40})$/);if(city)result.city=city[1];}
 return result;
}
