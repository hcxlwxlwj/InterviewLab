# 接口与服务边界 · @interviewlab/backend

此包由 Next.js 的 `/api/v1/[...path]` Route Handler 托管，当前没有独立后端进程。实际接入状态见[数据与接口](../../docs/software/data_and_interfaces.md)。

| 文件 | 职责 |
| --- | --- |
| `src/http/router.ts` | GET 公开内容/合成样例路由、同源写入检查、未接入响应 |
| `src/http/schemas.ts` | Zod 请求校验与已发布岗位校验 |
| `src/http/responses.ts` | JSON、缓存策略、错误信封及数据来源响应头 |
| `src/http/contracts.ts` | 规划接口清单；列出不表示均已实现 |
| `src/services.ts` | 经验证身份、会话仓储的服务端接入合同 |
| `src/index.ts` | 路由与合同的公共入口 |

公开岗位接口读取 `@interviewlab/content`；用户读取只返回明确标注的合成样例。业务写入通过基础校验后返回 `501 capability_unavailable`，不会保存用户数据。

数据库访问、真实身份检查和供应商适配应在此包实现，并遵守核心定义的接口；不放入页面或 `core_engine`。只在有实际实现时创建仓储、服务或供应商目录，避免维护空层级。

接口测试位于 [tests/integration](../../tests/integration)。在仓库根目录执行 `npm test`；生产运行仍使用根目录 `npm run build`、`npm start`。
