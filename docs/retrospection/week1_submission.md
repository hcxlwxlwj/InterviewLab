# 第一周提交与验收清单

> 历史记录说明（v0.2，2026-10-15 追加）：下方正文保留 2026-10-05 的第一周提交准备与核验事实，包括原检查数量、未完成项及提交模板，不代表今天的远端状态。用户现已在聊天中转述教师反馈，本轮处理见文末及[反馈记录](teacher_feedback.md)；没有据此确认 Issue #7 已回复或课程已验收。

更新日期：2026-10-05。检查依据为老师的“第 1 周实践：定义你的工程项目与仓库构建”任务图。下表区分本次准备的交付与仍需验证的远端、人工操作；只有链接和实际记录齐全才能标为完成。

## 老师要求与证据

| 要求 | 交付 / 检查位置 | 当前记录 |
| --- | --- | --- |
| 在 GitHub / Gitee 建立项目仓库 | [InterviewLab 仓库](https://github.com/hcxlwxlwj/InterviewLab) | GitHub 仓库已建立；当前为私有仓库，提交前核验老师访问权限 |
| 提交规范的 README | [README](../../README.md) | 已通过 [PR #8](https://github.com/hcxlwxlwj/InterviewLab/pull/8) 合并到 `main`，包含第一周导航 |
| 5W1H 报告和产品描述 | [问题定义报告](../requirements/problem_definition.md) | 指定文件已进入 `main`，六项内容与产品边界已核验 |
| 规范目录结构 | [文档导航](../README.md)、`code/`、`tests/`、`.github/workflows/` | 本次建立课件目录骨架；占位目录不代表功能或测试已实现 |
| 分支管理示例 | 远端 `main`、`develop`；[协作说明](../mgmt/COLLABORATION.md) | 两个远端分支已存在，已通过 `git ls-remote` 核验；团队使用约定见协作说明 |
| Kanban | [Kanban 视图](https://github.com/users/hcxlwxlwj/projects/2/views/2)、[任务 #4](https://github.com/hcxlwxlwj/InterviewLab/issues/4) | Board 已按 Status 分列；本周任务 #2～#7 已加入 |
| Team planning | [团队计划视图](https://github.com/users/hcxlwxlwj/projects/2/views/3)、[团队计划](../mgmt/team_plan.md) | 已配置状态、优先级、负责人和日期字段；成员绑定及课程截止日期待定 |
| Bug tracker | [缺陷视图](https://github.com/users/hcxlwxlwj/projects/2/views/4) | 已配置 `label:bug` 筛选及缺陷表单；当前未登记真实缺陷 |
| 第一周结束前提交仓库链接 | 课程指定渠道的提交记录 | 待实际提交；课程截止日期尚未提供 |
| 通过 GitHub Issues 获得第一轮反馈 | [第一轮反馈入口 #7](https://github.com/hcxlwxlwj/InterviewLab/issues/7)、[反馈记录](teacher_feedback.md) | 反馈 Issue 已创建，等待老师实际回复；尚未获得反馈 |

协作者邀请已发出，协作者尚未接受（用户确认）。接受后绑定各任务负责人，确认仓库与 Projects 权限。私有仓库链接本身不授予老师访问权限。

GitHub 已建立[第一周里程碑](https://github.com/hcxlwxlwj/InterviewLab/milestone/1)，包含任务 #2～#7；没有未经确认的负责人或截止日期。初始 Projects 权限阻塞已由用户完成授权后解除；私有 Project、三个视图、状态选项、优先级、日期字段和任务关联均已核验，证据记录在 #4。

仓库文件已通过 PR #8 交付，问题定义任务 #2、工程配置任务 #3 已关闭。`main` 和 `develop` 的结构与文档[自动检查通过](https://github.com/hcxlwxlwj/InterviewLab/actions/runs/37270730469)，本地检查覆盖 28 份 Markdown 与 170 个文件链接；尚未实现应用功能，不以该检查代替应用测试。

## 提交前检查

- [x] 第一周文档、目录和工作流已合并到远端 `main`，README 文件链接检查通过。
- [x] `problem_definition.md` 的 What、Why、Who、When、Where、How 与产品描述、首版范围一致，已完成独立内容检查。
- [x] 远端 `develop` 可见，分支与 PR 流程已记录。
- [ ] 协作者接受邀请后阅读并确认团队协作约定。
- [x] 三个协作入口的真实链接已补齐，本周任务已纳入看板。
- [ ] 协作者接受邀请；分工和课程截止日期确认后补入看板。
- [ ] 老师拥有访问仓库、Projects 和 Issues 的权限。
- [x] 第一轮反馈 Issue 已建立，明确希望老师评价的问题。
- [ ] 在课程指定渠道提交仓库链接，并保留提交日期与凭据。
- [ ] 老师回复后更新[反馈记录](teacher_feedback.md)，必要时建立修订任务。

勾选应以实际证据为依据；尚未发生的提交、权限授予和反馈保持未完成。

## 可复制的提交文本

> 老师您好，我们小组的第一周项目是 InterviewLab（面试练习室），面向应届生提供自主 AI 面试练习与证据反馈。仓库链接：https://github.com/hcxlwxlwj/InterviewLab 。第一周问题定义与 5W1H 报告位于 `docs/requirements/problem_definition.md`，README 提供文档和协作入口导航。第一轮反馈入口：https://github.com/hcxlwxlwj/InterviewLab/issues/7 ，请帮助我们确认问题定义、首版范围与验证方法是否合适。

发送前先完成访问权限和看板配置检查。若远端交付尚未合并，应先合并再使用上述文本；本页不代表已经通过课程渠道提交。

| 提交信息 | 实际记录 |
| --- | --- |
| 课程第一周截止日期 | 待确认 |
| 提交渠道 | 待按老师指定渠道填写 |
| 实际提交日期 / 凭据 | 待实际提交后填写 |
| 反馈 Issue / 首次回复日期 | Issue #7 已建立；首次回复日期待实际发生后填写 |

## 2026-10-15 追加：当前文档修订

用户转述教师要求参考课程成果结构并填写六行产品描述，同时授权将当前定位收紧为实习经历有限、主要拥有项目/竞赛/科研/毕设经历的高校学生。当前产出文档已按 v0.2 更新；本文上方第一周记录保持原样，旧版产出可从 Git 历史查阅。

本轮范围是文档、导航和仓库文档检查配置，不搭建前端。教师反馈来自用户转述，不能将原“等待 Issue 回复”记录改成已在 GitHub 获得反馈，也不凭本地文件修改声称已合并或提交课程渠道。

当前入口：[六行产品描述](../requirements/problem_definition.md)、[功能需求](../requirements/functional_spec.md)、[非功能需求](../requirements/nonfunctional_spec.md)、[用户故事](../requirements/user_stories.md)、[原型说明](../software/prototype/README.md)、[本轮复盘](2026-10-15-scope-revision.md)。本轮本地检查结果在实际完成后追加，不替换上方 28 份 / 170 链接的历史数字。

本轮本地验证（2026-10-15）：仓库检查通过，覆盖 50 份 Markdown 和 267 个本地文件链接；额外核对 72 个表格及全部 Markdown 尾随空白，均通过；当前本地链接无章节片段，重点章节及需求/接口合同另经内容交叉审阅。git diff --check 通过。应用目录和依赖无变更；未执行应用或效果实验，未推送、合并或在课程渠道提交。
