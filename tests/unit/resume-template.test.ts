import test from 'node:test';
import assert from 'node:assert/strict';
import {extractResumeTemplate} from '../../code/core_engine/src/resume-template';
test('resume import separates explicit sections and leaves absent facts blank',()=>{
 const value=extractResumeTemplate('姓名：示例同学\n邮箱：sample@example.com\n教育背景\n示例大学 软件工程\n专业技能\nTypeScript PostgreSQL\n项目经历\n课程项目：负责账号功能\n实习经历\n无');
 assert.equal(value.full_name,'示例同学');assert.equal(value.email,'sample@example.com');assert.equal(value.phone,'');assert.match(value.education,/示例大学/);assert.match(value.projects,/负责账号/);assert.doesNotMatch(value.projects,/TypeScript/);
});
