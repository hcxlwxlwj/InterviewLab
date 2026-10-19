# 代码导航

代码沿用[课程模板](https://github.com/bettermorn/IntelligentSWEPractice)的前端、后端、领域核心分工；公开内容适配收在 backend 内。全部在仓库根目录安装和执行 npm 命令。

| 工作区 | 包名 | 修改入口 |
| --- | --- | --- |
| [frontend](frontend/README.md) | `@interviewlab/web` | Next.js 页面、个人中心分区、组件和标签页演示客户端 |
| [backend](backend/README.md) | `@interviewlab/backend` | HTTP 路由、Zod 校验、错误格式、未来身份与仓储接入 |
| [core_engine](core_engine/README.md) | `@interviewlab/core` | 领域类型、适配接口、问题预算、会话规则和分数空值规则 |

依赖方向：前端与后端 → 内容适配 → 领域核心。前端通过后端的 `/content`、`/content/demo` 子入口读取公开内容；HTTP 后端入口仅供 `app/api/` 使用；领域核心不依赖 Next.js、浏览器存储、Node API 或 JSON 文件。依赖边界由 `npm run boundaries:check` 校验。

公共资料位于 [docs/algorithm/content](../docs/algorithm/content/README.md)，测试独立放在 [tests](../tests/README.md)，不把用户材料放入公共知识库。完整目录、文档分工与后续数据库/Agent 接入顺序见[工程结构](../docs/software/repository_structure.md)。
