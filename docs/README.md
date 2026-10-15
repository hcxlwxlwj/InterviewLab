# InterviewLab 文档导航

版本：v0.2 · 日期：2026-10-15 · 状态：当前需求与设计基线，尚未实现。

目标是帮助实习经历有限、主要拥有项目、比赛、科研或毕设经历的高校学生，完成实时口头模拟面试、面后分析和针对性重练。围绕学生项目开展即时追问，将回答证据、语音节奏与可选镜头表现关联到具体片段；文字作为明确标注的降级路径。取消教学模式及 3D 必需交付；历史资料中的旧要求只描述当时状态。

## 课程结构与推荐阅读顺序

按[课程成果结构](https://github.com/bettermorn/IntelligentSWEPractice#课程成果)把当前正文归入五类目录。先读问题定义与需求，再读页面、架构和接口，最后读 Agent、评测及过程记录。

| 顺序 | 入口 | 内容 |
| --- | --- | --- |
| 1 | [需求目录](requirements/README.md) | 教师六行产品描述、5W1H、功能、非功能、用户故事和验收 |
| 2 | [原型说明](software/prototype/README.md) | 六界面单元、设备配置、实时双栏会话、片段复盘与个人中心 |
| 3 | [软件设计](software/README.md) | 架构、数据接口、模块和异常处理 |
| 4 | [算法资料](algorithm/README.md) | 知识、Agent、竞品证据与评测 |
| 5 | [项目管理](mgmt/README.md) | 分工、沟通、风险、反馈及历史提交 |
| 6 | [复盘记录](retrospection/README.md) | 初始化记录和本次范围修订 |

## 当前功能技术文档

| 功能 | 当前正文 |
| --- | --- |
| 岗位与 JD | [01 岗位理解](software/modules/01-job-understanding.md) |
| 多简历与确认经历 | [02 个人材料](software/modules/02-personal-materials.md) |
| 配置及重点经历 | [03 面试配置](software/modules/03-interview-configuration.md) |
| 实时模拟与动态追问 | [05 模拟面试](software/modules/05-mock-interview.md) |
| 语音、镜头与表达观测 | [06 语音与镜头表现](software/modules/06-voice-and-speech.md) |
| 结束后分析与 PDF | [07 分析报告](software/modules/07-feedback-report.md) |
| 同题重练及对比 | [08 重练与进展](software/modules/08-retry-and-progress.md) |
| 内容与运维 | [09 内容与运行维护](software/modules/09-content-and-operations.md) |
| 可选代码考核 | [10 代码考核](software/modules/10-code-assessment.md) |
| 记录、简历与偏好 | [11 个人中心](software/modules/11-personal-center.md) |

原 04 教学模块已退出当前范围，仅保留[取消说明](modules/04-guided-practice.md)。旧模块编号保留追溯，不按数字重排已有需求编号。

## 共用定义与维护

- [功能需求](requirements/functional_spec.md)维护 FR 编号、优先级和功能边界；[非功能需求](requirements/nonfunctional_spec.md)维护 NFR。
- 状态、字段、接口、删除和评分汇总口径以[数据与接口](software/data_and_interfaces.md)为准；Agent 权限以[知识与 Agent](algorithm/knowledge_and_agent.md)为准。
- [调研](algorithm/research.md)区分官方功能、用户自述、机会假设，不把公开评价当真实访谈或代表性统计。
- [评测](algorithm/evaluation.md)定义合成案例、同材料对照和阶段门槛；模型自评分不证明招聘或学习成效。
- 当前设计版本统一为 v0.2 / 2026-10-15。过程文档保留历史日期与证据，追加变更，不倒写已发生记录。
- 旧 docs 根文档和 docs/modules 路径是兼容导航；不在两处维护相同正文。改动时检查文件链接、重要章节链接和跨文档合同一致性。
