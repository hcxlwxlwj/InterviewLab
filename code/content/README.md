# 公开内容适配 · @interviewlab/content

本包将根目录 `content/*.json` 接到领域核心，供前端公开展示及后端本地检索复用。单独增加工作区是为了让课程模板中的 `core_engine` 保持无文件、框架和存储依赖。

- `src/index.ts`：读取岗位、分类、来源 JSON，调用核心的 `createJobCatalog`，导出已发布岗位、查找、筛选和本地检索实例。
- `src/demo.ts`：通过 `@interviewlab/content/demo` 单独导出合成简历、经历、示例会话和演示报告；固定评分仅用于合成示例。

不得导入前端或后端实现，不得保存真实用户材料。模板正文、版本、来源及审核日期只在[根内容目录](../../content/README.md)维护，不在 TypeScript 再维护一份题库。

`npm run content:check` 检查发布完整性、引用与复核期限；`npm test` 验证岗位筛选、退役、检索和题目预算。未来 pgvector 适配由后端实现 `KnowledgeRetriever`，当前本地检索不代表已经接入模型或向量数据库。
