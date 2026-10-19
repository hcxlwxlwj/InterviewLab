# 数据与接口概要

版本：v0.3 · 更新：2026-10-19 · 状态：逻辑合同与部分接口骨架；真实身份和持久化待接入，不是完整 OpenAPI。

## 当前实现位置

类型在 `code/core_engine/src/domain`，适配接口在 `src/ports.ts`；HTTP 清单、Zod 校验、响应和路由分别位于 `code/backend/src/http`。岗位注册表从公开内容包读取，浏览器个人资料由统一演示客户端管理。详见[工程目录](repository_structure.md)。

`GET /api/v1/job-templates`、岗位详情、来源、分类返回整理的公开资料；其他已支持读取仅为合成样例。写操作尚无真实服务，通过已覆盖的校验后返回 `501 capability_unavailable`。清单中的路由不保证都有读取实现；以接口测试及实际响应为准。同步 `DataClient` 是演示合同，真实 HTTP 客户端需要另建异步边界。以下持久化、身份、媒体与异步任务字段属于目标合同。

## 1. 公共边界

前缀统一为 `/api/v1`。ID 为服务端生成的不透明标识，时间存 UTC、界面按用户时区显示。`owner_id` 只取已验证身份，不能由客户端或模型指定。每次读取、预览、下载、修改、实时连接和比较均检查归属；维护权限单独授予。

个人资料不进入共享知识向量库。原始文件、提取候选、已确认经历、会话快照、原始作答轨迹、识别纠错、音视频观测、复盘媒体和报告为不同对象；模型提取不自动变成个人事实。学生确认仅表示认可记录，不代表系统核验其真实性。版本字段用于乐观并发控制与引用追溯，不允许新任务覆盖较新的人工修改。

## 2. 逻辑实体与最小接口字段

| 实体 | 必要字段/关系 | 行为约定 |
| --- | --- | --- |
| User/Profile | `id,display_name,locale,timezone` | 不强制采集学号、身份证、住址 |
| UserPreferences | `interaction_mode,editor_theme,default_job_direction,version` | 默认 realtime_voice、编辑器跟随系统、岗位未指定；偏好不是麦克风/摄像头授权，不自动采集 |
| JobTarget | `id,title,jd_text/template_id,source_refs,requirements,confirmed,version` | 明文要求、知识补充、推断分开；模板标通用参考 |
| ResumeDocument | `id,name,version,is_default,storage_scope,parse_status,file_type,private_locator,created_at,expires_at?,extraction_revision` | `storage_scope=library\|temporary`；同一逻辑简历的文件替换产生新版本，不能改写旧会话依据 |
| Experience | `id,title,kind,personal_role,actions,technical_decisions,results,evidence_refs,confirmed,version,resume_document_id?,resume_document_version?` | `kind=course_project\|competition\|research\|graduation_project\|internship\|other`；结果可定性或缺失，不补造指标 |
| EvidenceRef | 来源对象/版本、页/段/代码位置、必要摘录、来源类型 | 原文引用精确可定位；已清理源文件标“原文件不可用”，确认摘要仍可追溯 |
| KnowledgeDocument/Chunk | 来源、适用岗位、授权、获取/审核时间、发布与文本版本、片段定位、嵌入配置 | 仅发布内容进入新检索，学生材料不混入 |
| Question/Rubric | 题意、目标维度、难度、追问方向、0～100 锚点、证据规则、版本 | 内容与标准在会话开始时冻结，`not_observed` 不等于零分 |
| Session | `id,mode,interview_type,status,job_target_id,resume_document_id?,focus_experience_ids,material_snapshot,configuration,version,parent_session_id?,parent_turn_id?` | `mode` 仅 `mock`；材料快照含具体版本，重练来源单独关联 |
| Turn | `id,session_id,main_question_index,follow_up_index,parent_turn_id?,question_text,generation_id,presented_text_range,playback_progress,input_mode,answer_segments,asr_revision,answer_text,revision,submission_id` | 主问题与追问分开；answer_text 来源于自动封存的原转写或标明模式的文本回答，不能润色覆盖口头作答 |
| AnswerSegment | `id,turn_id,seq,started_at,ended_at,source,raw_asr_text?,text?,capture_status,endpoint_event_id?,append_to_segment_id?` | source 为 audio 或 text；保存原识别/文本、时间轨迹、误截追加与采集缺口，媒体删除后仍不伪称可回放 |
| AsrRevision | `id,turn_id,base_revision,revision,segment_id,text_range,original_text,corrected_text,reason,created_at` | 仅面后更正识别错误；保留原识别和更正原因，不补充观点、事实或润色成新回答 |
| SpeechObservation | `id,turn_id,answer_revision,version,status,metrics,alignment,quality,algorithm_version,asr_version` | 语速、停顿、疑似口头语、音量/音高变化独立保存，原始作答与识别纠错均可追溯 |
| VisionObservation | `id,turn_id,answer_revision,version,status,intervals,observations,quality,algorithm_version,media_id?` | 仅描述画面质量、头部朝向、面部动作；低质量/低置信为 unavailable，不推断情绪、诚实、人格或技术能力 |
| ReviewMedia | `id,session_id,turn_id?,kind,version,status,consent_version,authorized_at,captured_at,private_locator?,expires_at,deleted_at?` | kind 为 audio/video；默认不保存，仅显式开启后私有保留自采集起最长 24 小时，删除/到期立即撤销访问 |
| CodeTask/Submission | 题目与用例版本、所属回合、`language,source_code,revision` | 语言 `cpp\|python\|java`，代码和执行输入受大小限制 |
| CodeExecution | `id,submission_id,submission_revision,status,execution_mode,test_results,resource_usage,limits_version,error?` | `execution_mode=real\|simulated`；真实执行状态与 Agent 点评分离 |
| CodeReview | 提交版本、执行结果版本、问题定位、推理点评、引用、标准版本 | 不能把静态点评说成通过用例，迟到结果不能覆盖新代码 |
| Report | `id,session_id,status,answer_version_digest,observation_version_digest,dimensions,overall_score,coverage,evidence,advantages,gaps,retry_targets,versions,is_partial` | 异步、多版本，引用回答/观测版本及片段时间；时间定位不保证原媒体仍可回放 |
| RetryComparison | 来源/重练会话、明确两份 turn/revision/片段、input_modes、目标缺口、共同标准、原新引用、变化、不可比原因、状态 | 不覆盖原回答；输入模式、设备/质量或口径不同的语音变化不能直接比较 |
| ExportJob | 报告 ID/版本、状态、私有 PDF 定位、到期时间 | 导出固定版本并标部分/过期/观察范围，下载检查归属 |
| Job/Invocation/Audit | 唯一任务键、输入版本、状态、尝试次数、脱敏请求、耗时/用量/错误 | 默认无个人材料全文、原音频、完整提示和密钥 |

`Session.interview_type=technical_qa|project_deep_dive|hr|mixed`，分别表示技术问答、项目深挖、HR 面和综合模拟。`configuration` 包括难度、`duration_minutes=5|10`（默认 10）、面试官风格、`code_assessment_enabled`、`interaction_mode=realtime_voice|text_fallback`（默认 realtime_voice）、`camera_enabled=false`、`review_media_enabled=false`。实时语音采用端点确认后的自动提交，不提供“编辑转写后发送”流程。摄像头、私有媒体保存均须分别显式开启并当场授权；关闭不影响四维专业评分。可在故障时切换 text_fallback，并在各 AnswerSegment/Turn 保留实际输入模式与切换事件。不提供实时评分配置；评分在面后集中展示。首版“综合”不承诺每场都包含代码题，代码考核由独立开关控制。

### 简历与经历选择规则

- `parse_status=uploaded|parsing|needs_confirmation|confirmed|failed`。`confirmed` 指学生审阅并保存认可的候选；未认可候选不进入事实视图。
- 只有 `library` 且 `confirmed` 的当前版本可设默认；每位用户至多一个默认。删除默认简历后置空，不自动切换到其他版本。临时文件即使确认也不会自动入库。
- 选择简历只自动提供该版本下已确认的经历。独立手填或其他简历经历须明确选择；不能在切换简历后偷偷保留不相关选择。
- 手填记录可无 `resume_document_id`，以明确确认状态进入会话；无简历、无经历也可开始通用问答，并说明个性化有限。
- 文件替换产生新 `ResumeDocument.version`，候选重新确认；名称/默认设置等元数据变更亦做并发检查。开始前检测所选版本变化，要求重新确认，不静默替换。

### 报告分数合同

`dimensions` 固定四键：`technical_knowledge`（专业知识）、`project_communication`（项目表达）、`coding_ability`（代码能力）、`logical_expression`（逻辑表达）。每项为 `{status: observed|not_observed, score: 0..100|null, evidence_refs, explanation}`。有足够相关回答才设 `observed`，其分数为整数；未观察项 score 必须为 null。

`overall_score = round(sum(observed.score) / observed_count)`，非负数的 .5 向上取整；同时展示已观察维度、题目覆盖与局限。零有效回答或零已观察维度时 `overall_score=null`。跳过、未选代码考核、提前结束与 ASR 故障不得自动记零分。语音、语调变化与镜头观测独立展示，不进入四维专业总分；该规则属于待人工校准设计，不代表职业资格或录用判断。

## 3. 状态、版本与竞态

| 对象 | 状态及规则 |
| --- | --- |
| 材料解析 | `uploaded → parsing → needs_confirmation → confirmed`，解析失败为 `failed`；手填无需伪造解析任务 |
| 知识内容 | `draft → reviewed → published → retired`；发布版本只读，撤回阻止新检索但旧出处附撤回说明 |
| Session | `draft → ready → in_progress → ending → completed`；`in_progress ↔ paused`，不可恢复故障进入 `failed`；开始前可回 draft，完成/失败不重开 |
| Report/Comparison/Export | `pending → generating → ready\|failed`，重试先回 pending，来源删除/过期则取消或作废，不发布结果 |
| CodeExecution | `queued → running → succeeded\|failed\|timed_out\|cancelled`；succeeded 仅表示任务执行结束，用例是否通过另列 |
| SpeechObservation | `pending → processing → ready\|unavailable\|failed`；质量不足为 unavailable，不填虚构指标 |
| VisionObservation | `pending → processing → ready\|unavailable\|failed`；摄像头未开、低质量/低置信为 unavailable，不生成负面评分 |
| ReviewMedia | `capturing → available → expired\|deleted`，采集失败为 failed；处理或上传未完成不提供假回放 |

`ready` 表示配置可开始，不代表已经冻结全部材料；`start` 事务再次验证材料归属、确认和版本后冻结。默认 10 分钟、可选 5 分钟，目标时间提示收尾；最多 6 主问题、各最多 2 追问，12 分钟总经过时间（含暂停与断线）强制取消生成/音视频采集并结束，封存已保存回答与带缺口标记的可用片段。未完成片段只用于带覆盖说明的有限分析，不静默当完整有效回答评分；无足够可判断内容仍未观察。用户离开不等于已完成，恢复先读服务端状态和剩余预算。

`completed` 只表示会话封存，报告可仍 pending/generating。`failed` 保持终态；有已保存回答可请求 `is_partial=true` 的报告，没有有效回答仅给记录与再开始入口。回答修订使旧报告、比较和文本对齐标过期；新任务按明确输入 revision 生成，提交前检查版本摘要，不覆盖较新结果。

ASR `partial` 只作临时字幕，`final` 是保留的原识别。端点检测先记录候选，结合静音、识别稳定性及显式“回答完毕”信号自动提交；短暂停顿不能立即判定答完。学生可思考、口头自纠、请求澄清或打断 AI；误截后追加口头片段，关联原回合并取消未完成的后续代，保留误截与恢复事件。AI 主动打断仅属于明确选择的风格，不得成为默认催答或频繁截断。

自动封存后不开放会话中的转写润色；面后 PATCH 仅处理 ASR 识别纠错并保留 AsrRevision。文本替代模式可独立完成，并保存其输入方式，不伪装成实时口语。暂停/取消/断线先保存已收妥片段与缺口，再停止采集，不把未收妥音频或迟到数据补成完整答案。问题全文、实际展示范围与语音已播放部分分开；从未展示且未播放的问题不计作已问。`generation_id` 失效后迟到的文本和音频不能重返正式显示或播放。

## 4. HTTP 接口

表中路径均加 `/api/v1`。异步请求返回对象状态与任务 ID（通常 202），不能把普通 HTTP 请求挂至整场面试结束。列表使用游标分页，响应 `{items,next_cursor}`；会话记录筛选字段为状态、岗位、时间，比较及报告仅返回当前用户可读对象。

| 方法与路径 | 主要输入 → 输出/约束 |
| --- | --- |
| `GET /job-templates` | 岗位/难度筛选 → 发布模板、版本及通用参考标记 |
| `POST /job-targets` | JD 或模板 ID/版本 → 岗位草稿、分析任务 |
| `GET/PATCH /job-targets/{id}` | 查看或确认/修订、version → 原文、解释、版本；不改变历史快照 |
| `POST /job-targets/{id}/questions` | 问题、目标版本 → JD/知识引用与依据不足说明 |
| `GET /resume-documents` | scope/解析状态/游标 → 简历卡片、名称、版本、默认与过期时间 |
| `POST /resume-documents` | PDF/DOCX、name、storage_scope → 文档、解析任务；配置页默认 temporary |
| `GET/PATCH /resume-documents/{id}` | 获取解析/元数据；name、version 或替换文件 → 当前信息/新文件版本 |
| `POST /resume-documents/{id}/confirm` | 候选 revision、认可/修订项 → 确认经历 IDs 与版本；不批量认可未选项 |
| `POST /resume-documents/{id}/save-to-library` | 文档版本、名称、幂等键 → 显式转入库；已过期不可恢复 |
| `POST /resume-documents/{id}/set-default` | 文档版本 → 原子切换默认；仅 library+confirmed |
| `GET /resume-documents/{id}/preview`、`/download` | 当前归属 → 限时私有预览/原文件响应；过期文件明确不可用 |
| `DELETE /resume-documents/{id}` | version → 文件/草稿清理任务；先说明独立确认经历保留 |
| `GET/POST /experiences` | 简历来源筛选/手填事实与 confirmed → 经历列表/新经历版本 |
| `PATCH/DELETE /experiences/{id}` | version、修订/确认，或级联影响确认 → 更新或删除任务 |
| `GET/PATCH /me/preferences` | 当前偏好/局部修改与 version → 新偏好；不改变已开始会话 |
| `POST /sessions` | mode=mock、岗位/简历/重点经历、配置、幂等键 → draft/ready 会话 |
| `PATCH /sessions/{id}` | 未开始配置、version → 更新选择；不允许进行中换材料或面试类型 |
| `PATCH /sessions/{id}/interaction-settings` | 进行中/暂停的interaction_mode、camera_enabled、review_media_enabled、version、分别授权/撤回及reason → 权威设置版本与事件日志；与WS共用服务 |
| `GET /sessions/{id}` | 会话 ID → 权威状态、配置、已封存回合、题号、时间预算、报告状态 |
| `POST /sessions/{id}/start` | version、选定材料版本、幂等键 → 冻结快照、in_progress、首题任务 |
| `POST /sessions/{id}/pause`、`/resume` | version → 新状态；暂停取消活动代，恢复核对预算 |
| `POST /sessions/{id}/turns` | question/turn ID、action、实际输入模式、片段/文本、revision/幂等键 → 保存结果与后续任务；语音端点自动提交与其共用服务 |
| `PATCH /sessions/{id}/turns/{turn_id}` | 仅已结束会话：旧 revision、识别错误区间、原文/更正、reason → AsrRevision 与新 revision；拒绝润色和新增回答事实，依赖结果过期 |
| `POST /sessions/{id}/turns/{turn_id}/append` | 原自动提交 revision、误截事件、口头片段 → 追加轨迹与新 revision；仅活动回合允许，不能覆盖原片段 |
| `POST /sessions/{id}/finish` | reason、version、幂等键 → ending/completed、报告任务状态 |
| `GET /sessions/{id}/report` | 当前状态 → pending/generating/ready/failed 或未请求说明，不假装同步返回完整报告 |
| `POST /sessions/{id}/report/retry` | 当前输入版本 → 缺失/失败/过期或中断部分报告任务；零回答不评分 |
| `POST /reports/{id}/exports` | report version、format=pdf → 导出任务 |
| `GET /exports/{id}`、`/download` | 任务 ID → 状态或私有 PDF；下载再次鉴权 |
| `POST /sessions/{id}/retries` | 原turn ID/revision、目标时间片段?、report version?、目标缺口 → 新mock会话及parent IDs，保存来源片段 |
| `POST /retry-comparisons` | 原/新turn IDs、两份revisions、原/新片段、实际input_modes、重练会话、共同标准 → 比较任务及可比性限制 |
| `GET /retry-comparisons/{id}` | 比较 ID → 状态、并列引用、变化及可比性限制 |
| `GET /history` | status/job/time/cursor → 自动保存的记录；未完成继续、完成看报告 |
| `DELETE /sessions/{id}` | version、删除影响确认 → 会话及派生清理任务 |
| `DELETE /me/data` | 显式确认 → 当前用户全部私有材料与记录清理；账号注销另行说明 |

会话 action 为 `answer|clarify_question|repeat_question|skip`，解释仅澄清题意；`request_hint`、`request_explanation` 和 `guided` 均不在当前模式中提供。跳过经同一服务保存标记，不伪造空回答参与评分。

运行设置变更只允许切换交互模式、关闭/分别重新授权镜头与媒体保存，不改变材料、题意、评分标准和时间预算；保存配置初始快照与逐次变更事件。关闭立即停对应采集/写入并使旧capture generation失效，迟到帧丢弃；关闭复盘保存不等于关闭临时识别/观测，已有媒体可另行删除。重新授权仅保存后续片段，不补录之前内容、不延长已有媒体expires_at。变更共享归属、version、幂等及事务检查，终态不能重新启动采集。

### 语音与代码补充接口

| 方法与路径 | 主要输入 → 输出/约束 |
| --- | --- |
| `GET /sessions/{id}/turns/{turn_id}/speech-observations` | 进行中仅处理状态/采集质量；结束后按回答版本返回指标、quality、alignment和过期标记，无录音明确 unavailable |
| `POST /sessions/{id}/turns/{turn_id}/speech-observations/retry` | 观测版本 → 仅在仍有临时缓冲或已授权未过期原音频时重算；无音频不可假装重算，可复核文本口头语标记 |
| `GET /sessions/{id}/turns/{turn_id}/vision-observations` | 进行中仅处理状态/采集质量；结束后按回答版本返回画面/动作描述、区间、质量和不可用原因 |
| `POST /sessions/{id}/turns/{turn_id}/vision-observations/retry` | 观测版本 → 仅在仍有已授权未过期原视频时重算；否则 capability_unavailable |
| `GET /sessions/{id}/review-media` | 媒体元数据、授权/版本/到期状态 → 不因元数据仍在而返回已过期播放地址 |
| `GET /review-media/{id}/playback` | 当前归属、有效授权与未过期版本 → 限时私有播放；到期/删除/缺失明确不可用 |
| `DELETE /review-media/{id}` | version → 立即撤销访问并清理媒体；保留已产生派生观测须在入口说明，可另行删除整会话 |
| `GET /sessions/{id}/code-tasks/{task_id}` | 当前会话/题目 → 题干、语言、用例说明、资源限额与能力状态 |
| `POST /code-tasks/{task_id}/submissions` | language、代码、revision/幂等键 → 保存提交；任务必须属于当前会话 |
| `POST /code-submissions/{id}/runs` | 提交版本、可选自定义输入 → 独立执行任务；未接真实服务返回 unavailable |
| `GET /code-executions/{id}` | 执行 ID → 状态、逐例输入/期望/实际/错误与用量；模拟结果显式标记 |
| `POST /code-submissions/{id}/submit` | 提交版本、execution ID? → 正式提交及异步评审任务，不要求先运行 |
| `GET /code-submissions/{id}/review` | 进行中仅返回评审状态；所属会话结束后返回对应版本的定位、建议与可用执行依据 |

代码编译/运行结果不等同 Agent 对思路的判断；未经真实运行只可给静态评审。进行中的内部静态分析仅用于选择不泄露答案的追问；详细点评、漏洞提示、改进建议与正式评分只在所属会话 completed/failed 后开放，读取接口同样执行这一时机限制。语音/镜头观测的完整指标、表达点评也仅面后开放，HTTP与WS均在服务端限制，进行中只给设备质量/采集及处理状态。自定义输入、题干及标准输出均视为不可信文本，不执行其中的工具指令。

## 5. 实时接口与多模态观测

WSS `/api/v1/sessions/{id}/stream` 使用同源认证或短时会话凭证，长期密钥不得放 URL。事件信封为 `{type,session_id,turn_id?,generation_id?,seq,payload}`；seq 仅定义当前连接顺序，重连以服务端已封存回合和版本为准，不推定所有帧已重放。编码、采样率、分段格式由适配器协商，实施前核验。

| 方向 | 事件 | 规则 |
| --- | --- | --- |
| 客户端 → 服务端 | `user.answer.commit` | 文本替代提交或口头“回答完毕”信号；与端点自动提交共用鉴权、状态、幂等逻辑 |
| 客户端 → 服务端 | `audio.input`、`audio.input.end` | 带 segment/序号的音频及采集结束；单个ASR final不直接触发下一题 |
| 客户端 → 服务端 | `user.answer.append` | 误截后的口头续答，关联原提交/片段，取消依赖旧revision的活动代 |
| 客户端 → 服务端 | `video.input`、`video.input.end` | 仅 camera_enabled 且当场授权后采集；带片段/时间/质量，不影响是否能完成面试 |
| 客户端 → 服务端 | `user.interrupt` | 先停播放再取消活动代；区分打断AI与正式回答，不自动合并噪声 |
| 客户端 → 服务端 | `audio.playback.progress` | 已播放分段及文本边界，与生成全文分别保存 |
| 客户端 → 服务端 | `session.finish` | 复用 HTTP finish 服务，竞态时以终态为准 |
| 客户端 → 服务端 | `session.interaction.settings` | 运行模式/镜头/媒体授权或撤回，与HTTP interaction-settings共享事务、版本和事件日志 |
| 服务端 → 客户端 | `transcript.partial`、`transcript.final` | 临时/原始最终识别；字幕可见但不提供润色发送 |
| 服务端 → 客户端 | `answer.endpoint.candidate`、`answer.committed` | 候选端点与权威自动提交事件，包含 segment/submission/revision；短停顿候选可撤销 |
| 服务端 → 客户端 | `answer.appended`、`input.gap` | 误截恢复后的新revision或设备/断线缺口，不伪装连续流 |
| 服务端 → 客户端 | `assistant.text.delta`、`audio.chunk` | 仅当前有效 generation 可展示/播放 |
| 服务端 → 客户端 | `assistant.cancelled`、`session.state` | 清队列、同步权威状态与回合 revision |
| 服务端 → 客户端 | `session.interaction.updated` | 同步设置与capture generation，关闭立即停对应采集/写入，丢弃旧代迟到帧 |
| 服务端 → 客户端 | `speech.observation.updated`、`vision.observation.updated`、`media.state`、`report.ready` | 通知后重新读取；会话中仅状态与采集质量，完整观测在面后展示，不推送能力分；轮询仍须可用 |
| 服务端 → 客户端 | `error` | 业务错误、可否重试及文本降级入口 |

语速记录计算单位（首版中文有效字符/分钟）、有效时长及排除规则；停顿记录区间、阈值配置及检出置信；疑似口头语标记文本区间。音量和音高变化只描述可观测趋势，注明设备增益、噪声、清浊音及算法限制，不推断情绪或自信。视觉仅记录画面质量、头部朝向、面部动作等候选描述，缺脸、遮挡、光线差或置信不足标 unavailable，不评判眼神动机、诚实或人格。

阈值和效果待阶段 B 样本校准，不能写成诊断标准。观测携带原 ASR、识别纠错对齐、音视频时间区间、噪声/断线和覆盖信息；纠错后无可靠映射的指标标 unavailable。原音视频默认临时处理后清除；显式开启私有复盘保存也自采集起最长 24 小时，分片各自记录captured_at并计算expires_at。片段时间定位可以保留，但到期后不能伪造可回放或重新计算。媒体失败仅标该片段质量，不记为学生表现不足。

## 6. 幂等、错误与资源预算

创建、确认、回答、开始/结束、代码提交/运行和异步任务均使用用户作用域幂等键。重复相同键与输入返回原结果，键与不同输入冲突返回错误；任务唯一键为“对象 ID + 输入版本摘要 + 任务类型”。写操作校验归属、当前状态、version 和限额；比较的两份回答都须属于当前用户。

错误体 `{code,message,retryable,request_id}`，至少区分 `unauthorized/forbidden/not_found/unsupported_input/version_conflict/invalid_state/insufficient_material/provider_timeout/budget_exceeded/capability_unavailable/task_failed`。不泄露密钥、堆栈或他人资源是否存在。资料不足可以是正常内容结果，不强制作为网络故障。外部调用仅在预算允许且无成功结果时至多有界重试一次，失败保留用户已封存回答与确认材料。

代码限额、文件大小、上下文、任务领取超时和费用预算由受控服务端配置版本化。客户端和模型不能放宽执行限制；执行取消后隔离服务终止任务且迟到结果不得触发新追问或覆盖新版代码。HTTP/WS、后台作业、受控 Tools 使用同一权限/事务服务。

## 7. 保存、权限与删除

身份采用成熟认证组件、服务端会话、生产 HttpOnly/Secure cookie，写接口检查同源/CSRF，退出与过期立即失效。文件默认上限 10 MiB，仅可提取文本 PDF/DOCX，检查扩展名、实际类型与结构；拒绝密码文件、损坏文件、异常压缩，禁宏/脚本/外链加载，解析任务受资源限制。OCR 后续扩展，失败给手填入口。预览转换在受限进程进行。

| 数据 | 默认保存 | 删除/到期 |
| --- | --- | --- |
| library 原始简历、提取稿 | 私有保存至主动删除；新版本独立 | 删除文件、草稿、预览/下载缓存；默认指针清空，独立确认经历先说明保留 |
| temporary 文件与提取稿 | 默认不入库，自上传起最长 24 小时 | 清理文件/草稿/缓存；已确认经历和开始后的必要快照独立保存，源文件标不可用 |
| 原始音视频/短期缓冲 | 默认只作实时识别及派生计算 | 处理完成、结束、取消或断线丢弃，不进入长期备份 |
| 显式开启的私有复盘媒体 | 分别授权音频/视频、记录授权与媒体版本；自采集起最长 24 小时 | 到期或主动删除立即撤销访问并清理，后续不得假装回放或重算；不进入长期备份 |
| 确认经历、原始作答轨迹、ASR纠错、快照、代码、派生观测、报告与比较 | 保存至主动删除 | 在线访问立即失效，物理清理目标 24 小时内完成；媒体到期不等于派生记录自动删除 |
| PDF 导出 | 私有临时文件，生成起最长 24 小时 | 到期可重建；来源报告/会话删除立即撤销访问 |
| 运行日志/备份 | 脱敏日志 30 天，限权备份轮换最长 30 天 | 日志不保留全文；备份恢复须重放删除清单 |

上述期限为可配置设计默认值，尚未实现，不作为法律承诺。`save-to-library` 在有效期内执行，显式改变 scope 并清除过期时间；不能对已清理文件承诺恢复。

删除简历文件不同于删除独立确认经历：前者解除经历的源文件引用并保留已确认内容，历史快照照常解释当时输入；入口说明这一点。若用户要求删除相关事实，应展示经历关联的会话/报告/比较等影响并确认级联。删除经历覆盖相关私有快照与派生记录；删除会话覆盖回合、原作答与纠错、代码、音视频观测、复盘媒体、报告、导出、比较、私有快照、关联任务和缓存。其他关联重练保留其独立回答，但移除被删来源原文和关系；包含被删经历事实者也按经历级联删除。所有在途任务提交前复查删除标记，不得复活数据。

删除后即时禁止访问，清理状态可查；不能宣称备份立即抹除。真实用户材料不进入 Git、默认评测集或公共日志；服务商只接收必要字段，其数据处理条件在试用前核验。

## 8. 合同验收

- 重复确认/提交/start/finish/代码运行只产生一个对应业务结果，跨用户资源及实时流均不可访问。
- 切换简历不携带未选择的其他版本经历；取消确认与版本改变阻止静默开始；手填和无材料能正常进入通用模拟。
- library 不受 temporary 的 24 小时清理误伤；过期临时文件不能下载或偷偷转入库；删除默认文件不自动另选。
- 主问题/追问编号及 12 分钟含暂停上限一致；已完成会话与 pending/failed 报告分开显示。
- failed 部分报告保持失败终态，零有效回答总分为空；未考查代码维度 not_observed，四维均分只计观察项。
- 默认实时口头回答由端点确认自动提交，短暂停顿、澄清、口头自纠及误截续答不丢失；不能编辑润色替换口头原话。
- 面后识别纠错保留原识别/原因/revision，令报告/比较/对齐过期，旧任务不覆盖；原媒体已丢弃时不伪造回放或重算。
- 摄像头默认关闭，低质量/低置信标不可用；音量/音高和视觉描述不推情绪/人格/诚实，不进入四维总分。
- 可选复盘媒体分别授权、私有鉴权、版本和24小时到期/删除生效；报告时间定位与可回放状态分开。
- 原新回答比较固定具体 revision；新增事实不等于能力提升；引用必须逐字定位。
- 取消迟到音频不播、断线不重放全部帧；代码超限终止，模拟结果不标真实运行。
- 删除与备份恢复演练覆盖源文件、私有快照和派生数据，后台任务不重新写回。

关联：[总体架构](architecture.md) · [功能需求](../requirements/functional_spec.md) · [知识库与智能体](../algorithm/knowledge_and_agent.md) · [评测计划](../algorithm/evaluation.md)。

## 2026-10-19 原型合同扩展

新增JobCategory、版本化JobTemplate、KnowledgeQuestion、ContentSource、JobTarget、JobBookmark。ResumeDocument增加文本content、target_job、updated_at、is_sample及file_type=text；Experience支持毕设、实习和其他类型。Configuration保留job字符串并通过共享岗位注册表校验，增加模板/目标/简历版本、JD来源及实习/校招阶段。历史四个job ID仍有效。

公开读取增加 GET /job-categories、GET /job-templates/{id} 及 /sources；列表接受 search/category/stage/limit/cursor，沿用items/next_cursor。收藏合同为GET/POST /me/bookmarks、PATCH/DELETE /me/bookmarks/{id}；个人JD复用job-targets，文本简历POST /resume-documents使用source_type=text及结构内容。骨架写入仍返回capability_unavailable，当前无真实用户鉴权及私有服务。

Session.material_snapshot增加job_template、job_target及knowledge_sources，保留实际使用的题目来源和版本。改动材料或撤回模板不静默重写旧快照；重新练习使用原题和原快照。公开知识与个人材料分别由内容目录与演示状态维护，不相互混入检索。

演示状态schema=2，由统一客户端处理v1迁移、CRUD、版本冲突与失效关联；容量不足时保留最新内存状态并明确临时保存。当前删除库内文本简历会移除所属经历并解除未来选择，旧面试快照保留；这与未来全量清除私有材料的生产流程不同，不能把原型删除当作生产隐私清理已验收。
