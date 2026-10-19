# InterviewLab 协作操作须知

版本：v0.3 · 更新日期：2026-10-19。当前产品与文档范围见[文档导航](../README.md)。

## 分支约定

| 分支 | 用途 | 合并方向 |
| --- | --- | --- |
| `main` | 已验收版本和课程提交基线 | `develop` → `main` |
| `develop` | 日常开发集成 | 任务分支 → `develop` |
| `feature/*`、`fix/*`、`codex/*` | 一项功能、修复或辅助开发任务 | 通过 PR 合并到 `develop` |

第一周初始化从现有 `main` 建立任务分支，先交付到 `develop`，再通过课程交付 PR 合入 `main`。日常开发以 `develop` 为基线，阶段验收后提交到 `main`。上述是团队约定，当前尚未配置强制审批规则。

## 第一次加入

接受仓库邀请后，在准备存放项目的父目录执行：

2026-10-05 的记录为协作者邀请已发出但尚未接受；本轮未重新核验邀请状态。具体分工见 [团队计划](team_plan.md)。

```bash
git clone https://github.com/hcxlwxlwj/InterviewLab.git
cd InterviewLab
git switch develop
```

若已有空的项目文件夹，进入它后执行 `git clone https://github.com/hcxlwxlwj/InterviewLab.git .`。克隆完成后会自动建立远程连接，无需再次运行 `git init` 或 `git remote add`。

## 本地运行与改动位置

原型运行分支与启动方式见[根 README](../../README.md)。当前原型已合入 `main`；需要延续未合并功能时，从对应任务分支建立自己的任务分支，并在 PR 说明基线和依赖。

先读[工程目录与职责](../software/repository_structure.md)，在仓库根目录执行 `npm ci`。代码改动先运行 `npm run check`、`npm run build`；文档改动至少运行 `npm run docs:check` 与 `git diff --check`。修改已实现功能时同步原型状态，修改目标时同步需求与合同；已发生的复盘和反馈只追加。

## 日常开发

本地改动先提交或暂存，再切换分支。开始新任务时：

```bash
git switch develop
git pull --ff-only
git switch -c feature/your-task
```

完成修改后先检查，再提交并上传：

```bash
python .github/scripts/check_repository.py
git diff --check
git status
git diff
git add <需要提交的文件或目录>
git commit -m "简要说明修改内容"
git push -u origin feature/your-task
```

将 `your-task` 替换为实际任务名。功能分支使用 `feature/`，修复分支使用 `fix/`，辅助开发可使用 `codex/`。在 GitHub 发起以 `develop` 为目标的 Pull Request，关联 Issue，写明改动目的与验证方式，由另一位成员检查后合并。阶段验收后再通过 `develop` → `main` 的 PR 交付。是否由 GitHub 强制执行取决于仓库规则配置。

## Issues 与项目看板

使用仓库中的任务、缺陷和课程反馈表单，注明目标、负责人、验收条件和依赖。分工未定时保持未指派。Kanban、Team planning 和 Bug tracker 的配置与工作方式见 [项目管理](project_management.md)。只有验收通过的任务才标记 Done；用户转述的教师意见注明来源，不等同于 Issue 已回复或课程已验收。

## 提交约定

- 一次提交尽量围绕一项任务，说明具体改动。
- 提交前检查 `.gitignore`；不上传密钥、真实用户数据、依赖目录或构建产物。
- 问题与需求记录在 Issues 中，注明预期结果与验收条件。
- 新增文档使用 UTF-8，同步更新目录导航和相对链接；空代码或测试目录用 `.gitkeep` 保留。
- 当前正文按需求、算法、软件、管理和复盘五类目录维护，功能与验收归入 requirements，旧模块及重复导航已移除，历史正文通过 Git 追溯。变更状态、评分或删除约定时同步需求、原型、接口、Agent 和验收，不维护两份合同。
- Actions 的结构与文档链接检查不代替应用测试，占位目录不表示功能已实现。
- 遇到冲突或推送被拒绝，先查看原因并与成员协调，不使用强制推送覆盖他人提交。

## 测试网页上传后的 pull

若本地已克隆仓库，且没有未提交改动：

```bash
git switch main
git pull --ff-only
git status
git log -1 --oneline
```

确认 `README.md` 和 `COLLABORATION.md` 已下载，且工作区干净。网页上的这次提交也会出现在提交记录中。

课程提交前按 [第一周检查清单](../retrospection/week1_submission.md) 核对实际文件、看板、访问权限与反馈状态。

若本地尚未克隆，第一次下载应使用 `git clone`。要单独测试 `pull`，先克隆，再在 GitHub 网页修改 README 并提交，然后回到本地执行上述拉取命令。

若出现 `Already up to date`，表示当前分支已同步。若提示 `not a git repository`，请先进入已克隆的项目目录；若 `--ff-only` 报错，说明分支不能直接快进，先检查本地提交与远程变化。
