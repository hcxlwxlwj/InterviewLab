# 数据与接口合同

版本：v0.6 · 更新：2026-10-25 · 状态：公共骨架、同源接入、认证和岗位只读 HTTP 已实现，业务合同仍按阶段落地。

## 0. 当前接口与目标合同

原同步演示客户端继续保留，Next.js 合成接口为 /api/demo/v1。真实 /api/v1 提供公开岗位、认证、任务及文字面试/报告/重练/比较；OpenAPI 只列注册路由。除公共与认证表外，迁移 0002 新增六张面试/报告模块表。真实 DTO 使用独立 Interview，支持未校准证据报告及任务引用；原 Session 和 DataClient 仅供演示。当前实现、接口补充及未验收范围见[文字面试接入](interview-agent-implementation.md)。

本文第 1–9 节保留全产品合同；已实现范围见后端 README 及下方骨架说明。原 API_CONTRACT、Session 和同步 DataClient 属于演示合同，不能当作新的真实 HTTP 客户端。

### 旧草案迁移

| 当前原型/草案 | 新目标 | 迁移说明 |
| --- | --- | --- |
| `/resume-documents` | `/resumes` | 文本与文件统一为简历资源，前端页面 URL 不变 |
| `/resume-documents/{id}/set-default` | `PUT /me/default-resume` | 设置/清空指针，不保留第二套默认设置逻辑 |
| `/resume-documents/{id}/save-to-library` | `PATCH /resumes/{id}` | 显式修改保存范围，不自动入库 |
| `/resume-documents/{id}/confirm` | `/resumes/{id}/confirmations` | 保留每次候选确认依据 |
| `/sessions`、`/history` | `/interviews` | 同一列表负责状态、岗位、简历和时间筛选；登录会话与面试资源区分 |
| `/sessions/{id}/turns` 的混合提交 | 当前回合的 `/answer`、`/actions` | 作答与澄清/重复/跳过分开；问题回合先于答案存在 |
| 面后 `PATCH` 原回合 | `/corrections` | 追加纠错记录，保留原识别及原因 |
| `/sessions/{id}/report/retry` | `POST /interviews/{id}/report` | 同一输入复用有效结果/任务，失败或过期才重建 |
| `/retry-comparisons` | `/comparisons` | 固定两份回答 revision 和比较标准 |
| `POST/PATCH /me/bookmarks` | `PUT /me/bookmarks/{template_id}` | 收藏键直接使用模板 ID，设置目标状态，避免不确定的 toggle |
| `/job-templates/{id}/sources` | 模板详情内的来源 | 正式客户端读取详情即可；现有来源路由仅属于原型 |
| 预先约定的一组 `/admin` 路径 | 首轮授权命令与内部服务 | 不先设计通用内容 CRUD 或管理页面；后续按明确内容类型开放 |

真实服务与新异步客户端在同一阶段迁移，不维护两套私有业务实现。保留显式演示模式，旧浏览器 schema=2 的资料不自动上传，也不伪造为真实账号数据。旧页面链接与四类历史岗位 ID 保留兼容；HTTP 草案允许调整，不承诺尚未实现接口的别名。

## 1. 公共协议与权限

- HTTP 前缀统一 `/api/v1`，时间使用 UTC。ID 是服务端生成的不透明标识，用户身份仅取已验证登录会话。
- 浏览器经统一入口同源访问，认证组件管理 Cookie。所有私有列表、详情、任务、预览、下载及 WebSocket 都检查归属；对他人和不存在的资源统一返回不可读结果，不能通过模型提供的 ID 绕过。
- 列表接收 `limit/cursor`，默认 20、上限 50，返回 `{items,next_cursor}`。游标不透明，绑定稳定排序与筛选条件，不接受客户端 SQL 偏移表达式。
- 已有对象写入携带 `version` 或明确的来源 revision；不匹配返回 `409 version_conflict`。新对象不要求伪造 version。
- 创建、复制、确认、开始/结束、作答、分析及生成任务使用 `Idempotency-Key`；同一用户、操作与键的同输入复用结果，不同输入冲突。PATCH/DELETE 仍执行版本及权限检查。
- 普通资源保存同步返回。耗时处理返回 `202`，带领域对象状态和 `task_id`；查询读取领域接口或 `GET /tasks/{id}`。不把普通请求一直挂到面试或报告结束。
- 错误体沿用 `{code,message,retryable,request_id}`。至少区分 `unauthorized/forbidden/not_found/unsupported_input/version_conflict/invalid_state/insufficient_material/provider_timeout/budget_exceeded/capability_unavailable/task_failed`。401 未登录，404 不可读，400 输入错误，409 状态/版本冲突，501 未接入能力。
- 面试进行中不得返回面后评分、参考要点或表达反馈；限制在服务端执行。岗位库中的公开准备资料与当前面试的私有分析是不同读取边界。

## 2. 数据模型与业务归属

普通列表、过滤和关联使用可查询字段与关系表，不把所有数据塞进一个用户 JSON。冻结输入和结构化模型输出可用 JSONB，但保留对象 ID、版本摘要、状态和归属等索引字段。下列名称是目标逻辑实体，不代表数据库迁移已经建立。

| 模块/实体 | 最小数据与关系 | 约束 |
| --- | --- | --- |
| Auth/User/Profile | 认证组件的用户/凭证/登录会话；display_name、locale、timezone、profile version | 认证表与面试表分开，授权命令创建受邀账号 |
| Preferences/DefaultResume | 交互、播报、编辑器、岗位偏好及 version；默认简历指针 | 每人至多一份默认；仅本人 library 且 confirmed 的当前版本可设默认 |
| Resume/ResumeVersion | id、owner、name、current_version、scope、时间；每版正文、方向、文件和经历顺序 | 文本字段含基本信息、教育、技能、自我介绍和原始文本；历史内容版本独立 |
| Experience/ExperienceVersion | kind、个人职责、行动、技术决策、结果、确认、来源简历及版本、证据 | 可独立手填；复制生成新经历 ID；结果可缺失，不补造数字 |
| PrivateFile/ExtractionCandidate | 私有定位、实际类型、大小、scope、到期；提取来源、候选 revision、确认记录 | 原文件、候选与确认事实不同；文件替换重新确认 |
| JobTemplate/Category | 稳定 id/slug、分类、阶段、职责/要求/加分、主题、问题和来源版本 | 模板只读发布版本；岗位模块查询，知识模块维护 |
| JobTarget/JobAnalysis | 企业、标题、JD 原文、链接、备注、常用简历、模板来源、version；独立分析状态与输入摘要 | 保存不自动触发模型；JD 明文、知识说明、推断分开 |
| Bookmark | owner、template_id、notes、preferred_resume_id、version、时间 | `(owner,template_id)` 唯一，重复设置不重复收藏 |
| Interview | id、owner、mode、配置、状态、version、开始/结束时间、快照、问题生成状态、重练父引用 | 业务状态只由面试服务写；首次创建不计时 |
| MaterialSnapshot | 指定简历/经历/JD、知识/题库/标准/提示版本、必要正文和来源引用 | start 时冻结；编辑不改历史，事实删除按关联清理 |
| InterviewTurn | interview_id、题干、主问题/追问序号、父回合、目标、来源、generation、展示/播放范围、回答状态 | 未回答问题也有记录；澄清和重复不伪造已完成答案 |
| AnswerSegment/AnswerRevision | turn、实际 input_mode、片段序号与时间、原 ASR/text、缺口、提交标识、revision、误截追加关联 | 原轨迹不覆盖；跳过独立标记，不以空答案评分 |
| AsrCorrection | turn、base/new revision、片段/字符区间、原文、更正、原因、时间 | 仅面后纠正识别，不补答；派生结果标过期 |
| Report/ReportVersion | interview、输入/观测摘要、状态、引用、逐题分析、四维、覆盖、重练目标、版本、is_partial | 同输入版本任务去重；发布前校验引用及删除状态 |
| RetryRelation/Comparison | 原面试/题目/回答版本、重练面试、两份片段与模式、目标、共同标准、状态和限制 | 创建重练调用面试服务，不更新原答案 |
| Export | report/version、状态、私有文件、到期、task_id | 固定版本导出，来源删除立即撤销访问 |
| Knowledge/Question/Rubric/Source | 明确内容类型、岗位/主题/阶段/难度、版本、来源、审核与复核日、发布状态 | 不是无类型的通用 content；来源与题目/标准引用可核查 |
| KnowledgeChunk/Embedding | 正文版本、定位、来源、嵌入提供商/模型/维度、索引版本 | 只对已发布公共知识检索，个人材料不进入共享向量库 |
| Task/Outbox/Idempotency | 对象与输入摘要、唯一键、状态、租约/尝试、投递、结果引用 | 业务变更与 outbox 同事务；队列重复交付不重复写业务结果 |
| Invocation/Audit/Deletion | 调用标识、模型/提示版本、耗时、用量、错误；操作人与结果；删除范围和清理状态 | 日志无私有正文和密钥，删除阻止在途任务重建数据 |
| 可选观测/媒体/代码 | 回答/提交版本、质量、授权、期限、执行限额与运行依据 | 单独生命周期，不能替代专业事实证据 |

`Interview.mode=mock`；面试类型为 `technical_qa/project_deep_dive/hr/mixed`。配置包括岗位或个人 JD 及其版本、可选简历/经历版本、难度、时长 5/10 分钟（默认 10）、风格、代码开关、实际交互模式。目标支持实时语音，第一阶段真实入口明确使用 `text_fallback`，不得仅改标签宣称实时可用。摄像头及复盘媒体初始均关闭，启用须核对能力和当场授权。

简历切换清除不属于新版本且未明确补充的经历；只选择当前用户已确认材料。删除默认简历置空，不自动另选。临时文件过期不能转入库；确认经历不代表系统核实真实性。

### 报告分数与证据

四维固定为 `technical_knowledge/project_communication/coding_ability/logical_expression`。维度携带 `status=observed|not_observed`、`score`、解释和回答引用。`not_observed` 必须 `score=null`；零有效回答不评分。

目标报告增加 `scoring_status=uncalibrated|calibrated`，区分有证据的分析与数值评分：未经人工校准时可分析已观察回答，但四维分数及总分均为空，不把 `observed` 解释为评分已校准。标准校准后，已观察维度分数为 0–100 整数，总分为其等权平均四舍五入；未观察维度不进入分母。该字段尚未进入原型共享类型。

引用包含对象/回答 ID、明确 revision、片段/字符范围和必要摘录；发布前核对原文存在及结论支持。语音/视觉独立展示，不参与专业总分。

## 3. 状态与任务一致性

| 对象 | 状态与规则 |
| --- | --- |
| 材料解析 | uploaded → parsing → needs_confirmation → confirmed；失败为 failed；手填不伪造解析任务 |
| 知识 | draft → reviewed → published → retired；发布版本只读，撤回不进入新检索，历史出处保留撤回标记 |
| 面试 | draft → ready → in_progress → ending → completed；in_progress ↔ paused；不可恢复进入 failed，终态不重开 |
| 问题生成 | idle/pending/generating/ready/failed/cancelled，独立于面试及已保存回答 |
| 回合回答 | awaiting/answered/skipped，原始作答、误截追加和面后纠错分别留痕 |
| 报告/比较/导出/JD 分析 | pending → generating → ready 或 failed，输入变更标 stale；有效同版本复用，重建保留旧版本 |
| 通用任务 | queued/running/succeeded/failed/cancelled，任务成功不代表代码用例通过或内容可直接发布 |
| 语音/视觉观测 | pending/processing/ready/unavailable/failed；质量不足不补零 |
| 复盘媒体 | capturing/available/expired/deleted/failed；到期立即停止访问 |
| 代码执行 | queued/running/succeeded/failed/timed_out/cancelled，逐例通过情况另列 |

`ready` 不表示已冻结材料。start 再检查版本和确认状态；计时从服务端 start 成功起计算。最多 6 主问题、每题 2 次追问；目标 5/10 分钟提示收尾，含暂停/断线到 12 分钟强制封存。重连不重置预算。

保存回答、更新回合/面试版本和 outbox 同事务；随后投递 pg-boss。任务键绑定对象、任务类型及输入版本摘要，投递和执行都允许恢复。LLM/语音/文件处理在事务外进行；完成时重新验证归属、版本、generation、状态和删除标记。取消、修订、结束后的旧结果不得覆盖新记录。

结束先封存后生成报告；completed 与 report pending/failed 可以同时存在。failed 面试保持终态，有有效回答可出 is_partial 报告；无可判断回答不评分。ASR 纠错使相关分析/比较/文本对齐过期，不能静默改写旧结果。

## 4. HTTP 业务接口

表中都是目标路径，实际接入阶段见[架构](architecture.md)。阶段列中的 1 为真实闭环、2 为材料/内容、3 为语音、4 为可选能力，不是需求优先级 P1，也不是当前完成状态。

### 4.1 账号与个人设置

| 方法与路径 | 功能/输入输出 | 阶段 |
| --- | --- | --- |
| `/auth/*` | 自有安全 DTO 包装 Better Auth：POST /auth/sign-in/email 返回 success、POST /auth/sign-out 接收 {}、GET /auth/session 返回 AuthSession 或 null；不返回 token；注册/邮件找回关闭，授权命令创建账号 | 已接入 |
| `GET/PATCH /me` | 本人基本信息与 version；不通过此接口修改凭证或维护权限 | 1 |
| `GET /me/overview` | 最近面试、常用简历、收藏和实际计数，组合只读查询 | 1 |
| `GET/PATCH /me/preferences` | 交互/播报/编辑器/岗位偏好与 version，不影响已开始面试 | 1 |
| `PUT /me/default-resume` | resume_id 或 null、偏好 version；校验本人 library+confirmed 当前版本后原子切换 | 1 |
| `DELETE /me/data` | 显式确认、版本依据 → 私有数据清理任务；不等同账号注销 | 1 |

### 4.2 简历与经历

| 方法与路径 | 功能/输入输出 | 阶段 |
| --- | --- | --- |
| `GET /resumes` | search/target_job/scope/parse_status/cursor → 卡片、版本、默认与到期信息 | 1 |
| `POST /resumes` | JSON 文本内容或 阶段 2 multipart PDF/DOCX；保存正文/文件；文件返回解析任务 | 1/2 |
| `GET /resumes/{id}` | 内容、经历顺序、版本、解析候选与状态；不包含未经授权文件地址 | 1 |
| `PATCH /resumes/{id}` | version、名称/正文/方向/经历顺序；阶段 2 支持替换文件及 temporary 显式转 library；校验经历归属 | 1/2 |
| `DELETE /resumes/{id}` | version、删除影响确认 → 撤销访问、清理文件/候选及未来配置引用；经历事实删除另行确认 | 1 |
| `POST /resumes/{id}/copies` | 来源版本、新名称 → 新简历及新经历 ID；副本不引用可变原经历 | 1 |
| `POST /resumes/{id}/confirmations` | 文档 version、候选 revision、逐项认可/修订 → 已确认经历及确认记录 | 2 |
| `POST /resumes/{id}/parsing/retry` | 文档与输入版本 → 解析任务；不覆盖人工编辑 | 2 |
| `GET /resumes/{id}/preview`、`/download` | 本人有效文件 → 私有预览/原文件；文本简历预览取真实正文，不伪造 PDF | 2 |
| `GET/POST /experiences` | 简历/确认状态筛选，或 kind、职责、行动、决策、结果、来源与确认 → 经历 | 1 |
| `PATCH/DELETE /experiences/{id}` | version、编辑/确认或级联影响确认 → 新版本或清理任务 | 1 |

### 4.3 岗位与收藏

| 方法与路径 | 功能/输入输出 | 阶段 |
| --- | --- | --- |
| `GET /job-categories` | 方向分类注册表 | 1 |
| `GET /job-templates` | search/category/stage/limit/cursor → 已发布模板；未知岗位不回退前端 | 1 |
| `GET /job-templates/{id}` | 通用 JD、职责/要求/加分、主题、平台题、来源、内容与复核版本 | 1 |
| `GET/POST /job-targets` | 查询个人目标；创建原文或模板副本，保存企业/岗位/JD/链接/备注/常用简历及来源版本，不自动分析 | 1 |
| `GET/PATCH/DELETE /job-targets/{id}` | 本人目标详情；version 编辑/删除，不改变模板或历史快照；修改 JD 使旧分析 stale | 1 |
| `POST /job-targets/{id}/analysis` | 当前目标 version → JD 分析任务；相同有效输入复用 | 1 |
| `GET /job-targets/{id}/analysis` | 当前输入对应状态、职责/要求、引用和未知项 | 1 |
| `POST /job-targets/{id}/questions` | 目标 version、用户问题 → 岗位顾问任务与带来源回答；不泄露进行中面试的参考要点 | 1 |
| `GET /me/bookmarks` | search/category/cursor → 收藏、备注和常用简历 | 1 |
| `PUT /me/bookmarks/{template_id}` | notes、preferred_resume_id，已有收藏带 version → 创建或更新确定目标状态，不使用 toggle | 1 |
| `DELETE /me/bookmarks/{template_id}` | version → 取消收藏，不删除平台模板 | 1 |

### 4.4 面试与回答

| 方法与路径 | 功能/输入输出 | 阶段 |
| --- | --- | --- |
| `GET /interviews` | status/job/resume_id/from/to/cursor → 自动保存记录及报告/重练关联，代替 /history | 1 |
| `POST /interviews` | 配置与材料版本 → draft/ready；无材料可创建通用面试，不计时 | 1 |
| `GET /interviews/{id}` | 权威配置、状态、version、预算、快照摘要、当前回合与生成/报告状态 | 1 |
| `PATCH /interviews/{id}` | 未开始配置、version → 更新选择；进行中不换材料/题意/标准 | 1 |
| `POST /interviews/{id}/start` | version、所选材料版本 → 冻结快照、in_progress、首题任务 | 1 |
| `POST /interviews/{id}/pause`、`/resume` | version → 状态和预算；暂停取消活动代，恢复重新校验预算 | 1 |
| `POST /interviews/{id}/finish` | reason、version → ending/completed 及报告任务；幂等封存，failed 不改为 completed | 1 |
| `DELETE /interviews/{id}` | version、影响确认 → 面试及派生清理任务 | 1 |
| `GET /interviews/{id}/turns` | cursor → 问题、回答状态、原回答/纠错 revision 与输入方式，不返回面后反馈 | 1 |
| `POST /interviews/{id}/turns/{turn_id}/answer` | version、文本/片段与实际 input_mode → 已保存回答、revision、下一题 task_id；语音自动提交复用服务 | 1/3 |
| `POST /interviews/{id}/turns/{turn_id}/actions` | version、clarify_question/repeat_question/skip → 记录动作、状态和必要任务；澄清只解释题意，不给答案 | 1 |
| `POST /interviews/{id}/turns/{turn_id}/append` | 原 revision、误截事件、口头片段 → 追加轨迹、新 revision，取消依赖旧输入的生成 | 3 |
| `POST /interviews/{id}/turns/{turn_id}/corrections` | 面后 base_revision、识别错误范围、原文/更正/reason → 追加纠错、新 revision；不润色或补答 | 3 |
| `PATCH /interviews/{id}/interaction-settings` | version、实际模式、分别授权/撤回、reason → 权威设置和采集代；阶段 3 切换语音/文字，阶段 4 开启可选能力 | 3/4 |

澄清、重复不占新的主问题或追问位置；跳过保存 skipped 并安排下一题，不作为答错。任务失败后可用相同幂等键查询原结果，通过通用任务重试入口有界恢复，不重提已经保存的回答。

### 4.5 报告、重练、比较与导出

| 方法与路径 | 功能/输入输出 | 阶段 |
| --- | --- | --- |
| `GET /interviews/{id}/report` | pending/generating/ready/failed/stale 与可读结果；未请求明确说明 | 1 |
| `POST /interviews/{id}/report` | 封存输入版本 → 创建、失败重试或过期重建；相同有效任务/结果复用，零回答不调用专业评分 | 1 |
| `POST /interviews/{id}/retries` | 原 turn/revision、目标片段、目标缺口、报告版本可选 → 关联新 mock 面试，由面试服务创建 | 1 |
| `POST /comparisons` | 原/新 turn、两份 revision/片段、input_modes、重练面试和共同标准 → 比较任务 | 1 |
| `GET /comparisons/{id}` | 状态、两份原文引用、变化、目标覆盖及不可比说明 | 1 |
| `POST /comparisons/{id}/retry` | 明确输入版本 → 失败或过期重建，不自动改取最新回答 | 1 |
| `POST /reports/{id}/exports` | report version、format=pdf → 导出任务，标清部分/过期/观察范围 | 2 |
| `GET /exports/{id}`、`/download` | 任务状态或限时私有 PDF；下载再次核对本人及来源未删除 | 2 |

### 4.6 任务、健康及可选能力

| 方法与路径 | 功能/输入输出 | 阶段 |
| --- | --- | --- |
| `GET /tasks/{id}` | 本人任务状态、结果资源引用、retryable 和脱敏错误；不返回内部提示/队列载荷 | 1 |
| `POST /tasks/{id}/retry` | 仅允许本人、可重试的失败任务；校验来源版本/状态/预算，复用业务服务 | 1 |
| `GET /health` | 最小存活信息；内部就绪检查覆盖数据库及 worker，不公开私有配置或合同全文 | 1 |
| `GET /interviews/{id}/turns/{turn_id}/speech-observations` | 进行中仅处理状态/质量，面后返回对应回答版本的语音指标/对齐/覆盖/原因 | 3 |
| `POST /interviews/{id}/turns/{turn_id}/speech-observations/retry` | 观测及回答版本 → 仅有必要音频且授权有效时重算 | 3 |
| `GET /interviews/{id}/turns/{turn_id}/vision-observations` | 进行中仅质量/状态，面后返回可定位的画面/动作描述 | 4 |
| `POST /interviews/{id}/turns/{turn_id}/vision-observations/retry` | 有必要授权原视频才重算，否则明确 unavailable | 4 |
| `GET /interviews/{id}/review-media` | 媒体元数据、授权、版本与到期状态 | 4 |
| `GET /review-media/{id}/playback`、`DELETE /review-media/{id}` | 私有限时播放或立即撤销访问并清理；到期不能返回可用地址 | 4 |
| `GET /interviews/{id}/code-tasks/{task_id}` | 题干、语言、用例说明、资源限额和能力状态 | 4 |
| `POST /code-tasks/{task_id}/submissions` | language、source、revision → 保存提交；题目须属本人当前面试 | 4 |
| `POST /code-submissions/{id}/runs` | 提交版本、可选输入 → 隔离执行任务 | 4 |
| `GET /code-executions/{id}` | 状态、逐例期望/实际/错误/用量与 real/simulated 标记 | 4 |
| `POST /code-submissions/{id}/submit` | 提交版本、execution_id 可选 → 正式提交和评审任务，无须先运行 | 4 |
| `GET /code-submissions/{id}/review` | 进行中仅状态；结束后开放指定版本的定位、建议和运行依据 | 4 |

## 5. 实时事件合同

入口 `WSS /api/v1/interviews/{id}/stream`，同源登录或短时面试凭证鉴权。长期密钥不放 URL。目标信封为 `{type,interview_id,turn_id?,generation_id?,seq,payload}`；与原型 `StreamEvent.session_id` 的差异在后续客户端一并迁移。

seq 只表示本连接顺序，不作为跨重连持久事件游标。重连先读取面试与已封存回合，再协商新采集代；不重传全部音频。音频编码、采样率和分段格式由适配器协商。

| 方向 | 事件 | 行为 |
| --- | --- | --- |
| 客户端 → 服务端 | audio.input / audio.input.end | 带片段/顺序/时间的音频输入；ASR final 不等于答完 |
| 客户端 → 服务端 | user.answer.commit / user.answer.append | 明确答完或误截续答，复用 HTTP 归属、状态、幂等及事务服务 |
| 客户端 → 服务端 | user.interrupt / audio.playback.progress | 先停浏览器播放再取消活动代，保存实际播放边界 |
| 客户端 → 服务端 | interview.finish / interview.interaction.settings | 复用结束和授权设置服务，不允许实时层另写业务状态 |
| 客户端 → 服务端 | video.input / video.input.end | 阶段 4，当场授权且启用镜头才接收 |
| 服务端 → 客户端 | transcript.partial / transcript.final | 临时字幕与原始最终识别，不提供润色后发送 |
| 服务端 → 客户端 | answer.endpoint.candidate / answer.committed | 候选端点可撤销，正式提交带 submission/revision |
| 服务端 → 客户端 | answer.appended / input.gap | 新 revision 或采集缺口，不能伪装连续流 |
| 服务端 → 客户端 | assistant.text.delta / audio.chunk | 仅当前有效且校验通过的面试官内容，保存生成全文和实际展示/播放范围 |
| 服务端 → 客户端 | assistant.cancelled / interview.state | 清旧队列并同步权威状态 |
| 服务端 → 客户端 | interview.interaction.updated | 同步授权设置及 capture generation，关闭立即停止对应采集/写入 |
| 服务端 → 客户端 | speech.observation.updated / vision.observation.updated / media.state / report.ready | 更新通知后重新读取；进行中不推反馈正文或能力分，轮询仍可用 |
| 服务端 → 客户端 | error | 错误、可否重试和降级信息 |

关闭、暂停、断线、结束后丢弃无效采集代和生成代的迟到帧。重新授权仅处理后续片段，不补录之前内容或延长已有期限。语速、停顿等定义见[观测口径](../algorithm/knowledge_and_agent.md#speech-metrics)。

## 6. 内部服务、维护与运行接口

Agent 不是浏览器可任意调用的总入口。简历提取、JD 分析、岗位顾问、面试规划、面试官、报告评估和比较都通过内部类型化能力传入必要上下文、材料/回答版本、允许来源与取消信号，返回结构化内容、引用、用量和错误。检索由 KnowledgeService 过滤发布内容后执行；模型不直接写库、shell 或任意访问 URL。

知识维护第一轮使用授权命令，分别处理分类/模板、来源、知识正文/片段、题目、标准，支持导入/校验/预览/审核/发布/撤回/回滚/复核及索引任务。内容类型有各自 schema，不建立无类型的 `/admin/content` 大入口。未来管理页面调用同一服务，再定义维护端 HTTP 合同。

最小角色为学生、内容维护者和运行维护者。维护角色只能管理共享内容或脱敏运行信息，不默认获得个人简历/回答读取权限；操作记录人、时间、对象与版本、结果。账号初始化、任务诊断/重试和指标第一轮通过受控命令，不公开队列管理 HTTP API。协议适配或 MCP 不自动授予权限。

## 7. 保存、权限与删除


身份采用 Better Auth 的受邀账号与服务端登录会话，生产使用 HttpOnly/Secure Cookie；写接口检查同源/CSRF，退出与过期立即失效。文件默认上限 10 MiB，仅可提取文本 PDF/DOCX，检查扩展名、实际类型与结构；拒绝密码文件、损坏文件、异常压缩，禁宏/脚本/外链加载，解析任务受资源限制。OCR 后续扩展，失败给手填入口。预览转换在受限进程进行。

| 数据 | 默认保存 | 删除/到期 |
| --- | --- | --- |
| library 原始简历、提取稿 | 私有保存至主动删除；新版本独立 | 删除文件、草稿、预览/下载缓存；默认指针清空，独立确认经历先说明保留 |
| temporary 文件与提取稿 | 默认不入库，自上传起最长 24 小时 | 清理文件/草稿/缓存；已确认经历和开始后的必要快照独立保存，源文件标不可用 |
| 原始音视频/短期缓冲 | 默认只作实时识别及派生计算 | 处理完成、结束、取消或断线丢弃，不进入长期备份 |
| 显式开启的私有复盘媒体 | 分别授权音频/视频、记录授权与媒体版本；自采集起最长 24 小时 | 到期或主动删除立即撤销访问并清理，后续不得假装回放或重算；不进入长期备份 |
| 确认经历、原始作答轨迹、ASR纠错、快照、代码、派生观测、报告与比较 | 保存至主动删除 | 在线访问立即失效，物理清理目标 24 小时内完成；媒体到期不等于派生记录自动删除 |
| PDF 导出 | 私有临时文件，生成起最长 24 小时 | 到期可重建；来源报告/会话删除立即撤销访问 |
| 运行日志/备份 | 脱敏日志 30 天，限权备份轮换最长 30 天 | 日志不保留全文；备份恢复须重放删除清单 |

上述期限为可配置设计默认值，尚未实现，不作为法律承诺。`PATCH /resumes/{id}` 在有效期内显式设置 `storage_scope=library`，并清除过期时间；不能对已清理文件承诺恢复。

删除简历文件不同于删除独立确认经历：前者解除经历的源文件引用并保留已确认内容，历史快照照常解释当时输入；入口说明这一点。若用户要求删除相关事实，应展示经历关联的会话/报告/比较等影响并确认级联。删除经历覆盖相关私有快照与派生记录；删除会话覆盖回合、原作答与纠错、代码、音视频观测、复盘媒体、报告、导出、比较、私有快照、关联任务和缓存。其他关联重练保留其独立回答，但移除被删来源原文和关系；包含被删经历事实者也按经历级联删除。所有在途任务提交前复查删除标记，不得复活数据。

删除后即时禁止访问，清理状态可查；不能宣称备份立即抹除。真实用户材料不进入 Git、默认评测集或公共日志；服务商只接收必要字段，其数据处理条件在试用前核验。

## 8. 合同与迁移验收

- 当前 Next.js 演示命令和页面 URL 不因文档修改而变化；真实 HTTP 客户端上线时一并替换旧私有路径，无自动上传或假联调。
- OpenAPI 与实现路由一致；列表分页、版本冲突、任务状态及错误体有合同测试，实时事件另测共享类型。
- 两账号覆盖列表、详情、预览、下载、任务、实时流和比较；维护角色不能读取私有材料。
- 两份简历的创建/复制/默认/经历切换、收藏去重、个人 JD 保存及配置携带可完成；开始前版本变化须重新确认。
- 提交成功后模拟模型断开、worker 重启及 outbox 重投，原回答只保存一次，下一题和报告不重复生效。
- 暂停、结束、追加、纠错与生成并发时，旧 generation/输入版本结果无效；12 分钟含暂停预算不因恢复而重置。
- 报告只在面后可读，未校准/零回答不填专业分数，not_observed 始终为空；校准后只对已观察维度平均。
- 原题重练与比较固定两份 revision，部分报告、模式差异、失效引用和媒体不可用有明确标记。
- 临时文件/媒体/PDF 期限、授权撤回、删除级联与备份恢复清单实际验证；任务不能复活已删材料。
- 代码真执行与模拟、执行完成与用例通过、静态点评与运行证据分别展示。

## 9. 实现顺序与未决接入条件

第一阶段落地身份、文本材料、岗位、面试、报告/重练、任务与数据库；第二阶段接文件、PDF、内容维护/混合检索及评分校准；第三阶段接实时语音/观测；第四阶段接可选代码、镜头、复盘媒体和管理页面。每阶段保留前阶段回归，具体门槛见[评测计划](../algorithm/evaluation.md)。

Fastify、Zod/OpenAPI、Drizzle/PostgreSQL、pg-boss worker、同源代理与 Better Auth 公共认证已建立。业务服务、文件和供应商尚待接入；pgvector 暂不安装。认证未启用时为 501，未登录为 401，依赖失效为 503，不能用合成结果冒充成功。

关联：[总体架构](architecture.md) · [功能需求](../requirements/functional_spec.md) · [知识与 Agent](../algorithm/knowledge_and_agent.md) · [工程目录](repository_structure.md)。

## 10. 已实现的公共骨架（2026-10-25）

Fastify 独立监听 3001；浏览器经 Next.js /api/v1 同源代理调用，原演示显式改为 /api/demo/v1。公共响应保留错误/分页合同；岗位游标绑定筛选、稳定排序及内容版本，正文和来源来自同一发布内容。

当前注册：GET /health、/health/ready、/capabilities、/job-categories、/job-templates、/job-templates/{id}、/tasks/{id}；development 另有 /openapi.json。任务查询需注入身份服务，未接入返回 501；身份服务确认未登录返回 401，他人和不存在任务统一 404。业务目标路由尚未批量注册。

### 模块数据归属与依赖

| 模块 | 主要实体 | 跨模块约定 |
| --- | --- | --- |
| accounts | 身份、角色、设置、默认简历指针 | 提供经过验证的身份；默认简历必须由 resumes 校验 |
| resumes | 简历/经历版本、文件、候选与确认 | 只提供本人选择的已确认版本；更新不改历史快照 |
| jobs | 个人 JD/分析、收藏 | 平台模板和来源由 knowledge 维护，jobs 只读查询 |
| interviews | 会话、快照、问题回合、回答 revision/片段、封存 | 唯一状态写入口；按版本读取材料，向 reports 提供封存输入 |
| reports | 报告版本、重练关联、比较、导出 | 读取封存输入；创建重练调用 interviews，不直接改会话表 |
| knowledge | 模板/来源/知识/题目/标准和索引版本 | 仅发布内容进入读取；个人材料不进入共享检索库 |

以下为逻辑 ER，五个公共实体和 AuthUser/AuthSession/AuthAccount/AuthVerification/AuthRateLimit 已迁移，其余业务表随模块建立；虚线表示跨模块的版本化服务引用，不要求现在创建跨模块 FK。Identity 对应已验证的 AuthUser 标识。

~~~mermaid
erDiagram
    AuthUser ||--o{ AuthSession : authenticates
    AuthUser ||--o{ AuthAccount : credentials
    AuthUser ||..|| Identity : provides
    AuthVerification {
        text id PK
        text identifier
        timestamptz expires_at
    }
    AuthRateLimit {
        text id PK
        text key UK
        integer count
        bigint last_request
    }
    Identity ||--o{ Resume : owns
    Resume ||--|{ ResumeVersion : versions
    ResumeVersion }o--o{ ExperienceVersion : selects
    Identity ||--o{ JobTarget : owns
    Identity ||--o{ Bookmark : owns
    Bookmark }o..|| JobTemplateVersion : references
    JobTemplateVersion }o--o{ SourceVersion : cites
    JobTemplateVersion ||--o{ KnowledgeChunk : scopes
    Identity ||--o{ Interview : owns
    Interview ||--o| MaterialSnapshot : freezes_on_start
    MaterialSnapshot }o..o| ResumeVersion : freezes
    MaterialSnapshot }o..o| JobTarget : freezes_version
    MaterialSnapshot }o..o{ ExperienceVersion : freezes
    MaterialSnapshot }o..o{ JobTemplateVersion : freezes
    Interview ||--o{ InterviewTurn : asks
    InterviewTurn ||--o{ AnswerRevision : records
    AnswerRevision ||--o{ AnswerSegment : preserves
    Interview ||..o{ ReportVersion : sealed_input
    ReportVersion }o..o{ AnswerRevision : cites
    Interview ||..o{ RetryRelation : source
    RetryRelation }o..|| Interview : retry
    AnswerRevision }o..o{ Comparison : compares
    ReportVersion ||--o{ Export : renders
    Task ||--|| OutboxEvent : dispatches
    Identity ||..o{ Task : owner_reference
    Identity ||..o{ IdempotencyRecord : scopes
    Identity ||..o{ AuditEvent : actor_reference
    WorkerHeartbeat {
        uuid id PK
        json supported_types
        timestamptz last_seen_at
    }
~~~

### 五张基础表和可靠性

- tasks：用户、版本化任务类型、业务键、输入摘要、必要 payload、状态、实际尝试次数/上限、结果引用、执行 token/租约和时间；(owner_id,type,key) 唯一。
- outbox_events：任务引用、pending/published、投递尝试、重试时间和发布时间；与 tasks 同事务，每任务一个 outbox。当前承载任务投递，尚非通用事件订阅系统。
- idempotency_records：用户、操作、键、输入摘要和响应；同作用域唯一。事务级 advisory lock 串行化同键请求，失败整体回滚。
- audit_events：操作者、动作、资源 ID、请求 ID、结果和时间；不存私有全文或原始错误。
- worker_heartbeats：实例 ID、支持任务类型、启动及最近心跳。仅表示进程存活，不承诺任何业务能力已接通。

owner_id 使用认证模块 AuthUser.id，不信任客户端输入。公共任务表暂不增加用户 FK，兼容内部处理和既有任务；业务表按模块需求增加约束。auth_users 保存邮箱、显示名和服务端角色；auth_accounts 保存 Better Auth 密码哈希；auth_sessions 保存到期会话；auth_verifications 预留组件核心 schema；auth_rate_limits 保存跨实例限流计数。内部实体采用服务端 UUID 和 UTC 时间。

任务 enqueueTask 接收业务事务，业务写入、tasks 和 outbox 一起提交。投递在独立事务领取 outbox，使用 FOR UPDATE SKIP LOCKED；队列不可用保留已提交任务，重投可能重复。外部调用不在业务事务里；runner 使用执行 token/60 秒租约，先调用处理器，再在短事务校验并执行结果 commit。处理器仍须检查本模块的输入版本、删除和 generation。默认最多两次实际执行（可配置 1–5），不保证外部请求严格只调用一次。

InternalEvent 定义事件 ID/type/schema_version、归属、资源版本、时间、request_id 和 payload，供跨模块合同使用；具体事件生产者与消费者随业务模块添加。资料删除、派生失效和关联清理按前文规则实现，骨架没有宣称这些业务已经可用。
