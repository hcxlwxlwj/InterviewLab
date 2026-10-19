# InterviewLab · 面试练习室

面向高校学生的模拟面试与复盘 Web 应用。围绕课程项目、竞赛、科研、毕设及实习经历练习岗位问答，讲清个人贡献、方案取舍与验证过程。

**当前阶段：可运行的高保真文字交互原型、公开岗位知识内容与后端接口骨架。** 真实账号、数据库、模型、语音、文件上传、代码执行及 PDF 导出尚未接入。完整产品目标见[问题定义](docs/requirements/problem_definition.md)。

## 本地运行

已使用 Node.js 24、npm 11 验证。当前原型在 `codex/initial-ui-prototype` 分支；合并前 `main` / `develop` 不包含这些页面。

```bash
git clone --branch codex/initial-ui-prototype https://github.com/hcxlwxlwj/InterviewLab.git
cd InterviewLab
npm ci
npm run dev
```

已有仓库先保存自己的改动，再执行 `git fetch origin`、`git switch codex/initial-ui-prototype`、`git pull --ff-only`，然后安装依赖并启动。无需数据库、Docker、供应商密钥或 `.env`。

打开 [首页](http://127.0.0.1:3000/)、[岗位库](http://127.0.0.1:3000/jobs)或[个人中心](http://127.0.0.1:3000/me)。协作者各自在自己的电脑执行上述命令；localhost 不是可分享给其他电脑的在线预览地址，共享访问需要另行部署。

## 当前可以体验

| 模块 | 已实现的演示行为 |
| --- | --- |
| 岗位库 | 36 个计算机相关岗位、搜索/分类/阶段筛选、JD、考查主题、288 道平台整理问题及可追溯来源 |
| 个人中心 | 多份文本简历、经历、复制/默认/版本、记录、收藏模板、个人 JD 和偏好 |
| 配置 | 平台模板或个人 JD、关联简历与确认经历、类型、难度、时长及面试官风格 |
| 模拟面试 | 文字回答、预设问题与追问、暂停、跳过、结束、草稿与材料快照 |
| 报告与重练 | 逐题记录、未观察状态、单题重练、两次回答对照与历史回看 |
| 接口 | Next.js `/api/v1` 公开内容/合成读取、请求校验及明确的能力未接入响应 |

体验路径：岗位库 → 收藏或保存个人 JD → 配置材料 → 文字模拟 → 报告 → 单题重练 → 个人中心回看。

用户回答不生成专业分数；固定评分只出现在明确标注的合成报告。语音仅为流程预览，摄像头与媒体采集关闭；代码区提供草稿和未真实运行的演示说明。当前数据存于本标签页的 `sessionStorage`，刷新恢复、关闭标签页后不保证保留，存储不可用时降级为内存；请使用合成材料。各协作者的数据不互通。

当前页面、设计参考、截图和局限见[首轮原型记录](docs/software/prototype/implementation.md)及[个人中心/岗位库扩展](docs/software/prototype/library-expansion.md)。

## 仓库结构

采用 [IntelligentSWEPractice 课程模板](https://github.com/bettermorn/IntelligentSWEPractice#课程成果)的文档、代码与测试分层，并增加公开内容适配包。

```text
docs/              requirements / algorithm / software / mgmt / retrospection
code/frontend/     Next.js 页面、组件与标签页演示客户端
code/backend/      HTTP 路由、请求校验与服务端接入合同
code/core_engine/  不依赖框架或存储的共享类型与领域规则
code/content/      公开 JSON 适配与独立的合成演示样例
content/           岗位、问题、来源、版本与审核资料
tests/             unit / integration
scripts/           内容与依赖边界检查
.github/           CI、文档检查与协作模板
```

开始修改前阅读[工程目录与职责](docs/software/repository_structure.md)。[代码导航](code/README.md)、[测试导航](tests/README.md)和[内容维护](content/README.md)分别说明修改入口、验证范围和审核流程。

## 文档入口

| 课程成果 | 当前正文 |
| --- | --- |
| 需求 | [问题定义与 5W1H](docs/requirements/problem_definition.md)、[功能](docs/requirements/functional_spec.md)、[非功能](docs/requirements/nonfunctional_spec.md)、[用户故事](docs/requirements/user_stories.md) |
| 算法与研究 | [技术/竞品调研](docs/algorithm/research.md)、[知识与 Agent](docs/algorithm/knowledge_and_agent.md)、[评测](docs/algorithm/evaluation.md) |
| 软件设计 | [架构](docs/software/architecture.md)、[数据与接口](docs/software/data_and_interfaces.md)、[原型](docs/software/prototype/README.md)、[模块导航](docs/software/README.md) |
| 项目管理 | [团队计划](docs/mgmt/team_plan.md)、[沟通](docs/mgmt/communication_mgmt_plan.md)、[风险](docs/mgmt/risk_mgmt_plan.md)、[教师反馈](docs/mgmt/feedback.md) |
| 复盘 | [日期索引与历史记录](docs/retrospection/README.md) |

总入口为[文档导航](docs/README.md)。设计正文持续修订，过程与复盘保留发生日期；旧文档路径仅作兼容导航。文档中的目标服务不等于当前已验收能力。

## 检查与生产启动

```bash
npm run check
npm run build
npm start
```

`check` 包括依赖边界、类型、内容、单元/接口测试和文档检查；文档检查需要 Python 3。单独命令为 `npm run boundaries:check`、`npm run typecheck`、`npm run content:check`、`npm test`、`npm run docs:check`。提交前再运行 `git diff --check`。代码格式使用 `npm run format:code`。

开发服务与生产构建共用 `.next`，不要在同一目录同时运行。构建与规则测试不能替代真实服务、浏览器主路径或 AI 效果验收。

## 后续接入与协作

接下来先建立异步客户端、真实身份和数据库仓储，再通过核心适配接口接入知识检索与 Agent；其后实现实时语音与基础表达观测，最后开展对照评测和小规模试用。语音是目标主线，当前文字原型用于先验证流程。材料归属、快照、删除和媒体保留规则见[数据合同](docs/software/data_and_interfaces.md)。

任务分支经 PR 合入 `develop`，阶段验收后再合入 `main`；操作及检查见[协作须知](COLLABORATION.md)。[第一周提交记录](docs/mgmt/week1_submission.md)保留此前交付证据，不倒写为本次结果。

不提交密钥、真实简历、录音和用户记录。公开岗位属于平台原创整理的通用参考，题目不标为企业真实面试题；来源与素材使用依据在内容和原型文档维护。
