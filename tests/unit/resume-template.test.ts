import test from 'node:test';
import assert from 'node:assert/strict';
import {extractResumeTemplate} from '../../code/core_engine/src/resume-template';
test('resume import separates explicit sections and leaves absent facts blank',()=>{
 const value=extractResumeTemplate('姓名：示例同学\n邮箱：sample@example.com\n教育背景\n示例大学 软件工程\n专业技能\nTypeScript PostgreSQL\n项目经历\n课程项目：负责账号功能\n实习经历\n无');
 assert.equal(value.full_name,'示例同学');assert.equal(value.email,'sample@example.com');assert.equal(value.phone,'');assert.match(value.education,/示例大学/);assert.match(value.projects,/负责账号/);assert.doesNotMatch(value.projects,/TypeScript/);
});

test('body keywords do not become headings and blank lines separate records', () => {
 const value = extractResumeTemplate('项目经历\n项目名称：校园服务\n负责项目开发与专业技能培训\n\n项目名称：课程平台\n完成账号模块');
 assert.match(value.projects, /负责项目开发与专业技能培训/);
 assert.match(value.projects, /\n\n项目名称：课程平台/);
 assert.equal(value.skills, '');
});
