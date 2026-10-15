# InterviewLab · 面试练习室

版本：v0.2 · 更新日期：2026-10-15。

InterviewLab 是面向高校学生的实时 AI 模拟面试与复盘 Web 应用，首版优先服务实习经历有限、主要凭课程项目、竞赛、科研或毕设经历准备技术岗位实习及校招的学生。通过即时口头回答、项目连续追问、语音与可选镜头表现复盘，帮助学生练习临场组织内容，讲清个人贡献、技术决策和有事实依据的岗位相关优势。

> 当前处于方案验证与开发准备阶段，尚无可运行应用或线上体验。本轮已修订文档，不搭建前端；文档中的功能、接口、指标和技术选型均为待实现或待验证设计。

## 产品描述与主流程

完整的教师六行模板和 5W1H 见[问题定义与产品描述](docs/requirements/problem_definition.md)。这里的目标用户是一类具体学生，不把实习经历有限泛化为全体高校学生。

首页选择岗位与面试类型 → 配置 JD、时长、简历、重点经历及设备 → 实时口头模拟面试 → 结束后分析 → 针对一个问题或表达片段重练与比较。个人中心统一管理面试记录、多份简历和偏好。

首版目标以实时语音为主要交互：AI 语音提问，学生直接回答，系统判断回合结束后自动保存并自然接话，无需编辑转写稿后点击发送。允许合理思考、口头纠正、请求澄清及打断 AI；误截回答可恢复追加，主动打断学生只作为可选面试官风格。麦克风或语音服务不可用时，文字降级路径仍可独立完成，记录实际作答方式。

结束后集中提供四维评分、回答证据、优势与不足，以及语速、停顿、疑似口头语、音量和音高变化等表达观测。摄像头默认关闭，学生可选开启镜头表现反馈；只描述画面质量、头部朝向和面部动作，不据此判断情绪、诚实、人格或专业能力。语音与视觉观测独立于专业总分。没有教学前置课程，代码考核可选，3D 不是必需交付。

## 学生项目场景的设计重点

- 从本人职责、实现细节、方案取舍、测试或实验、团队协作等角度追问课程项目、比赛和科研经历。
- 区分团队成果与个人行动；没有商业收益、上线规模或增长数据，不作为扣分理由。
- 每项优势与改进建议关联已封存回答或已确认材料；对材料的确认仅表示学生认可记录，不代表外部真实性认证。
- 重练保留两次回答及比较依据，不以字数增加或模型分数上涨直接证明能力提升。
- 将具体追问、回答原句与表达时间片段关联，区分内容缺口与表达节奏；原始口头作答不被润色后的文字替换。
- 面后识别纠错保留原转写、原因与版本；文字降级、设备质量或作答条件变化在重练对比中说明。

产品价值通过项目追问相关性、反馈依据、实时交互体验及重练后的回答变化检验。研究依据与对照安排见[竞品与技术调研](docs/algorithm/research.md)和[评测方案](docs/algorithm/evaluation.md)。

## 当前文档入口

| 类别 | 正文入口 |
| --- | --- |
| 需求 | [问题定义](docs/requirements/problem_definition.md)、[功能需求](docs/requirements/functional_spec.md)、[非功能需求](docs/requirements/nonfunctional_spec.md)、[用户故事](docs/requirements/user_stories.md) |
| 算法 | [知识与 Agent](docs/algorithm/knowledge_and_agent.md)、[竞品与技术调研](docs/algorithm/research.md)、[评测方案](docs/algorithm/evaluation.md) |
| 软件 | [架构](docs/software/architecture.md)、[数据与接口](docs/software/data_and_interfaces.md)、[六界面与交互原型说明](docs/software/prototype/README.md)、[模块导航](docs/software/README.md) |
| 管理 | [团队计划](docs/mgmt/team_plan.md)、[沟通计划](docs/mgmt/communication_mgmt_plan.md)、[风险计划](docs/mgmt/risk_mgmt_plan.md)、[教师反馈](docs/mgmt/feedback.md) |
| 复盘 | [历次记录](docs/retrospection/README.md) |

总入口见[文档导航](docs/README.md)。旧版根文档与模块路径保留迁移入口，当前正文仅在课程五类目录维护。

## 开发阶段与验证

| 阶段 | 计划目标 |
| --- | --- |
| 当前文档修订 | 对齐定位、需求、页面、数据、接口和验收；不生成应用代码 |
| A 基础闭环与文本联调 | 先用明确标注的 Mock 数据验证原型，再接入身份、材料、模拟、报告、重练与记录；文本联调是实现过渡，不代替实时口头面试的产品验收 |
| B 实时语音与基础多模态 | 中文识别、自动接话、播报与打断、误截恢复、文字降级；语音节奏及可选镜头表现观测、片段定位与媒体有效期处理 |
| C 评测与小规模试用 | 验证项目追问、反馈依据、接话延迟与误截、观测质量、恢复、费用及重练表现；作答条件分开记录 |

代码运行实际接入必须满足隔离、限额和任务状态验收；演示结果不能冒充真实执行。人员、日期、服务商和预算待团队确认，按[评测方案](docs/algorithm/evaluation.md)的门槛推进。

## 工程目录与本地检查

课程按 docs/requirements、algorithm、software、mgmt、retrospection 组织文档；code/backend、frontend、core_engine 和 tests/unit、integration 仍为空目录骨架。没有应用依赖清单或启动命令，不代表前后端服务已经实现。

当前可以运行的检查为：

    python .github/scripts/check_repository.py
    git diff --check

检查只验证仓库结构与文档，不代替应用、AI 或语音测试。

## 协作与历史课程交付

日常以 develop 为集成基线，通过任务分支和 PR 交付；操作见[协作须知](COLLABORATION.md)。阶段验收后，再通过 develop 到 main 的 PR 交付课程版本。

[第一周提交记录](docs/mgmt/week1_submission.md)保留此前 PR、看板和检查证据；2026-10-15 教师要求由用户在聊天中转述，记录于[反馈文档](docs/mgmt/feedback.md)，不等同于 Issue #7 已回复。

现有协作入口：[Kanban](https://github.com/users/hcxlwxlwj/projects/2/views/2)、[Team planning](https://github.com/users/hcxlwxlwj/projects/2/views/3)、[Bug tracker](https://github.com/users/hcxlwxlwj/projects/2/views/4)、[Issues](https://github.com/hcxlwxlwj/InterviewLab/issues)。链接沿用历史记录，当前权限及任务状态需在使用时核验。

## 数据与素材

库内简历私有保存至用户主动删除，临时上传默认不入库且最长保留 24 小时。原始音视频默认仅临时处理后清除；学生明确开启复盘媒体保存时，仅保存此后采集的片段，每段自采集起私有保留最长 24 小时，可提前删除，重连或重试不重置期限。媒体到期后仍可保留必要的派生观测与时间定位，但不能回放或假装重新计算。回答、会话快照及观测分别版本化，文件和经历删除的关联影响在入口说明。

密钥保留在服务端，真实简历、录音和个人记录不进入 Git；仓库示例均为合成或明确获授权材料。技术资料与素材记录使用依据，许可证和未来公开范围待团队确认。
