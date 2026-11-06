# 项目验证

所有测试对应当前唯一 Agent、真实 HTTP 及账号流程，不再维护演示会话、预设题单或旧岗位专用运行时。

- `npm run check`：依赖边界、类型、1000 岗位/8000 原创问题、单元及普通集成、文档检查。
- `npm run build:backend`、`npm run build`：后端与前端构建；前端开发和构建不能同时占用同一 `.next`。
- `npm run test:db`：独立 `interviewlab_test*` 数据库上的版本、准备、报告、任务、取消、删除竞态及全岗位 pgvector 导入；受控嵌入不代表语义质量。
- `npm run test:process`：编译产物的 API/worker 启停、恢复和错误处理。
- `npm run test:web`：生产 Next.js 同源代理、Cookie、Origin、SSE 及后端断开行为。
- `npm run test:llm`：`support/agent-workflow-live.ts`，九类合成材料、准备和三轮当前 Agent；真实调用可计费，不运行旧 Agent 对照。
- `npm run voice:check`：合成句 TTS → 流式 ASR；不能代替浏览器麦克风实测。
- `npx tsx tests/support/response-evidence-live.ts --mode=json_object`：使用真实模型与合成回答验证问候、正确短答及明确不会；可切换 `json_schema`，不读取用户简历。`support/interview-policy-live.ts --type=technical_qa --rounds=6 --evaluate-all` 检查动态推进和逐题评分，固定合成答句未回应实际问题时必须如实记录，不为凑六维补分。

数据库回归会清空测试表，必须显式指定 TEST_DATABASE_URL；不得连接业务库或与浏览器测试共用清表中的数据库。`support/test-database.ts` 校验数据库名称、协议和错误脱敏。

`support/agent-preview.ts` 使用独立浏览器库和合成账号/材料，直接调用正式 Agent、真实模型及已配置媒体供应商，不注入固定追问或评分；缺少模型配置直接失败。模型调用可能计费，真实媒体需另验。`support/knowledge-all-live.ts` 仅验证九条公开摘要的真实嵌入，不代表全量专业知识发布。

当前业务生命周期回归显式选择受支持的简化准备路径；`integration/database/agent-workflow.test.ts` 单独验证正常简历分析、准备等待、三模式开始门槛、幂等及删除竞态。保留历史报告读取测试以保护已保存数据。

运行说明见[运行指南](../docs/software/development.md)，实际结果与限制见[清退记录](../docs/retrospection/2026-11-05-runtime-cleanup.md)。
