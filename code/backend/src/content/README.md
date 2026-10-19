# 公开内容适配

本模块位于 `code/backend/src/content`，通过 `@interviewlab/backend/content` 和 `@interviewlab/backend/content/demo` 两个独立公开子入口复用，不另建工作区。

- `index.ts`：读取 `docs/algorithm/content/*.json`，调用核心的 `createJobCatalog`，导出已发布岗位、查找、筛选和本地检索实例。
- `demo.ts`：导出合成简历、经历、示例会话和演示报告；固定评分仅用于合成示例。

公开入口只依赖领域核心和公开 JSON，不导入后端 HTTP、存储或供应商代码，不保存真实用户材料或密钥；依赖检查会阻止混入服务端实现。

模板正文、版本、来源及审核日期只在[内容资料目录](../../../../docs/algorithm/content/README.md)维护。运行 `npm run content:check` 检查发布完整性，运行 `npm test` 验证筛选、退役、检索和题目预算。未来 pgvector 适配由后端实现 `KnowledgeRetriever`。
