# 测试与验收

按课程模板保持独立测试树，不随业务文件拆分而移动测试入口。在仓库根目录执行命令。

| 位置 / 命令 | 验证范围 |
| --- | --- |
| `unit/session.test.ts` | 主问题/追问预算、提交幂等、安全上限、终态、未观察/零回答及演示报告 |
| `unit/demo-client.test.ts` | 多简历、经历关联、版本冲突、快照、收藏、个人 JD、旧存储迁移及降级 |
| `unit/catalog.test.ts` | 36 个岗位的独立题库、检索过滤、退役及显式模板输入 |
| `integration/api.test.ts` | 内存 Request/Response 路由、分页、错误、同源检查与未接入能力 |
| `npm run boundaries:check` | 工作区依赖方向、纯核心与 API 服务端边界 |
| `npm run content:check` | 发布内容、来源及到期复核 |
| `npm run docs:check` | 课程必需目录和 Markdown 本地链接 |

`npm test` 执行单元和接口测试，`npm run check` 执行上述检查及类型检查。再单独运行 `npm run build` 验证生产构建。

接口测试不启动数据库、真实身份或模型。浏览器主路径与响应式检查另在[原型实现](../docs/software/prototype/library-expansion.md)记录证据，不能把规则测试解释为真实 AI 质量或学习效果验证。
