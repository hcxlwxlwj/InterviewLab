# 项目验证

所有测试对应当前唯一 Agent、真实 HTTP 及账号流程，不再维护演示会话、预设题单或旧岗位专用运行时。

- `npm run check`：依赖边界、类型、内容、单元及普通集成、文档检查。当前内容校验覆盖 1269 个已发布岗位、10148 道活跃主问题、48 道独立补充题、98 道课程题及 1962 条来源；保留原始 8000 道问题记录中的 4 条合并历史，数量与层级见[内容清单](../docs/algorithm/content/README.md)。
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

## 核心用例索引

用例映射到现有测试源码，并按输入等价类、时间边界和业务场景组织。普通测试和独立数据库测试的运行入口见上文。

| 用例 | 需求 | 前置条件与输入 | 预期结果 | 证据 |
| --- | --- | --- | --- | --- |
| TC-01 | FR-03、NFR-05 | 分别提交 5、10、20、30 分钟的新建配置 | 5 分钟不作为新建选项；10／20／30 分钟使用各自题量及硬上限 | [时长策略](unit/interview-policy.test.ts) |
| TC-02 | FR-03、NFR-09 | 已选确认版简历，准备尚未完成 | 三种模式均等待准备完成，等待期间不计时 | [准备集成](integration/database/agent-workflow.test.ts) |
| TC-03 | FR-03、NFR-09 | 首次点击开始，服务端成功但响应丢失 | 读取并恢复已运行会话，重试不重复开始 | [开始请求](unit/start-request.test.ts) |
| TC-04 | FR-05、NFR-05 | 长面试持续至普通 12 分钟边界及该场硬上限 | 20／30 分钟场次跨过 12 分钟继续运行，到各自硬上限结束 | [会话截止](integration/database/interviews.test.ts) |
| TC-05 | FR-05、NFR-09 | 语音识别已返回 final，但用户尚未结束说话 | 等到结束静音窗口后才保存完整回答 | [语音回合](unit/voice-session.test.ts) |
| TC-06 | FR-05、NFR-09 | 下一问生成中，收到已确认的补充语音 | 原回答增加 revision，旧生成结果无法发布 | [语音发布竞态](integration/database/voice-publication.test.ts) |
| TC-07 | FR-05、NFR-09 | 原样重放作答请求，再用同一幂等键改变输入 | 原样重试返回权威会话，改变输入时冲突，已删资源不会恢复 | [作答写入](integration/database/interviews.test.ts) |
| TC-08 | FR-05、NFR-09 | 暂停时模型仍在生成 | 取消正在执行的供应商请求并保留已提交的数据 | [取消流程](integration/database/interview-cancellation.test.ts) |
| TC-09 | FR-08、NFR-08 | 报告返回虚构引文后发起重试 | 拒绝虚构引文，报告可独立重试，逐题未观察项无评分 | [报告重试](integration/database/interviews.test.ts) |
| TC-10 | FR-08/09 | 已登录用户完成文字面试，查看报告并选择一题重练 | 保留原作答，重练使用原题，比较关联两次回答的证据 | [真实路由与测试模型](integration/database/interviews.test.ts) |

独立试用另见[交叉用户测试表](interviewlab_demo_user_test.md)。当前覆盖率样本和范围见[代码质量记录](../docs/software/code_quality.md)。
