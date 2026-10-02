# InterviewLab 协作操作须知

## 第一次加入

接受仓库邀请后，在准备存放项目的父目录执行：

```bash
git clone https://github.com/hcxlwxlwj/InterviewLab.git
cd InterviewLab
```

若已有空的项目文件夹，进入它后执行 `git clone https://github.com/hcxlwxlwj/InterviewLab.git .`。克隆完成后会自动建立远程连接，无需再次运行 `git init` 或 `git remote add`。

## 日常开发

本地改动先提交或暂存，再切换分支。开始新任务时：

```bash
git switch main
git pull --ff-only
git switch -c feature/your-task
```

完成修改后先检查，再提交并上传：

```bash
git status
git diff
git add <需要提交的文件或目录>
git commit -m "简要说明修改内容"
git push -u origin feature/your-task
```

将 `your-task` 替换为实际任务名。功能分支使用 `feature/`，修复分支使用 `fix/`。在 GitHub 发起 Pull Request，写明改动目的与验证方式，由另一位成员检查后合并到 `main`。这是团队协作约定，是否由 GitHub 强制执行取决于仓库规则配置。

## 提交约定

- 一次提交尽量围绕一项任务，说明具体改动。
- 提交前检查 `.gitignore`；不上传密钥、真实用户数据、依赖目录或构建产物。
- 问题与需求记录在 Issues 中，注明预期结果与验收条件。
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

若本地尚未克隆，第一次下载应使用 `git clone`。要单独测试 `pull`，先克隆，再在 GitHub 网页修改 README 并提交，然后回到本地执行上述拉取命令。

若出现 `Already up to date`，表示当前分支已同步。若提示 `not a git repository`，请先进入已克隆的项目目录；若 `--ff-only` 报错，说明分支不能直接快进，先检查本地提交与远程变化。
