# 2026-10-19：文档归入课程五类目录

用户要求严格按课程文档结构整理，并将原模块说明放回需求。本轮取消 `docs/modules`、`docs/software/modules` 和五份 docs 根目录兼容导航。

## 内容归属

| 原说明 | 当前正文 |
| --- | --- |
| 岗位、材料、配置、面试、报告、重练、维护、代码、个人中心的业务行为 | [功能规格](../requirements/functional_spec.md)第 9 节 |
| 各功能的合成例及验收检查 | [用户故事](../requirements/user_stories.md) AC-01 至 AC-10 |
| 文件解析安全、执行隔离、运行及删除约束 | [非功能规格](../requirements/nonfunctional_spec.md)第 5 节 |
| 声学指标定义与参数 | [知识与 Agent](../algorithm/knowledge_and_agent.md#speech-metrics) |
| 领域对象、状态、HTTP/WS 接口及维护权限 | [数据与接口](../software/data_and_interfaces.md) |
| 教学模式取消及 3D 退出首版 | [功能边界](../requirements/functional_spec.md#feature-scope-exclusions) |
| 教师反馈及第一周交付证据 | [教师反馈](teacher_feedback.md)、[第一周提交](week1_submission.md) |

FR 和 US 编号保留，新增岗位库、多简历、个人 JD、恢复与存储失败的 US-14 至 US-17；修正当前个人中心五分区与旧三分区表述。原型/真实服务能力仍分开描述，未将设计验收预填为通过。

历史过程正文不倒写；只更新失效链接。原模块全文可从[整理前版本](https://github.com/hcxlwxlwj/InterviewLab/tree/b700cf8/docs/software/modules)追溯，不另建一份档案目录复制旧设计。

文档检查通过：43 份仓库 Markdown、304 条本地链接与功能锚点。负向验证确认旧模块目录和不存在的功能锚点会被拒绝，临时探针已清除。公开内容检查仍为 36 个模板、288 道问题、72 条来源，`git diff --check` 通过。此次不改变应用代码、公共 JSON 数据或用户演示状态。
