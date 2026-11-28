# 工程目录与文件职责

本页说明当前代码归属；完整清单见[项目文件树](project-file-tree.md)。运行方法见[开发指南](development.md)，系统边界见[总体架构](architecture.md)，Agent 工作流和限制见[面试智能体架构](interview-agent-implementation.md)。

仓库沿用课程模板的 `docs/requirements`、`docs/algorithm`、`docs/software`、`docs/mgmt`、`docs/retrospection`、`code/backend`、`code/frontend`、`code/core_engine` 和 `tests`。用户测试入口是 [InterviewLab 交叉用户测试](../../tests/interviewlab_demo_user_test.md)，当前状态为待执行；目录存在不代表用户测试已经完成。

```text
InterviewLab/
├── code/
│   ├── frontend/                 Next.js 应用
│   │   ├── app/                  路由和页面入口
│   │   ├── features/             面试、视频和个人中心等业务功能
│   │   ├── components/           跨业务复用的界面组件
│   │   └── lib/                  API 客户端、认证与通用工具
│   ├── backend/                  Fastify API 与后台 worker
│   │   ├── drizzle/              数据库迁移及快照
│   │   └── src/
│   │       ├── entrypoints/      进程和命令入口
│   │       ├── server/           API 装配
│   │       ├── database/         数据库连接与基础表
│   │       ├── foundation/       配置、认证、错误、共享 Agent 工作流
│   │       ├── tasks/            持久任务和 worker 基础设施
│   │       ├── content/          公共内容加载
│   │       └── modules/          按业务组织的功能
│   │           ├── accounts/     账号与用户设置
│   │           ├── interviews/   面试会话、Agent、语音和状态
│   │           ├── reports/      报告 Agent、评分汇总和报告业务
│   │           ├── resumes/      简历材料及分析
│   │           ├── jobs/         岗位与收藏
│   │           └── knowledge/    专业知识与检索索引
│   └── core_engine/              无框架依赖的共享类型与领域规则
├── docs/                         需求、设计、管理和历史记录
├── tests/                        单元、集成测试和测试辅助工具
└── .github/                      CI 与协作模板
```

## 后端模块约定

业务模块按实际需要组织接口、服务和数据访问，不要求每个模块都创建空层。`routes.ts` 注册 HTTP 接口，`service.ts` 协调业务，`repository.ts` 实现数据访问；`db-schema.ts` 定义数据库表，`api-schemas.ts` 定义请求和响应。共享类型和纯规则放在 `core_engine`，模块通过明确的服务接口协作。

`modules/agent-runtime.ts` 将面试 Agent 与报告模型分析组合，并分别注入业务服务。面试 Agent 位于 `modules/interviews/agent/`：`planner/` 组织面试目标与推进计划，`runtime/` 包含模型执行与提示词组装，`tools/` 为知识适配，`memory/` 管理面试记忆，`guardrails/` 维护提问及预览约束。报告 Agent 位于 `modules/reports/agent/`，分为逐题分析、总结、建议、合同和校验。供面试、准备和报告复用的有界工作流位于 `foundation/agent/graph.ts`；业务状态和数据提交仍由各业务服务负责。

## 开发与验证入口

在仓库根目录安装依赖和运行脚本。`npm run check` 包含依赖边界、类型、内容、普通测试与文档检查；`npm run build:backend` 和 `npm run build` 分别构建后端及前端。数据库、进程、语音和真实模型验证的前置条件见[测试说明](../../tests/README.md)。

历史计划和复盘放在 [retrospection](../retrospection/README.md)，例如[报告实施计划](../retrospection/report-implementation-plan.md)保留当时的设计背景，不代替[报告模块说明](../../code/backend/src/modules/reports/README.md)。本地 `.env`、私有数据、`node_modules`、`.next` 和 `dist` 为配置、数据或生成物，不属于需手工整理的源码。
