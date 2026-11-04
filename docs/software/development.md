# 本地运行、知识发布与回退

更新：2026-11-04。本文是运行操作的权威入口，不重复设计规则。所有命令在仓库根目录执行，Node.js 24 / npm 11 为本次验证环境。

## 启动现有应用

先保留本机改动，安装 `npm ci`。参考根 `.env.example` 在本机配置业务数据库、认证和模型，不提交 `.env`。数据库必须是明确选择的环境；`npm run db:migrate` 应用新增迁移，不清空表。

```bash
npm ci
npm run db:migrate
npm run dev:api
```

另开两个终端运行 `npm run dev:worker`、`npm run dev`。浏览器默认访问 `http://127.0.0.1:3000`，先注册或登录。`npm run auth:create-user` 可按其 CLI 提示创建本地账号。认证配置沿用[账号设计](account-management.md)。首页可单独浏览，业务页需要数据库和登录。

本仓库 Compose 与示例配置使用业务库端口 **5433**、知识库端口 **5434**。Docker Desktop 启动后，用 `docker compose -f code/backend/compose.yaml up -d --wait` 启动；保留原命名数据卷，不使用 `down -v`。已有业务数据先备份，再应用追加迁移。

## 唯一 Agent 运行时

当前仅保留 LangChain / LangGraph 新流程，已删除 INTERVIEW_AGENT_RUNTIME 开关。API 与 worker 均使用同一实现。WORKER_PREPARATION_CONCURRENCY 默认 1。

新建面试先准备，已确认简历自动分析；准备失败可显式选择简化流程。准备完成后点击开始才计时，媒体需另行开启。旧记录仍可查看；未带当前运行时快照的历史面试不再调用旧 Agent，应新建面试。清退不改写历史快照或删除数据。

手动测试见[测试清单](../algorithm/evaluation.md)，日志分别标识 resume_analysis、interview_preparation、interview_advance。真实效果与知识覆盖仍按[评测](../algorithm/evaluation.md)验收，删除旧代码不等于质量验收通过。

本次尚未将完整真实向量索引发布到你的日常知识库。未配置/未发布时使用冻结岗位和原题上下文，界面不会因此伪造专业依据。专业覆盖限制见[知识检索](../algorithm/knowledge_and_agent.md)。

## 全岗位索引：先验证，再发布

配置 `KNOWLEDGE_DATABASE_URL` 指向明确选择的独立知识库。先使用验证库，避免误操作日常发布指针。沿用现有 `EMBEDDING_MODEL`；维度不变。build 会实际调用嵌入服务并计费；同版本 building 可重跑恢复，完成后需新版本 ID。

```bash
npm run knowledge:all -- coverage
npm run knowledge:all -- migrate
npm run knowledge:all -- build all-roles-20261104-review1
npm run knowledge:all -- preview all-roles-20261104-review1
```

preview 仅非生产可用，读取需要 `KNOWLEDGE_PREVIEW=true`。验证所有岗位映射、范围过滤、召回和来源后，由实际审核人执行：

```bash
npm run knowledge:all -- publish all-roles-20261104-review1 actual-reviewer-id
```

不要把示例审核名当成真实签署。`coverage` 只读源；`migrate` 创建 v2 表；`build` 只建 draft；`publish` 才切换新会话的 active 指针。旧版本保留。知识回退命令 `npm run knowledge:all -- rollback all-roles-原已发布版本`；retire 不删除内容。实际数据和状态必须与目标版本匹配，不要直接执行含占位的命令。

## 验证

```bash
npm run check
npm run build:backend
npm run build
npm run openapi:generate
```

数据库、进程、代理测试必须显式设置 `TEST_DATABASE_URL`，且库名为 `interviewlab_test*`；测试会清表，不允许个人或业务数据。顺序执行，不能同时对同一库跑清表回归和浏览器预览。

```bash
npx tsx tests/support/run-database-checks.ts
npx tsx tests/support/run-database-checks.ts test:process
npx tsx tests/support/run-database-checks.ts test:web
npx tsx tests/support/agent-workflow-live.ts --cases=18
npx tsx tests/support/knowledge-all-live.ts
```


最后两项使用真实模型/嵌入，只发送合成材料或公开摘要；产物写入被忽略的 `tests/artifacts/`。知识真实冒烟只导入九条基础摘要，不是全量真实导入。语音配置和真实设备实测见[语音设计](voice-interview.md)。

## 回退与保护

发生代码回归时恢复清退前工作区快照或版本，并配套重启 API/worker；当前代码不提供旧运行时开关。旧迁移与数据库继续保留，不删表、不强制迁移历史会话。

发现回归先保留 task/generation ID、输入版本、错误码与日志；不要把真实简历放入 Issue。知识问题单独回退发布指针，历史会话仍读冻结版本。数据库恢复需要使用实际备份，不删表或改写已应用迁移来“恢复”。

本次工作区保护点：起始提交 `53f4148`，专用分支 `codex/all-role-agent`。原未提交与未跟踪文件已在仓库外完整备份，路径见[本次记录](../retrospection/2026-11-04-agent-engineering.md)。没有擅自提交、推送或部署。
