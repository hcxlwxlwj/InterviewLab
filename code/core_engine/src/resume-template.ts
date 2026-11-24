export const RESUME_FIELDS = {"full_name": "姓名", "phone": "联系电话", "email": "邮箱", "city": "所在城市", "education": "教育背景", "skills": "专业技能", "projects": "项目经历（职责、行动、技术取舍、结果）", "internships": "实习与工作经历", "awards": "竞赛与荣誉", "summary": "个人优势与自我介绍"} as const;
export type ResumeTemplate = Record<keyof typeof RESUME_FIELDS,string>;
export const emptyResumeTemplate = (): ResumeTemplate => Object.fromEntries(Object.keys(RESUME_FIELDS).map(k=>[k,''])) as ResumeTemplate;
export function extractResumeTemplate(text: string): ResumeTemplate {
 const result = emptyResumeTemplate();
 const normalized = text.replace(/\r\n?/g, '\n').replace(/\u00a0/g, ' ');
 result.email = normalized.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/)?.[0] ?? '';
 result.phone = normalized.match(/(?<!\d)(?:\+86[ -]?)?1[3-9](?:[ -]?\d){9}(?!\d)/)?.[0] ?? '';
 const sections: [RegExp, keyof ResumeTemplate][] = [
  [/^(教育背景|教育经历|学历信息|教育|education(?: background)?)$/i, 'education'],
  [/^(专业技能|技术技能|技能清单|技能特长|个人技能|技能|skills|technical skills)$/i, 'skills'],
  [/^(项目经历|项目经验|个人项目|科研经历|项目|projects|project experience)$/i, 'projects'],
  [/^(实习经历|工作经历|工作经验|实习与工作经历|实践经历|实习|experience|work experience|internships?)$/i, 'internships'],
  [/^(竞赛与荣誉|荣誉奖项|获奖经历|获奖情况|竞赛经历|荣誉|奖项|awards|honors)$/i, 'awards'],
  [/^(个人优势|自我评价|个人简介|自我介绍|个人总结|summary|profile)$/i, 'summary'],
 ];
 let current: keyof ResumeTemplate | undefined;
 for (const raw of normalized.split('\n')) {
  const line = raw.trim();
  if (!line) {
   if (current && result[current] && !result[current].endsWith('\n')) result[current] += '\n';
   continue;
  }
  const candidate = line.replace(/^[\s•●■◆#一二三四五六七八九十0-9、.（）()]+/, '').trim();
  const colon = candidate.search(/[:：]/);
  const title = (colon < 0 ? candidate : candidate.slice(0, colon)).replace(/\s/g, '');
  const section = sections.find(([pattern]) => pattern.test(title));
  if (section) {
   current = section[1];
   const rest = colon < 0 ? '' : candidate.slice(colon + 1).trim();
   if (rest) result[current] += (result[current] ? '\n' : '') + rest;
   continue;
  }
  const name = line.match(/(?:^|[|｜])\s*(?:姓名|名字)\s*[:：]\s*([^|｜,，;；\s]{2,30})/);
  if (name) result.full_name = name[1];
  const city = line.match(/(?:^|[|｜])\s*(?:城市|所在城市|现居地|所在地|现居)\s*[:：]\s*([^|｜;；]{2,40})/);
  if (city) result.city = city[1].trim();
  if (current) result[current] += (result[current] ? '\n' : '') + line;
 }
 return result;
}
