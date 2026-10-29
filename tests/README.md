# 测试与验收

按课程模板保持独立测试树，不随业务文件拆分而移动测试入口。在仓库根目录执行命令。

| 位置 / 命令 | 验证范围 |
| --- | --- |
| `unit/session.test.ts` | 主问题/追问预算、提交幂等、安全上限、终态、未观察/零回答及演示报告 |
| `unit/demo-client.test.ts` | 多简历、经历关联、版本冲突、快照、收藏、个人 JD、旧存储迁移及降级 |
| `unit/catalog.test.ts` | 1000 个岗位的独立题库、检索过滤、退役及显式模板输入 |
| `unit/interview-agent.test.ts` | ecnu-plus 兼容协议、结构/引用校验、超时/取消、错误脱敏及真实题量约束 |
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
- integration/database/interviews.test.ts：真实文字闭环、报告/重练/比较、版本与幂等、并发封存、零回答、降级、删除和 worker 重启；模型使用明确的受控替身。
- unit/http-client.test.ts：同源路径限制、幂等键、错误体、取消/超时及写入不自动重试。
- npm run test:web：先 npm run build，使用真实 Next.js 生产代理与 PostgreSQL 验证 Cookie 往返、登录/退出、Origin、错误、游标和后端断开后不回退合成接口。代理目标必须为本机且端口空闲。

数据库测试会清空公共基础、认证会话/限流及面试/报告测试表；缺失数据库直接失败，不会跳过。真实测试与普通 npm test 分开，避免首次运行原型要求安装数据库。CI 的 backend-infrastructure 使用 PostgreSQL 16 运行数据库、进程及真实代理测试，application 保持无库检查。启动和测试库命令见[后端说明](../code/backend/README.md)。

真实模型单独运行 `npm run test:llm`，要求本机 LLM_API_KEY 和独立 TEST_DATABASE_URL；仅发送合成文本，结束后清理自建记录。30 组追问/重练人工审查案例位于 `fixtures/interview-cases.ts`。本机浏览器验证脚本为 `support/interview-preview.ts`，显式使用受控 HTTP 模型、独立测试库及 33600/33601/35041 本机端口；输入 stop 后停止并清理测试账号。真实模型结果和受控流程验证分别记录，见[文字面试接入](../docs/software/interview-agent-implementation.md)。

`npm run test:llm:conversation` 使用真实配置模型，向同一个后端岗位分别发送“做过预约接口”和“只做过 React 页面”的两段合成自我介绍，再检查给出预约实现后如何追问，校验问题引用并输出三个场景的动态提问供人工检查。无需数据库，不代表完成了全部 Agent 质量评测。普通测试另覆盖完整自我介绍上下文、截断标记及禁止模型过早结束；数据库测试覆盖四种类型统一开场、对话字段持久化和全跳过的预算封存。

浏览器脚本设置 `INTERVIEW_PREVIEW_REAL_MODEL=1` 时改用本机 `.env` 的真实模型，35041 受控端口不启动；`INTERVIEW_PREVIEW_EMAIL` 可复用已有的指定测试账号。浏览器验收数据库必须与会执行 TRUNCATE 的数据库回归隔离。实测记录包含失败及重试，不把最终页面可读解释为每次生成均成功。

面试模块日常联调使用 `npm run dev:interview`：要求独立 `INTERVIEW_DEV_DATABASE_URL`（`interviewlab_dev*`），直接用固定开发身份进入原界面和真实模型流程，不创建账号或使用密码。该模式关闭账号服务，不清理开发记录；生产模式拒绝启动，前端生产构建不注入开发身份。`unit/interview-development.test.ts` 检查身份注入边界、生产禁用和客户端身份伪造无效。
