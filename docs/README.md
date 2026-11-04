# InterviewLab 文档导航

更新：2026-11-05。沿用老师要求的五类目录，以远端 main（1b6f9e4）的原文、章节和表格为基准，只更新本次实现涉及的部分。“聚焦一个主题”按架构、接口、方法、评测等可独立维护的职责划分，不为每个节点或子功能新增文件。

| 类别 | 主要文档 | 内容边界 |
| --- | --- | --- |
| requirements | [问题定义](requirements/problem_definition.md)、[功能需求](requirements/functional_spec.md)、[非功能需求](requirements/nonfunctional_spec.md)、[用户故事](requirements/user_stories.md) | 保留需求编号、角色、验收条件和未实现目标 |
| algorithm | [技术与竞品调研](algorithm/research.md)、[知识与 Agent 方法](algorithm/knowledge_and_agent.md)、[评测与成本](algorithm/evaluation.md) | 选型依据；来源/检索/简历证据/评价方法；样本、实验和人工验收分别维护 |
| software | [系统架构](software/architecture.md)、[数据与接口](software/data_and_interfaces.md) | 六层总图、模块与部署边界；业务/知识 ER、字段、事务及外部接口 |
| software | [Agent 接入与工作流](software/interview-agent-implementation.md)、[动态面试与流式执行](software/interview-agent-v3.md) | 简历/准备/单轮图与模型分工；运行中的提问、记忆、SSE、取消和经历边界 |
| software | [材料管理](software/personal-materials-implementation.md)、[语音与视频](software/voice-interview.md)、[账号](software/account-management.md) | 本人材料生命周期；同一媒体链路与本机视频呈现；认证访问合同 |
| software | [运行指南](software/development.md)、[工程目录](software/repository_structure.md)、[原型](software/prototype/README.md) | 运行命令唯一入口、源码职责和界面证据 |
| mgmt | [团队计划](mgmt/team_plan.md)、[项目与变更管理](mgmt/project_management.md)、[风险](mgmt/risk_mgmt_plan.md)、[沟通](mgmt/communication_mgmt_plan.md) | 保留原协作安排，实际负责人/期限由团队确认 |
| retrospection | [历史记录](retrospection/README.md) | 按迭代保留试跑、失败、修复及检查结果，不再复制每份设计文档的完整旧稿 |

建议阅读顺序：需求 → 系统架构 → Agent 接入/动态执行 → 数据与接口 → 算法与评测 → 运行。报告评分方法在知识与 Agent 第 6 节，具体报告接口在数据与接口，模块实现说明在[报告 README](../code/backend/src/modules/reports/README.md)。

## 需求到证据

| 需求 | 设计与合同 | 验证位置 |
| --- | --- | --- |
| FR-02.1/02.2 材料与简历分析 | 材料管理；知识与 Agent 第 3 节；数据与接口 | agent-workflow 单元/数据库测试及评测原文引用审查 |
| FR-03.1 面前准备 | Agent 接入中的准备图、状态与取消；数据与接口 prepare | 三模式准备、等待恢复、版本、失败简化、删除竞态 |
| FR-05.1/05.2 动态面试 | 动态面试中的记忆、事实边界与流式合同 | 多轮合成案例、真实模型记录和人工相关性审查 |
| FR-05.3 续答取消 | 语音与视频；Agent 工作流；generation/revision | voice、realtime 和数据库迟到结果回归 |
| FR-11.1/11.2 全岗位知识 | 知识与 Agent 第 1–2 节；数据与接口知识 ER | 1000/8000 映射、受控全量导入、召回负例及覆盖审查 |

当前只保留 graph-v1 执行链；旧记录只读兼容。框架接入和代码清退不等于专业覆盖、真实模型和麦克风效果已全部验收，完成声明以[评测](algorithm/evaluation.md)及[清退记录](retrospection/2026-11-05-runtime-cleanup.md)为准。
