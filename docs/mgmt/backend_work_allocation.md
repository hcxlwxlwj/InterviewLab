# InterviewLab 后端功能分工与交付清单

版本：v0.1 · 更新：2026-10-19 · 状态：小组分工讨论稿，负责人、期限和供应商待确认。

## 1. 本轮目标与当前基础

将现有前端演示接成真实业务闭环：登录 → 维护简历/岗位 → 配置 → 面试 → 报告 → 单题重练 → 记录回看；随后完成实时语音主线。

当前已经有共享类型、确定性会话规则、公开岗位内容、请求校验和 API 骨架。公开岗位接口可读取 36 个模板、288 道问题及 72 条来源；个人资料仍使用标签页演示存储，业务写入未接入。接口路径列入清单不代表已实现。

本文件用于分配任务，不新增产品需求或直接修改接口合同。功能与验收依据：[功能规格](../requirements/functional_spec.md)、[用户故事](../requirements/user_stories.md)、[非功能规格](../requirements/nonfunctional_spec.md)。字段、状态与权限以[数据与接口](../software/data_and_interfaces.md)为准，代码位置见[工程目录](../software/repository_structure.md)。

## 2. 小组分配表

每包指定一名负责人和一名检查人。一个人可以承担多个包；检查人负责接口、测试与 PR 复核，不等于替负责人开发。

| 工作包 | 主要职责 | 负责人 / GitHub | 检查人 | 期限 | 首个可验收交付 |
| --- | --- | --- | --- | --- | --- |
| A 平台与账号 | 数据库、身份、权限、持久任务、公共合同 | 待分配 | 待分配 | 待定 | 两个用户的数据隔离、服务重启后数据保留 |
| B 个人材料 | 多简历、经历、解析、个人概览与偏好 | 待分配 | 待分配 | 待定 | 创建两份简历，编辑/复制/切换经历并真实保存 |
| C 岗位与知识 | 模板、收藏、个人 JD、RAG、内容版本、模型公共适配 | 待分配 | 待分配 | 待定 | 收藏并保存个人 JD，检索返回对应岗位与来源 |
| D 会话与面试官 | 配置、快照、状态、回答、提问/追问、恢复 | 待分配 | 待分配 | 待定 | 完成一场真实文字模拟，重复请求与刷新不丢回答 |
| E 报告与重练 | 证据分析、评分约束、重练比较、PDF | 待分配 | 待分配 | 待定 | 异步报告引用原回答，重练保留两次回答 |
| F 实时语音 | 网关、ASR/TTS、端点、打断、续答与独立观测 | 待分配 | 待分配 | 待定 | 听题—口头回答—自动保存—自然接话 |
| G 可选代码考核 | 隔离执行、提交、用例、版本与代码评审 | 待分配 | 待分配 | 待定 | 一种语言在隔离限额下真实运行并可取消 |
| H 联调与交付 | 异步前端客户端、端到端验收、部署与运行说明 | 待分配 | 待分配 | 待定 | 新环境按说明启动，完整用户路径通过 |

成员人数未提供，上表不是已确认安排。若为四人，可采用以下讨论起点；G 在基础闭环后另行指派，可选视觉也单独估量工作量。

| 成员占位 | 可合并的职责 | 实施顺序 |
| --- | --- | --- |
| 同学 1 | A + B | 先公共身份/数据库合同，再材料业务 |
| 同学 2 | C + 公共模型适配 | 先岗位/JD/内容读取，再检索与供应商适配 |
| 同学 3 | D + F | 先真实文字会话，再实时语音；这是较重的一组 |
| 同学 4 | E + H 的联调组织 | 先报告/重练，再组织整体验收与部署 |

各开发者编写自己功能的单元和接口测试；H 负责组织整体测试。部署、回归和代码检查可轮值，分配时根据成员能力重新平衡。

## 3. 实施阶段与依赖

| 阶段 | 交付范围 | 完成条件 |
| --- | --- | --- |
| M0 公共合同 | A 牵头，B/C/D/E/F 共同确认身份、类型、错误、分页、任务和事件格式 | 能用固定合成输入独立开发，接口与数据迁移责任明确 |
| M1 真实文字闭环 | 账号、文本简历、岗位/个人 JD、模型提问、保存回答、报告与重练 | 登录后跨刷新恢复；真实保存；引用、空值、权限、重试和删除通过 |
| M2 材料与输出完整性 | 文件上传/解析/确认、预览/下载、PDF、内容维护及失败恢复 | 原型对应入口具备真实行为，失败有明确反馈 |
| M3 实时语音 | ASR/TTS、端点、打断/续答、断线恢复、文字降级与语音观测 | 实时主流程通过；记录延迟、误截和恢复的验证结果 |
| M4 可选能力 | 代码隔离执行、可选视觉/私有媒体及管理页面 | 各自通过权限、资源与质量验收后开放 |

M1 文本闭环是联调过渡，不能作为实时面试产品完成的结论。F 可在 M0 后并行验证供应商与网关，但正式封存回答必须接入 D。摄像头、代码和媒体复盘分别通过能力开关启用。

依赖关系：A 提供身份/仓储/任务；B、C 提供确认材料与版本；D 组合 B/C 并通过模型适配生成问题；E 读取 D 封存回答；F 复用 D 的提交、取消与状态逻辑；G 提供独立执行证据给 D/E；H 贯穿各阶段。

## 4. 可领取任务与验收

### A：平台基础、账号与公共服务

| 编号 | 任务 | 交付与通过条件 |
| --- | --- | --- |
| BE-A1 | 确认认证和接口合同 | 明确受邀登录方案、登录会话、用户/维护角色、401/403；若增加开放注册或密码找回，再确认对应范围 |
| BE-A2 | PostgreSQL 与迁移基础 | 统一 ID/UTC/版本/索引/外键及迁移编号；空库可初始化，升级与备份恢复有步骤 |
| BE-A3 | 身份与资源权限 | owner 来自验证后的身份；详情、修改、下载、任务、实时流均检查归属；退出与过期失效 |
| BE-A4 | 持久任务执行 | 任务去重、领取锁、租约、重试与取消；进程重启可恢复；结果提交再次检查版本及删除标记 |
| BE-A5 | 公共错误与运行能力 | 统一错误、请求 ID、能力状态、限额与脱敏日志；密钥只在服务端 |
| BE-A6 | 删除与到期基础 | 区分文件/经历/会话/媒体删除；立即撤销访问，异步清理不复活数据；恢复备份重放删除记录 |

基础落在 `code/backend`；纯类型和端口放在 `code/core_engine`。A 维护迁移规范与公共接入方式，各包负责人实现自己所属业务表和仓储。

### B：个人中心、简历与经历

| 编号 | 任务 | 交付与通过条件 |
| --- | --- | --- |
| BE-B1 | 多文本简历 CRUD | 搜索、创建、编辑、重命名、复制、默认与删除；副本经历 ID 独立，只有一个合法默认 |
| BE-B2 | 经历及版本 | 增删、排序、个人贡献确认；简历正文与经历可事务保存；切换简历不携带无关经历 |
| BE-B3 | 上传与解析任务 | 校验 PDF/DOCX 类型、大小与结构；解析候选不自动确认；失败可重试、手填或无材料继续 |
| BE-B4 | 私有文件生命周期 | library/temporary 区分，临时显式入库，私有预览/下载、到期与删除按合同执行 |
| BE-B5 | 概览与偏好 | 总数由数据库统计，返回最近记录/常用材料；偏好只影响新配置；不把演示重置接成真实全量删除 |

依赖 A 的身份、存储和任务。输出已确认的简历/经历及具体版本给 D；不负责选择面试问题。

### C：岗位、个人目标与知识检索

| 编号 | 任务 | 交付与通过条件 |
| --- | --- | --- |
| BE-C1 | 模板与收藏 | 分类、搜索、实习/校招筛选、分页、详情、来源、收藏备注/关联简历；收藏去重 |
| BE-C2 | 个人 JD 与分析 | 粘贴或复制模板、CRUD、版本；分析区分 JD 原文、知识补充与推断；不能覆盖平台模板 |
| BE-C3 | 公共模型适配 | 与 D/E 确认结构化调用、流式、取消、超时、输出校验、版本及用量合同；D/E 分别负责自己的提示与业务校验 |
| BE-C4 | 版本化知识与检索 | 导入现有 JSON；按岗位/阶段/主题/难度/发布状态过滤；返回来源与版本，空检索不回退其他岗位 |
| BE-C5 | pgvector 接入与评测 | 本地检索保留为基线，验证切分/召回与引用；嵌入配置版本化，变更后可重建和切换索引 |
| BE-C6 | 内容维护 | draft/reviewed/published/retired、审核/回滚/到期清单；先用授权脚本，管理页面可后置 |

公开资料在 `docs/algorithm/content`，服务适配在 `code/backend`；个人材料不进入公共知识库。AI 类及 AI 产品每 30 天复核，其他每 90 天复核；题目和评分锚点须有内容复核，来源数量不能替代质量评测。

### D：会话、状态机与面试官

| 编号 | 任务 | 交付与通过条件 |
| --- | --- | --- |
| BE-D1 | 创建、配置与启动 | 检查岗位发布状态、材料归属/确认/版本；start 事务冻结 JD、模板、简历、经历、知识/题目等版本 |
| BE-D2 | 回答与回合轨迹 | 回答/跳过/澄清/重复问题共用服务；保存原始输入、实际模式与 revision；重复提交返回同一结果 |
| BE-D3 | 动态提问与追问 | 根据岗位、经历、刚完成回答和覆盖选择问题；区分个人/团队贡献，不编造项目事实；进行中不泄露答题要点 |
| BE-D4 | 控制与恢复 | 暂停、恢复、提前结束、离页/断线恢复、取消迟到生成；模型失败保留已保存回答 |
| BE-D5 | 时间与题量预算 | 默认 10/可选 5 分钟，最多 6 个主问题、每题最多 2 次追问；12 分钟含暂停/断线安全上限由服务端保障 |
| BE-D6 | 记录与删除 | 按岗位/简历/状态/时间分页；终态不重开；历史快照不随库内编辑变化，删除按生产级联规则执行 |

依赖 A、B、C。核心确定性规则放 `core_engine`，数据库、模型和实时 I/O 放后端。F 的语音提交不得另建一套会话状态。

### E：报告、评价、重练与导出

| 编号 | 任务 | 交付与通过条件 |
| --- | --- | --- |
| BE-E1 | 异步报告 | pending/generating/ready/failed；会话结束与报告就绪分开，支持失败/过期/部分报告恢复 |
| BE-E2 | 证据分析 | 点评、优势、缺口引用明确 turn/revision/原句；材料事实另行引用；参考表达不增加经历事实 |
| BE-E3 | 四维规则与校准 | 专业知识/项目表达/代码能力/逻辑表达；未观察为 null，零回答不评分；有复核锚点和校准结果后开放专业分数 |
| BE-E4 | 同题重练与比较 | 指定原题和回答版本创建新 mock；原新回答都保留，区分新增事实、表达变化及输入条件差异 |
| BE-E5 | PDF 与版本失效 | 导出固定版本，私有下载；回答纠错使旧报告/比较过期；旧任务不能覆盖新版本或已删对象 |

依赖 D 封存回答、C 知识/标准、A 任务与私有存储。F 的语音/视觉观测独立呈现，不进入四维专业总分。评分依据不足时先交付带证据的定性反馈和空值状态。

### F：实时语音及可选观测

| 编号 | 任务 | 交付与通过条件 |
| --- | --- | --- |
| BE-F1 | Node 实时网关 | 会话鉴权、事件信封、顺序、流量/缓冲限制、权威状态恢复，与 HTTP 共用 D 的业务服务 |
| BE-F2 | ASR 与端点 | 临时/最终字幕分开；思考停顿不立即判答完；端点确认自动封存，误截可追加并保留事件 |
| BE-F3 | TTS 与打断 | 分句播报、播放进度、取消；打断先停止播放，失效 generation 的迟到文本/音频丢弃 |
| BE-F4 | 故障与文字降级 | 授权失败、识别/播报失败、断线有明确路径；保留已封存回答，记录实际输入模式与缺口 |
| BE-F5 | 语音观测与纠错 | 语速/停顿/疑似口头语/音量音高窗口、质量、版本；低质量 unavailable；面后 ASR 纠错保留原文并使依赖结果过期 |
| BE-F6 | 可选视觉/私有媒体 | 分别授权、默认关闭、后续片段采集、私有回放/到期/删除；无原媒体不能伪造回放或重算 |

F1–F5 为实时主线，F6 单独排期。原始媒体默认临时处理；明确保存的复盘媒体按采集时间最长 24 小时，重连或重试不重置。只描述可观测声学/画面现象，不推断情绪、诚实或人格。

### G：可选代码考核

| 编号 | 任务 | 交付与通过条件 |
| --- | --- | --- |
| BE-G1 | 题目与提交 | 题目/用例/语言/限额版本，代码草稿与正式提交分开；关联所属会话与回合 |
| BE-G2 | 隔离执行 | 逐步接 C++/Python/Java，限制 CPU/内存/时限/进程/网络/输出，取消后终止并清理 |
| BE-G3 | 结果与代码评审 | 执行状态、用例结果与静态/模型评价分开；未运行明确标识，不能编造通过率 |
| BE-G4 | 生命周期 | 提交/执行 revision 对齐，迟到结果不覆盖新代码；详细点评仅面后开放 |

依赖 A、D、C 的模型公共能力，与 E 对接执行证据。真实执行必须由独立隔离能力提供，未验收前保持不可用状态。

### H：前后端联调、测试与部署

| 编号 | 任务 | 交付与通过条件 |
| --- | --- | --- |
| BE-H1 | 异步前端客户端 | 统一 HTTP/实时适配，逐步替换同步演示客户端；登录失效、加载、分页、错误与版本冲突有反馈 |
| BE-H2 | 主流程联调 | 两份简历 → 收藏/个人 JD → 配置 → 面试 → 报告 → 重练 → 记录回看；重新登录后仍可恢复 |
| BE-H3 | 自动与人工回归 | 权限隔离、幂等、任务恢复、引用、空值、断线/取消、删除竞态；各开发者提交本包测试 |
| BE-H4 | 环境与发布 | Web/网关/Worker/PostgreSQL/私有存储配置，启动与迁移步骤、示例环境变量、备份/恢复及回滚说明 |
| BE-H5 | 运行观测 | 分别记录延迟、成功率、失败原因、调用用量与预算；日志不含私有正文与密钥 |

## 5. 接口分配清单

路径统一加 `/api/v1`。`清单` 指代码 API_CONTRACT 已列出，`设计` 指详细数据文档已有、代码清单待补，`建议` 指需要小组先确认的补充合同。三者均不表示已实现真实业务。

### A/B：账号与材料

| 方法 | 路径 | 负责 | 依据/说明 |
| --- | --- | --- | --- |
| POST | `/auth/login`、`/auth/logout` | A | 建议，随认证方案确认 |
| POST | `/auth/register`、`/auth/password/reset-request`、`/auth/password/reset` | A | 条件性建议，开放注册/密码方案确定后再纳入 |
| GET / PATCH | `/me` | A | 建议，身份及基本资料 |
| DELETE | `/me/data` | A 协调各包 | 设计，清理私有数据，不等同注销账号 |
| GET | `/tasks/{id}` | A | 建议，只能读取本人任务 |
| GET | `/health` | A | 已有骨架，生产限制暴露信息 |
| GET | `/me/overview` | B | 建议，实际总数与最近记录 |
| GET / PATCH | `/me/preferences` | B | 清单 |
| GET / POST | `/resume-documents` | B | 清单，文本创建或文件上传 |
| GET / PATCH / DELETE | `/resume-documents/{id}` | B | 清单；编辑正文和经历的事务边界在 M0 确认 |
| POST | `/resume-documents/{id}/duplicate` | B | 建议，当前前端有复制功能 |
| POST | `/resume-documents/{id}/confirm` | B | 清单 |
| POST | `/resume-documents/{id}/set-default` | B | 清单 |
| POST | `/resume-documents/{id}/save-to-library` | B | 清单 |
| POST | `/resume-documents/{id}/parse/retry` | B | 建议，解析失败重试 |
| GET | `/resume-documents/{id}/preview`、`/resume-documents/{id}/download` | B | 清单，逐资源鉴权 |
| GET / POST | `/experiences` | B | 清单，按简历版本筛选 |
| PATCH / DELETE | `/experiences/{id}` | B | 清单，确认/排序/删除影响 |

### C：岗位与个人目标

| 方法 | 路径 | 依据/说明 |
| --- | --- | --- |
| GET | `/job-categories` | 清单 |
| GET | `/job-templates` | 清单，search/category/stage/limit/cursor |
| GET | `/job-templates/{id}`、`/job-templates/{id}/sources` | 清单 |
| GET / POST | `/me/bookmarks` | 清单，用户+模板唯一 |
| PATCH / DELETE | `/me/bookmarks/{id}` | 清单，备注/简历/取消收藏 |
| GET / POST | `/job-targets` | 清单，个人 JD 或模板副本 |
| GET / PATCH | `/job-targets/{id}` | 清单，返回分析状态和版本 |
| DELETE | `/job-targets/{id}` | 建议，当前前端有删除操作 |
| POST | `/job-targets/{id}/questions` | 设计，带引用的岗位解释 |
| POST | `/job-targets/{id}/analysis/retry` | 建议，按当前版本重试分析 |

### D：会话与回答

| 方法 | 路径 | 依据/说明 |
| --- | --- | --- |
| POST | `/sessions` | 清单，创建 draft/ready |
| GET / PATCH / DELETE | `/sessions/{id}` | 清单，权威状态/开始前配置/删除 |
| POST | `/sessions/{id}/start` | 清单，校验并冻结快照 |
| POST | `/sessions/{id}/pause`、`/sessions/{id}/resume` | 清单 |
| POST | `/sessions/{id}/turns` | 清单，answer/skip/clarify_question/repeat_question |
| POST | `/sessions/{id}/turns/{turn_id}/append` | 设计，F 提供口头片段，D 封存 |
| PATCH | `/sessions/{id}/turns/{turn_id}` | 设计，面后识别纠错；与 F/E 协作 |
| PATCH | `/sessions/{id}/interaction-settings` | 清单，与 F 共用授权和设置事务 |
| POST | `/sessions/{id}/finish` | 清单，结束并提交 E 的报告任务 |
| GET | `/history` | 清单，岗位/简历/状态/时间/游标 |

### E：报告、重练与 PDF

| 方法 | 路径 | 依据/说明 |
| --- | --- | --- |
| GET | `/sessions/{id}/report` | 清单 |
| POST | `/sessions/{id}/report/retry` | 清单，失败/缺失/过期/部分报告 |
| POST | `/sessions/{id}/retries` | 清单，调用 D 创建关联 mock |
| POST | `/retry-comparisons` | 清单，锁定两份回答 revision |
| GET | `/retry-comparisons/{id}` | 清单 |
| POST | `/retry-comparisons/{id}/retry` | 建议，比较失败重试 |
| POST | `/reports/{id}/exports` | 清单，固定报告版本 |
| GET | `/exports/{id}` | 清单，状态 |
| GET | `/exports/{id}/download` | 设计，私有下载 |

### F：实时与观测

| 方法 | 路径 | 依据/说明 |
| --- | --- | --- |
| WSS | `/sessions/{id}/stream` | 设计，网关与 D 共用会话服务 |
| GET | `/sessions/{id}/turns/{turn_id}/speech-observations` | 设计 |
| POST | `/sessions/{id}/turns/{turn_id}/speech-observations/retry` | 设计，需要有效原音频 |
| GET | `/sessions/{id}/turns/{turn_id}/vision-observations` | 设计，可选 |
| POST | `/sessions/{id}/turns/{turn_id}/vision-observations/retry` | 设计，可选，需要有效原视频 |
| GET | `/sessions/{id}/review-media` | 设计，授权及到期元数据 |
| GET | `/review-media/{id}/playback` | 设计，私有且未过期 |
| DELETE | `/review-media/{id}` | 设计，立即撤销访问 |

事件信封为 `{type,session_id,turn_id?,generation_id?,seq,payload}`。seq 只代表本连接顺序，重连重新读取权威状态。鉴权方式、音频编码/采样率、帧大小、背压和授权字段在 M0 确认。

| 方向 | 事件 |
| --- | --- |
| 客户端 → 服务端 | `audio.input`、`audio.input.end`、`user.answer.commit`、`user.answer.append` |
| 客户端 → 服务端 | `user.interrupt`、`audio.playback.progress`、`session.interaction.settings`、`session.finish` |
| 客户端 → 服务端 | `video.input`、`video.input.end`，可选 |
| 服务端 → 客户端 | `transcript.partial`、`transcript.final`、`answer.endpoint.candidate`、`answer.committed`、`answer.appended`、`input.gap` |
| 服务端 → 客户端 | `assistant.text.delta`、`audio.chunk`、`assistant.cancelled`、`session.state`、`session.interaction.updated` |
| 服务端 → 客户端 | `speech.observation.updated`、`vision.observation.updated`、`media.state`、`report.ready`、`error` |

### G：代码考核

| 方法 | 路径 | 依据/说明 |
| --- | --- | --- |
| GET | `/sessions/{id}/code-tasks/{task_id}` | 清单，参数名 task_id 为明确化命名 |
| POST | `/code-tasks/{task_id}/submissions` | 清单 |
| POST | `/code-submissions/{id}/runs` | 清单 |
| GET | `/code-executions/{id}` | 清单 |
| POST | `/code-submissions/{id}/submit` | 设计，正式提交 |
| GET | `/code-submissions/{id}/review` | 设计，完整点评面后开放 |

### C/A：维护能力

现有设计只规定内部 `/admin` 能力范围，以下具体路径均为建议；授权脚本可先实现相同服务，不能把整套后台当作 M1 前置条件。

| 方法 | 路径 | 负责 |
| --- | --- | --- |
| GET / POST | `/admin/sources` | C |
| PATCH | `/admin/sources/{id}` | C |
| GET / POST | `/admin/job-templates` | C |
| GET / PATCH | `/admin/job-templates/{id}` | C，已发布版本只读 |
| POST | `/admin/job-templates/{id}/review` | C |
| POST | `/admin/job-templates/{id}/publish` | C |
| POST | `/admin/job-templates/{id}/retire` | C |
| POST | `/admin/job-templates/{id}/rollback` | C |
| GET / POST | `/admin/knowledge-documents` | C |
| GET / PATCH | `/admin/knowledge-documents/{id}` | C |
| POST | `/admin/knowledge-documents/{id}/index` | C |
| POST | `/admin/retrieval-preview` | C |
| GET | `/admin/content-review-due` | C |
| GET | `/admin/tasks`、`/admin/metrics`、`/admin/audit-logs` | A |
| POST | `/admin/tasks/{id}/retry` | A，业务包负责相应任务处理 |

## 6. 数据与内部合同负责人

以下为逻辑实体分组，不要求每个名字独占一张数据库表。数据建模与迁移在 M0 共同审核；公共 owner/version/任务/删除规范由 A 维护。

| 负责 | 数据范围 | 向其他包提供的合同 |
| --- | --- | --- |
| A | 用户、登录会话、角色、Job、Invocation、Audit、删除记录 | 已验证身份、仓储接入、任务去重/状态、错误与预算 |
| B | 简历及版本、经历及版本、偏好、私有文件元数据 | 读取指定确认材料、验证版本、预览/下载与删除影响 |
| C | 分类、模板/问题/标准版本、来源、知识文档/片段/向量、个人 JD、收藏 | 已发布检索结果及来源；JD 分析；公共模型协议 |
| D | Session、Turn、AnswerSegment、事件、必要材料快照 | 创建/启动/提交/取消/结束；读取封存回答及版本 |
| E | Report、RetryComparison、ExportJob | 报告输入摘要、证据引用、比较和固定版本导出 |
| F | AsrRevision、SpeechObservation、VisionObservation、ReviewMedia | 实际音频/转写轨迹、授权、质量、片段位置与可回放状态 |
| G | CodeTask、Submission、Execution、Review | 指定代码与执行版本的证据、用量与能力状态 |

Agent 分工：C 负责 JD 分析与检索，D 负责面试官，E 负责报告/比较，G 负责代码评审。模型公共适配由 C 统一，调用权限、保存、计时与终态由确定性业务程序控制。现有 `ModelAdapter.ask` 主要覆盖提问，报告/比较所需端口要先补充确认，不能假定已经完整。

跨包最重要的约定：B/C 不因编辑改写 D 的旧快照；F 的 ASR 纠错由 D 产生权威回答 revision 并通知 E 失效；G 的执行结果不能被 E 误写成模型推测；A 的删除/版本检查覆盖所有在途任务。

## 7. M0 必须共同确认的接口规则

1. 身份从验证后的登录上下文取得；所有私有详情、任务、文件和流检查归属，公共维护角色不自动获得学生材料权限。
2. 列表 `{items,next_cursor}`；明确筛选字段、排序和页大小。时间存 UTC，ID 不包含可猜测个人信息。
3. 错误 `{code,message,retryable,request_id}`；至少统一未登录、无权限、不存在、输入错误、版本冲突、状态冲突、超时、预算不足、能力未接入与任务失败。
4. 修改携带 version；创建/start/提交/finish/任务使用用户作用域幂等键，相同键不同输入返回冲突。
5. 异步接口返回资源/任务 ID 与状态，通常 202；GET 或通知读取最终结果，不能挂住普通 HTTP 请求等待整场面试。
6. 会话、报告、观测和执行分别管理状态；会话完成不代表报告 ready。旧异步结果提交前核对输入摘要与删除标记。
7. 配置页的创建与 start 为两个服务步骤；前端适配要明确衔接，不能直接照搬演示客户端“创建即开始”的行为。
8. 面试中只开放问题、作答与运行信息；评分、参考要点、完整表达观测和代码点评由服务端控制面后读取时机。
9. 删除文件、删除确认经历、删除会话和全量清理分开说明；原型删简历保留历史快照的行为不等于生产隐私清理已验收。
10. 任何新增/改名路径先同步数据合同、请求/响应类型与 API_CONTRACT，再各自实现；本文标为“建议”的路径不直接视为定稿。

## 8. 每包完成定义与交接

提交时附上：任务编号、负责接口、迁移/配置、请求与响应样例、正常/空值/失败用例、自动测试结果、未接入能力及联调步骤。一次 PR 尽量只交付一个可验收能力，关联对应任务。

| 验收项 | 提交要求 |
| --- | --- |
| 正常路径 | 合成输入可以复现，返回及数据库状态一致 |
| 权限与并发 | 跨用户、重复请求、旧版本、终态写入有覆盖 |
| 异步恢复 | 适用时覆盖失败重试、取消、进程恢复与迟到结果 |
| 引用与空值 | 适用时验证原句定位、未观察/零回答、实际模式与覆盖 |
| 删除与保留 | 适用时验证访问撤销、关联清理、到期和任务竞态 |
| 前端联调 | 使用异步真实客户端验证操作，显示加载和错误反馈 |
| 文档与工程 | `npm run check`、`npm run build`、`git diff --check`；有外部依赖时说明本地测试未覆盖的部分 |

最终主路径由 H 组织、各包共同验收：两个账号隔离 → 两份简历/经历 → 收藏模板/个人 JD → 配置并冻结 → 回答/暂停/恢复/跳过/结束 → 报告/重试 → 单题重练/比较 → 记录回看 → 删除与到期。实时阶段另测短暂停顿、误截续答、打断、迟到音频、断线及文字降级。

## 9. 第一次分工会议填写

- 参与人数、成员账号、每包负责人/检查人：待定。
- 登录方式、数据库/存储环境、模型与语音供应商、预算：待确认。
- M0 合同负责人、迁移编号和跨包类型修改规则：待确认。
- M1 演示日期、M2/M3 排期及 G/可选视觉是否纳入本次交付：待确认。
- 将 BE-A1 至 BE-H5 中实际领取的项登记到小组任务看板，填写验收条件和依赖；未分配与未实现均保持明确状态。
