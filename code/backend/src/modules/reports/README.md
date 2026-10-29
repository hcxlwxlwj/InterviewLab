# 文字面试复盘报告

本模块处理已结束文字面试的复盘。一场面试对应一份报告；逐题分析、整场总结与重练比较通过现有 worker 异步执行。真实模型的专业质量仍需人工验收，自动测试使用受控输出。

## 已实现内容

- 逐题亮点、缺口、参考要点、练习目标及回答原文引用。
- 同一主问题的上下文辅助追问分析，引用仍严格限定当前回答版本。
- 已成功题目在其他题目分析中即可读取，进度区分成功、待处理和最终失败。
- 整场总结、最多三个优先目标，引用必须来自已校验逐题评价；优势不使用缺口证据，目标复用对应题目的原有练习目标。
- 缺失逐题分析与整场总结分别重试；总结失败保留逐题结果。
- 原题重练及前后比较沿用已有接口。
- 零回答不调用分析模型；无代码考核不观察代码能力；四维和总分保持 null。
- 旧报告可读取，GET 不触发模型；用户显式请求后才生成历史报告总结。

## 启动与接入

从仓库根目录执行。先按[后端说明](../../../README.md)配置开发数据库、模型和受邀登录账号；数据库及模型凭证只保存在本机环境。

```bash
npm run db:migrate
npm run dev:api
```

另开终端分别运行 `npm run dev:worker` 和 `npm run dev`，登录后完成文字面试，从结束页或面试记录进入 `/reports/{interview_id}`。

需要应用新增迁移 `0004_text_report_summary.sql`，为报告添加 summary_task_id 与 summary_input_digest。应先部署迁移，再同时更新 API 与 worker，旧 worker 不认识新任务类型。

`npm run dev:interview` 是面试模块专用联调：其 onFinalize 明确不生成报告，不能用它验收自动报告闭环。报告联调使用上述完整组合；已有专用联调记录也可以在具备相同身份的完整组合中显式请求报告。

## HTTP 合同

路径前缀为 `/api/v1`，需要共享 Cookie 身份和资源归属校验；写请求还需要同源 Origin 与 Idempotency-Key。

| 方法 | 路径 | 输入与行为 |
| --- | --- | --- |
| GET | /interviews/:id/report | 当前报告、逐题结果、分析进度及总结子状态 |
| POST | /interviews/:id/report | `{version, scope?: "missing" \| "summary"}`；缺省 missing 兼容旧客户端 |

pending/generating 返回 202，终态返回 200。报告不存在时首次请求使用 version=1；进行中面试返回 409，越权与不存在返回 404，过期版本返回 409 version_conflict。

scope=missing 只补失败或缺失题目，复用成功结果，再生成对应总结；scope=summary 只重试失败或未请求的总结，不重跑逐题分析。有效总结、无有效回答和已在生成中的相同版本请求复用当前状态。重试递增版本，同一幂等键的不同输入冲突。

新增可选字段 analysis_progress、summary_status、summary、analysis_metadata；可选是为了兼容旧报告。旧总结状态为 not_requested，无回答/无可用评价依据时为 not_applicable。报告 ready 不保证完整，需同时检查 is_partial、missing_turn_ids 和 summary_status。

## 任务与一致性

- reports.evaluate.v1：绑定报告版本、回答 revision 与封存输入摘要。
- reports.summarize.v1：绑定报告版本、封存输入及逐题结果摘要。
- comparisons.generate.v1：沿用原答与单题重练比较。

模型在事务外运行；结果通过 TaskOutcome.commit 与任务成功同事务提交。提交前重检来源、归属、版本及摘要；删除或过期结果不可发布。总结任务引用保存在数据库列，正文保存在现有 JSONB，不新增一套任务表。version 目前不提供完整历史版本浏览。

## 文件职责

| 文件 | 职责 |
| --- | --- |
| analysis.ts | 报告模型结构、提示、逐题及总结证据校验 |
| aggregate.ts | 纯进度、覆盖、维度观察与部分报告计算 |
| service.ts | 生命周期、任务编排、重试和发布 |
| repository.ts / schema.ts | SQL 存取与 Drizzle 数据库结构 |
| schemas.ts / routes.ts | HTTP 合同与路由 |

模型 HTTP 适配器与调用日志复用已有能力；interviews/agent.ts 为历史调用保留报告校验的再导出。

## 验证与边界

工程检查：`npm run check`、`npm run build:backend`、`npm run openapi:generate`、前端构建。

使用独立 interviewlab_test* 数据库运行 `npm run test:db`、`npm run test:process` 和 `npm run test:web`。数据库测试会清理测试表，不得使用开发或生产库。

新增用例覆盖进度、旧版本引用、无回答、旧报告、虚构引用、优势/缺口混用、重试目标篡改、输出限制、总结独立重试、部分成功复用、删除中生成及归属。原文匹配只能保证引用存在，不能证明评价正确；正式验收还要人工复核专业判断、事实边界和建议可执行性。

本轮未接入语音、数值评分和 PDF 导出。后续语音应提供最终转写及 revision、输入方式、质量与片段关联；声学观察独立展示，更正转写后重新生成受影响分析。

原设计见[实现方案](IMPLEMENTATION_PLAN.md)。

## 本轮验证记录（2026-10-29）

- 完整 npm run check 通过：136 项单元/普通集成测试，含 12 项新增报告测试。
- 独立临时 PostgreSQL 上的数据库测试通过：42 项，含总结失败独立重试、部分结果复用、历史报告显式升级、删除中生成与过期版本发布拦截。
- API/worker 进程测试 4 项、真实 Next.js 同源代理测试 1 项通过。
- 后端构建、OpenAPI 导出通过；前端 webpack 生产构建通过。
- 当前机器默认 Turbopack 构建遇到本地子进程绑定端口权限错误；未修改项目默认构建配置，使用 `npm run build --workspace @interviewlab/web -- --webpack` 验证生产代码。
- 浏览器自动化连接不可用，未完成视觉/交互人工验收；真实模型分析质量仍需用授权或合成材料试跑和人工复核。

所有数据库自动化只使用隔离测试库；未迁移或清理成员正在使用的开发数据库。
