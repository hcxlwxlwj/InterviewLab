# 项目看板与 Issue 管理

版本：v0.2 · 更新日期：2026-10-15。本文维护当前工作方式；下方远端配置描述是 2026-10-05 的核验记录，本轮未重新核验权限或任务状态。历史证据见[第一周提交清单](../retrospection/week1_submission.md)。

## 入口与配置的历史核验记录（2026-10-05）

- [第一周里程碑](https://github.com/hcxlwxlwj/InterviewLab/milestone/1)：任务 #2～#7 已创建，成员和截止日期待确认。
- [全部任务](https://github.com/hcxlwxlwj/InterviewLab/issues?q=is%3Aissue+label%3Aweek1)、[缺陷列表](https://github.com/hcxlwxlwj/InterviewLab/issues?q=is%3Aissue+label%3Abug)、[课程反馈 #7](https://github.com/hcxlwxlwj/InterviewLab/issues/7)。这些 Issues 页面可用于当前跟踪，不能代替课程要求的 Projects 视图。
- [InterviewLab Project](https://github.com/users/hcxlwxlwj/projects/2) 已设为私有并关联本仓库，任务 #2～#7 已加入。用户完成 Projects 授权后已核验布局、字段、筛选和状态，证据见[任务 #4](https://github.com/hcxlwxlwj/InterviewLab/issues/4)。

三个视图共用同一批 Issues，成员和日期未确认前保持空值。项目私有状态不等同于已给老师或协作者授权，访问核验见[提交任务 #6](https://github.com/hcxlwxlwj/InterviewLab/issues/6)。

## 三个协作入口

GitHub Issues 是任务、缺陷和反馈的记录来源；Projects 展示这些记录的状态与排期。同一 Issue 可出现在多个视图，无需复制成多个任务。可在一个 Project 中建立以下三个视图；若课程要求分别建立三个 Projects，则分别建立并沿用同一套字段。

| 入口 | 展示方式与范围 | 用途 |
| --- | --- | --- |
| [Kanban](https://github.com/users/hcxlwxlwj/projects/2/views/2) | Board，按 Status 分列，包含本项目工作项 | 查看待办、进行中、待检查、完成与阻塞情况 |
| [Team planning](https://github.com/users/hcxlwxlwj/projects/2/views/3) | Table，显示 Assignees、Priority、Target date、Status | 分配负责人，确认依赖与课程截止时间 |
| [Bug tracker](https://github.com/users/hcxlwxlwj/projects/2/views/4) | Table，筛选 `label:bug` | 记录可复现问题、影响、修复与复验结果 |

具体可用字段和视图以实际 GitHub 配置为准。Project 描述应链接仓库；README 和提交清单应链接上述入口。仓库为私有时，还需确认老师与协作者能访问仓库、Issues 和 Projects。

## 工作项字段与状态

| 字段 | 约定 |
| --- | --- |
| Status | `Todo` 待执行；`In Progress` 处理中；`In review` 待检查；`Done` 已验收；`Blocked` 有明确阻塞 |
| Priority | `P0` 本周交付必需或阻止关键流程；`P1` 重要但有替代路径；`P2` 后续改进 |
| Assignees | 一名主要负责人；成员未接受邀请或分工未确认时先保持未指派，并在 Issue 中注明待绑定角色 |
| Target date | 实际约定的截止日期；课程日期未明确前不填写假日期 |
| Labels | `task` 任务、`bug` 缺陷、`feedback` 外部反馈；可按需要增加 `documentation` 等领域标签 |
| 验收条件 | Issue 正文中列出可观察结果和证据位置 |

状态转换：明确需求后进入 Todo；开始处理后进入 In Progress；交付 PR 或验证证据后进入 In review；检查人确认验收条件后进入 Done。受阻时注明原因、需要谁处理及解除条件，再进入 Blocked；收到用户转述的教师反馈时记录来源，不伪造 Issue 评论或提前标为课程已验收。

## 建立与完成一项任务

1. 创建 Issue，说明要解决的问题、范围、交付文件或行为、验收条件和依赖。需求任务引用需求编号，缺陷写明复现步骤、预期与实际结果。
2. 将 Issue 加入 Projects，设置状态和优先级。成员与日期确定后补 Assignees 和 Target date。
3. 按[协作操作须知](COLLABORATION.md)在任务分支修改；PR 链接相关 Issue，写明验证方法与尚未完成的部分。
4. 检查人复核文档、运行结果或其他证据；通过后合并并关闭已完成的 Issue，将状态改为 Done。
5. 老师反馈使用 `feedback` 标签；按[反馈记录](../retrospection/teacher_feedback.md)保存实际来源与链接并拆分后续任务。若仅从聊天收到转述，明确注明且不声称已同步到 GitHub。缺陷只有复验通过才关闭。

本周任务编号与验收条件见[团队计划](team_plan.md)。Project 中的任务状态作为日常跟踪依据，提交时再根据真实证据更新提交清单。

当前文档按 v0.2 维护，沟通与决策见[沟通管理计划](communication_mgmt_plan.md)，风险触发与措施见[风险管理计划](risk_mgmt_plan.md)。
