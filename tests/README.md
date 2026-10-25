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

## 独立后端基础验收

- integration/backend.test.ts：无需数据库的 Fastify 注入测试，验证公开岗位、游标、schema、错误、能力缺失、身份边界与 OpenAPI。
- npm run test:db：运行 integration/database，必须配置独立 interviewlab_test* 数据库；执行迁移、回滚、并发幂等、outbox、租约/次数限制、归属和真实 pg-boss worker 测试。
- npm run test:process：先 build:backend 和 test:db；启动编译产物验证无库 API、有库 worker、失败启动和优雅停止/重启。
- integration/database/auth.test.ts：真实 Better Auth/Drizzle 密码哈希、Cookie、退出/过期/撤销、角色、资源归属、同源策略及跨实例限流。
- unit/http-client.test.ts：同源路径限制、幂等键、错误体、取消/超时及写入不自动重试。
- npm run test:web：先 npm run build，使用真实 Next.js 生产代理与 PostgreSQL 验证 Cookie 往返、登录/退出、Origin、错误、游标和后端断开后不回退合成接口。代理目标必须为本机且端口空闲。

数据库测试会清空公共基础及认证会话/限流测试表；缺失数据库直接失败，不会跳过。真实测试与普通 npm test 分开，避免首次运行原型要求安装数据库。CI 的 backend-infrastructure 使用 PostgreSQL 16 运行数据库、进程及真实代理测试，application 保持无库检查。启动和测试库命令见[后端说明](../code/backend/README.md)。
