# 代码导航

代码沿用[课程模板](https://github.com/bettermorn/IntelligentSWEPractice)的前端、后端、领域核心分工；公开内容适配收在 backend 内。全部在仓库根目录安装和执行 npm 命令。

| 工作区 | 包名 | 修改入口 |
| --- | --- | --- |
| [frontend](frontend/README.md) | `@interviewlab/web` | Next.js 页面、业务功能和共享组件 |
| [backend](backend/README.md) | `@interviewlab/backend` | Fastify API、worker、业务模块、数据库及 Agent |
| [core_engine](core_engine/README.md) | `@interviewlab/core` | 领域类型、适配接口、问题预算、会话规则和分数空值规则 |

依赖方向：前端与后端依赖共享领域核心，前端业务通过同源 `/api/v1` 访问后端。领域核心不依赖框架或数据库。依赖边界由 `npm run boundaries:check` 校验。

公共资料位于 [docs/algorithm/content](../docs/algorithm/content/README.md)，测试独立放在 [tests](../tests/README.md)，不把用户材料放入公共知识库。当前目录职责与文档分工见[工程结构](../docs/software/repository_structure.md)。
