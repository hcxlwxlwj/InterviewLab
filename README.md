# InterviewLab · 面试练习室

面向高校学生的模拟面试与复盘 Web 应用。围绕课程项目、竞赛、科研、毕设及实习经历练习岗位问答，讲清个人贡献、方案取舍与验证过程。

**当前阶段：真实文字面试闭环、公开岗位内容及独立后端。** 已实现邮箱密码注册与登录账号、持久化面试、动态 Agent 提问、证据报告、单题重练、比较与历史，以及可配置的 ecnu-plus 兼容适配器；单案例真实模型闭环已通过，质量评审仍待完成。使用时需在本机配置密钥；简历/个人 JD 仍为演示，语音、上传、代码执行和 PDF 未接入。详细范围与验证边界见[文字面试接入](docs/software/interview-agent-implementation.md)。

## 本地运行

已使用 Node.js 24、npm 11 验证，当前原型已合入 `main`。

```bash
git clone https://github.com/hcxlwxlwj/InterviewLab.git
cd InterviewLab
npm ci
npm run dev
```

已有仓库先保存自己的改动，再执行 `git fetch origin`、`git switch main`、`git pull --ff-only`，然后安装依赖并启动。无需数据库、Docker、供应商密钥或 `.env`。

上面的命令可单独浏览首页。首页以外的业务页面需要登录；注册登录需要启用认证并连接数据库。真实面试需配置数据库、认证及 LLM_API_KEY，执行 `npm run db:migrate` 后另开终端运行 `npm run dev:api` 和 `npm run dev:worker`；浏览器通过 `/api/v1` 同源访问。默认模型为 ecnu-plus，见[完整启动与模型配置](docs/software/interview-agent-implementation.md)。

打开 [首页](http://127.0.0.1:3000/)、[岗位库](http://127.0.0.1:3000/jobs)或[个人中心](http://127.0.0.1:3000/me)。协作者各自在自己的电脑执行上述命令；localhost 不是可分享给其他电脑的在线预览地址，共享访问需要另行部署。

## 当前可以使用

首页公开，其他业务页面先弹窗登录；登录后只展示当前账号的真实数据。直接访问业务地址也先回首页登录，再恢复原目标。注册不验证邮箱，暂不支持找回密码。

| 模块 | 当前真实能力 |
| --- | --- |
| 账号 | 邮箱密码注册、自动登录、Cookie 会话、退出、当前身份与跨标签页同步 |
| 岗位库 | 1000 个公开岗位模板，经真实 API 搜索、分类、阶段筛选与分页，查看 JD、题目和来源 |
| 个人中心 | 当前账号姓名、邮箱和最近的真实面试；新账号为空记录 |
| 模拟面试 | 持久化配置、真实 Agent 提问、文字回答、暂停、跳过、结束与草稿 |
| 报告与重练 | 本人证据报告、单题重练、两次回答比较、历史和删除 |
| 尚未开放 | 简历、个人 JD、收藏、偏好维护、上传、语音和 PDF；页面明确留空或禁用 |

真实路径：注册/登录 → 岗位库 → 配置 → 文字面试 → 报告 → 重练/比较 → 本人历史。

旧演示代码与显式 `?demo=1` 地址保留，但主流程不展示演示个人资料，也不自动上传。首页的合成界面示意不属于账号数据。详细配置、接口、隔离与限制见[账号与访问管理](docs/software/account-management.md)。

## 仓库结构

采用 [IntelligentSWEPractice 课程模板](https://github.com/bettermorn/IntelligentSWEPractice#课程成果)的文档、代码与测试分层；根目录按课程结构收拢，运行必需的 npm/TypeScript 配置保留。

```text
docs/              requirements / algorithm（含 content）/ software / mgmt / retrospection
code/frontend/     Next.js 页面、组件与标签页演示客户端
code/backend/      HTTP 接口、服务合同、公开内容适配
code/core_engine/  不依赖框架或存储的共享类型与领域规则
tests/             unit / integration
.github/           workflows、scripts 与协作模板
```

开始修改前阅读[工程目录与职责](docs/software/repository_structure.md)。[代码导航](code/README.md)、[测试导航](tests/README.md)和[内容维护](docs/algorithm/content/README.md)分别说明修改入口、验证范围和审核流程。

## 文档入口

| 课程成果 | 当前正文 |
| --- | --- |
| 需求 | [问题定义与 5W1H](docs/requirements/problem_definition.md)、[功能](docs/requirements/functional_spec.md)、[非功能](docs/requirements/nonfunctional_spec.md)、[用户故事](docs/requirements/user_stories.md) |
| 算法与研究 | [技术/竞品调研](docs/algorithm/research.md)、[知识与 Agent](docs/algorithm/knowledge_and_agent.md)、[评测](docs/algorithm/evaluation.md) |
| 软件设计 | [架构](docs/software/architecture.md)、[数据与接口](docs/software/data_and_interfaces.md)、[原型](docs/software/prototype/README.md)、[软件设计索引](docs/software/README.md) |
| 项目管理 | [团队计划](docs/mgmt/team_plan.md)、[沟通](docs/mgmt/communication_mgmt_plan.md)、[风险](docs/mgmt/risk_mgmt_plan.md)、[教师反馈](docs/retrospection/teacher_feedback.md) |
| 复盘 | [日期索引与历史记录](docs/retrospection/README.md) |

总入口为[文档导航](docs/README.md)。设计正文持续修订，过程与复盘保留发生日期；功能行为与验收统一维护在 requirements，旧模块与重复导航文件已移除。文档中的目标服务不等于当前已验收能力。

## 检查与生产启动

```bash
npm run check
npm run build
npm start
```

`check` 包括依赖边界、类型、内容、单元/接口测试和文档检查；文档检查需要 Python 3。单独命令为 `npm run boundaries:check`、`npm run typecheck`、`npm run content:check`、`npm test`、`npm run docs:check`。提交前再运行 `git diff --check`。代码格式使用 `npm run format:code`。

开发服务与生产构建共用 `.next`，不要在同一目录同时运行。构建与规则测试不能替代真实服务、浏览器主路径或 AI 效果验收。

## 后续接入与协作

独立后端采用 TypeScript/Node 模块化单体：Fastify + Zod/OpenAPI、Drizzle/PostgreSQL、pg-boss worker。公共基础、认证、岗位读取、真实文字面试/报告和模型适配已实现；简历/JD、pgvector、多模态等按阶段接入。知识库通过版本化接口注入，无需等待新知识库完成才能联调面试流程。详见[后端启动与成员接入](code/backend/README.md)。

后续按四阶段实施：1 真实文字闭环，2 文件/内容/检索及评分校准，3 实时语音与独立语音观测，4 可选代码/镜头/复盘媒体/管理页面；各阶段回归，稳定后做对照与试用。保留显式演示入口，个人材料不自动上传。模块职责见[架构](docs/software/architecture.md)，新 HTTP 及旧路径迁移、材料快照和删除规则见[数据合同](docs/software/data_and_interfaces.md)。本轮已新增独立后端命令、依赖、迁移与测试；原型启动方式保持兼容。

任务分支经 PR 合入 `develop`，阶段验收后再合入 `main`；操作及检查见[协作须知](docs/mgmt/COLLABORATION.md)。[第一周提交记录](docs/retrospection/week1_submission.md)保留此前交付证据，不倒写为本次结果。

不提交密钥、真实简历、录音和用户记录。公开岗位属于平台原创整理的通用参考，题目不标为企业真实面试题；来源与素材使用依据在内容和原型文档维护。
