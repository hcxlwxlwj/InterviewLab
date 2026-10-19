# InterviewLab 文档导航

更新：2026-10-19。按课程要求分为需求、算法、软件、管理与复盘五类；功能说明统一纳入需求，不再单独维护 modules 目录或旧根文档导航。

## 阅读顺序

| 类别 | 正文 | 职责 |
| --- | --- | --- |
| requirements | [问题定义](requirements/problem_definition.md) | 背景、痛点、5W1H、目标与边界 |
| requirements | [功能规格](requirements/functional_spec.md) | FR 编号、页面、详细功能与异常行为 |
| requirements | [非功能规格](requirements/nonfunctional_spec.md) | 性能、权限、隐私、隔离、恢复、预算和可访问性 |
| requirements | [用户故事与验收](requirements/user_stories.md) | US 场景、AC 检查和扩展验收 |
| algorithm | [技术调研](algorithm/research.md) | 候选方案、竞品、资料与选型依据 |
| algorithm | [知识与 Agent](algorithm/knowledge_and_agent.md)、[评测](algorithm/evaluation.md)、[内容资料](algorithm/content/README.md) | 方法、指标口径、检索、版本、来源与验证 |
| software | [架构](software/architecture.md)、[数据与接口](software/data_and_interfaces.md) | 系统结构、数据模型、API、状态与版本 |
| software | [原型](software/prototype/README.md)、[工程目录](software/repository_structure.md) | 页面、交互、代码边界与实现证据 |
| mgmt | [沟通计划](mgmt/communication_mgmt_plan.md)、[风险计划](mgmt/risk_mgmt_plan.md)、[团队计划](mgmt/team_plan.md) | 协作、分工、决策与风险 |
| retrospection | [复盘索引](retrospection/README.md) | 迭代、教师反馈、历史提交与经验 |

## 功能查阅

- [岗位库、收藏与个人 JD](requirements/functional_spec.md#feature-job-targets)
- [简历与确认经历](requirements/functional_spec.md#feature-materials)
- [面试配置](requirements/functional_spec.md#feature-configuration)
- [模拟面试](requirements/functional_spec.md#feature-interview)
- [实时语音与表达观测](requirements/functional_spec.md#feature-speech)
- [报告与导出](requirements/functional_spec.md#feature-report)
- [同题重练](requirements/functional_spec.md#feature-retry)
- [内容与运行维护](requirements/functional_spec.md#feature-content-operations)
- [可选代码考核](requirements/functional_spec.md#feature-code-assessment)
- [个人中心](requirements/functional_spec.md#feature-personal-center)

## 当前实现与维护

当前有可运行的文字交互原型、公开岗位内容和接口骨架；真实身份、数据库、模型、音视频和代码执行待接入。已实现范围和截图以[个人中心/岗位库扩展](software/prototype/library-expansion.md)为准，不能将目标需求当作验收结论。

新版后端设计以[架构](software/architecture.md)的六个业务模块和四阶段为主线，[接口合同](software/data_and_interfaces.md)区分当前骨架与未来独立 API，并列出旧路径迁移；本轮仅修订文档，不改变代码、依赖或运行命令。

需求维护预期行为，软件文档维护实现合同，算法文档维护方法与评测。历史记录保持发生日期；旧路径的迁移对应见[本次复盘](retrospection/2026-10-19-docs-consolidation.md)，旧版本正文可从 Git 历史追溯。启动入口见[根 README](../README.md)。
