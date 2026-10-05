# 项目看板与 Issue 管理

更新日期：2026-10-05。本文规定团队的工作方式，远端项目是否建成与具体链接见[第一周提交清单](week1_submission.md)。

## 当前入口与配置状态

- [第一周里程碑](https://github.com/hcxlwxlwj/InterviewLab/milestone/1)：任务 #2～#7 已创建，成员和截止日期待确认。
- [全部任务](https://github.com/hcxlwxlwj/InterviewLab/issues?q=is%3Aissue+label%3Aweek1)、[缺陷列表](https://github.com/hcxlwxlwj/InterviewLab/issues?q=is%3Aissue+label%3Abug)、[课程反馈 #7](https://github.com/hcxlwxlwj/InterviewLab/issues/7)。这些 Issues 页面可用于当前跟踪，不能代替课程要求的 Projects 视图。
- Projects 尚未配置或核验。现有凭据查询返回 `INSUFFICIENT_SCOPES`，需用户完成 `project` 授权或在已登录网页中设置；阻塞与验收条件记录在[任务 #4](https://github.com/hcxlwxlwj/InterviewLab/issues/4)。

授权后创建或复用私有 InterviewLab Project，关联本仓库，加入任务 #2～#7；再按下表建立三个视图并补真实链接。不要公开仓库或项目来绕过权限问题。

## 三个协作入口

GitHub Issues 是任务、缺陷和反馈的记录来源；Projects 展示这些记录的状态与排期。同一 Issue 可出现在多个视图，无需复制成多个任务。可在一个 Project 中建立以下三个视图；若课程要求分别建立三个 Projects，则分别建立并沿用同一套字段。

| 入口 | 展示方式与范围 | 用途 |
| --- | --- | --- |
| Kanban | 看板，按 Status 分组，包含本项目工作项 | 查看待办、进行中、待检查、完成与阻塞情况 |
| Team planning | 表格，显示 Assignees、Priority、Target date、Status | 分配负责人，确认依赖与课程截止时间 |
| Bug tracker | 表格或看板，筛选带 `bug` 标签的 Issues | 记录可复现问题、影响、修复与复验结果 |

具体可用字段和视图以实际 GitHub 配置为准。Project 描述应链接仓库；README 和提交清单应链接上述入口。仓库为私有时，还需确认老师与协作者能访问仓库、Issues 和 Projects。

## 工作项字段与状态

| 字段 | 约定 |
| --- | --- |
| Status | `Backlog` 待拆分；`Todo` 已明确待执行；`In progress` 处理中；`In review` 待检查；`Done` 已验收；`Blocked` 有明确阻塞 |
| Priority | `P0` 本周交付必需或阻止关键流程；`P1` 重要但有替代路径；`P2` 后续改进 |
| Assignees | 一名主要负责人；成员未接受邀请或分工未确认时先保持未指派，并在 Issue 中注明待绑定角色 |
| Target date | 实际约定的截止日期；课程日期未明确前不填写假日期 |
| Labels | `task` 任务、`bug` 缺陷、`feedback` 外部反馈；可按需要增加 `documentation` 等领域标签 |
| 验收条件 | Issue 正文中列出可观察结果和证据位置 |

状态转换：明确需求后从 Backlog 进入 Todo；开始处理后进入 In progress；交付 PR 或验证证据后进入 In review；检查人确认验收条件后进入 Done。受阻时注明原因、需要谁处理及解除条件，再进入 Blocked；未收到老师反馈的反馈任务不能提前标为已获得反馈。

## 建立与完成一项任务

1. 创建 Issue，说明要解决的问题、范围、交付文件或行为、验收条件和依赖。需求任务引用需求编号，缺陷写明复现步骤、预期与实际结果。
2. 将 Issue 加入 Projects，设置状态和优先级。成员与日期确定后补 Assignees 和 Target date。
3. 按[协作操作须知](../../COLLABORATION.md)在任务分支修改；PR 链接相关 Issue，写明验证方法与尚未完成的部分。
4. 检查人复核文档、运行结果或其他证据；通过后合并并关闭已完成的 Issue，将状态改为 Done。
5. 老师反馈使用 `feedback` 标签；按[反馈记录](feedback.md)保存链接并拆分后续任务。缺陷只有复验通过才关闭。

本周任务编号与验收条件见[团队计划](team_plan.md)。Project 中的任务状态作为日常跟踪依据，提交时再根据真实证据更新提交清单。
