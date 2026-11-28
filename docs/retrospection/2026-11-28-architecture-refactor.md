# 2026-11-28 项目架构整理复盘

## 背景与目标

针对项目目录难以理解、面试与报告 Agent 职责不清的问题，结合课程仓库模板及用户测试表，整理现有代码和文档。目标是让业务边界、Agent 的主要组成和验证入口更容易查找，同时保留现有业务行为与历史数据兼容。

本记录描述本地工作区的调整与验证，不代表代码已提交、推送或部署。课程用户测试表中的 A1–A11 是后续验收依据，本次目录整理不等于通过这些用户测试。

## 主要调整

1. **面试 Agent 组织**：将面试规划、知识适配、记忆、护栏和运行代码归入 `code/backend/src/modules/interviews/agent/`。从流式执行文件中分离规划、提示词组装和预览校验；共享有界工作流放入 `foundation/agent/graph.ts`。现有模块仍按实际实现维护，目录名称不代表已实现自主工具调用或跨会话长期记忆。
2. **报告 Agent 组织**：将逐题分析、总结、练习建议、模型输出合同及证据校验归入 `reports/agent/`。确定性评分汇总、业务服务和持久化保留在报告业务模块中。
3. **Agent 装配**：面试 Agent 负责面试推进，报告模型分析负责报告和重练比较；`modules/agent-runtime.ts` 负责组合，再由业务运行时注入服务。报告服务声明自身需要的能力，减少对面试 Agent 内部类型的直接依赖。
4. **数据库与接口命名**：面试、报告、简历和岗位等模块将数据库表定义命名为 `db-schema.ts`；存在独立接口结构的模块使用 `api-schemas.ts`。同步修改 Drizzle 配置、调用方和测试引用。
5. **代码与文档整理**：删除确认无调用的旧结构定义、常量以及已有内容目录中的 `.gitkeep`。报告历史实施计划归档至 [retrospection](report-implementation-plan.md)，删除原位置的跳转页；更新[工程目录](../software/repository_structure.md)、[Agent 架构](../software/interview-agent-implementation.md)和[项目文件树](../software/project-file-tree.md)。仓库检查脚本识别未暂存的文件删除，并检查课程模板列出的质量、评审、部署和用户测试文件。
6. **课程模板对照**：保留 `docs/requirements`、`algorithm`、`software`、`mgmt`、`retrospection`，以及 `code/backend`、`frontend`、`core_engine` 和 `tests` 的课程结构。用户测试入口为 [InterviewLab 交叉用户测试](../../tests/interviewlab_demo_user_test.md)。

## 验证结果

| 检查 | 本次结果 | 范围说明 |
| --- | --- | --- |
| `npm run check` | 通过；普通测试 351 项通过 | 包括依赖边界、类型、内容、普通单元/集成及文档检查；不包含独立数据库或真实模型测试 |
| `npm run build:backend` | 通过 | 后端 API 与 worker 构建成功 |
| 前端生产构建 | webpack 方式通过 | 默认 Turbopack 构建在当前环境因绑定端口权限失败；清理过期生成类型后以 webpack 构建通过 |
| `npm run docs:check`、`git diff --check` | 通过 | 核对课程必需文件、本地文档链接和差异格式 |

这些结果分别产生于本轮相关改动之后；后续修改应重新运行受影响的检查。

## 限制与后续工作

- 独立 `interviewlab_test*` 数据库集成、进程测试和真实模型调用本轮未执行；已有普通测试和构建不能替代它们。
- 交叉用户测试仍为待执行。需要按课程表记录产品价值、界面、视觉、通用可用性和 A1–A11 的实测结果、证据与复验，不应代填通过结论。
- 真实语音/视频设备效果、完整专业知识覆盖和评分校准仍以[评测记录](../algorithm/evaluation.md)中的状态为准。
- 面试流式执行及部分业务服务仍较大，后续应依据实际职责和调用关系逐步拆分；前端面试、报告和历史功能的目录聚合也仍可评估。
- 项目文件树为生成时点的清单，文件增删后需要更新；日常导航优先使用[工程目录](../software/repository_structure.md)。
