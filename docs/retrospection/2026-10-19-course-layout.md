# 2026-10-19：按老师目录收拢仓库

用户明确要求减少额外目录，尽量贴近课程结构。本轮在此前职责拆分基础上收拢物理位置，页面与业务行为保持一致。

| 原位置 | 当前位置 |
| --- | --- |
| 根 `content/` | `docs/algorithm/content/`，保留全部岗位、来源与历史资料 |
| 根 `scripts/` | `.github/scripts/`，复用原文档检查位置 |
| `code/content` 工作区 | `code/backend/src/content/`，改为后端公开子入口 |
| 根 `COLLABORATION.md` | `docs/mgmt/COLLABORATION.md` |
| 独立 Prettier 配置 | 合并进根 `package.json`，格式命令读取 `.gitignore` |

顶层目录保留 `.github`、`code`、`docs`、`tests`；代码仅有 `backend`、`frontend`、`core_engine`。`tests` 是课程要求的测试目录，根目录 npm/TypeScript/Git 配置继续承担启动、构建和协作功能。

公开内容模块通过 `@interviewlab/backend/content` 与 `/content/demo` 独立导出，只依赖纯核心与公开 JSON；依赖检查限制其引用服务端代码。前端服务端 API 路由仍使用后端主入口，领域核心仍不读取文件。

已更新源码、工作区、命令、课程结构检查与本地文档链接。历史记录保留当时目录描述，当前入口见[工程目录与职责](../software/repository_structure.md)。

验证：类型、依赖边界、35 项测试、36 个岗位/288 道问题/72 条来源及文档链接检查通过。生产构建通过；本地 HTTP 验证首页、个人中心均为 200，岗位列表返回 36 个模板，AI 产品详情保留 8 道对应问题。公开内容模块引用后端 HTTP 实现的负向探针被依赖检查正确拦截，探针已移除。
