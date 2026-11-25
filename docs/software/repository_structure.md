# 工程目录与文件职责

更新：2026-11-18。以下按当前仓库实际结构，完整列出 433 个 Git 跟踪文件及 81 个目录，每项后以 `#` 注释说明用途。`[id]`、`[slug]` 是 Next.js 动态路由参数；`.gitkeep` 是保留目录的空占位文件。

源码、配置、公开内容、文档、历史图片和测试文件均逐项展开。本地依赖、缓存、编译产物与临时运行数据在文末单独说明。

```text
InterviewLab/  # 面向高校学生的岗位模拟面试与复盘项目
├── .github/                # GitHub 协作模板、自动检查脚本与 CI 配置
│   ├── ISSUE_TEMPLATE/           # Issue 表单与入口配置
│   │   ├── bug.yml               # 缺陷反馈表单模板
│   │   ├── config.yml            # Issue 模板入口设置，允许创建空白 Issue
│   │   ├── task.yml              # 开发任务表单模板
│   │   └── teacher_feedback.yml  # 教师反馈与跟进事项表单模板
│   ├── scripts/                  # 仓库、内容和依赖边界的检查脚本
│   │   ├── check-boundaries.ts  # 检查工作区依赖方向、公开内容入口和前后端导入边界
│   │   ├── check-content.ts     # 校验岗位、问题、来源、版本、原创标识及复核周期
│   │   └── check_repository.py  # 检查课程要求的仓库结构、必需文件与本地 Markdown 链接
│   ├── workflows/                # GitHub Actions 自动验证流程
│   │   └── repository-check.yml  # CI 流程，执行文档、类型、内容、构建及后端集成检查
│   └── PULL_REQUEST_TEMPLATE.md  # PR 模板，要求说明改动结果、验证与待确认事项
├── code/                   # 应用源码与三个 npm 工作区
│   ├── backend/      # Fastify 后端、数据库、Agent、知识检索与异步任务
│   │   ├── drizzle/           # 业务数据库的版本化 SQL 迁移
│   │   │   ├── meta/                                 # Drizzle 迁移生成所需的结构快照与执行顺序记录
│   │   │   │   ├── 0000_snapshot.json  # 0000 阶段数据库结构快照，供 Drizzle 生成后续差异
│   │   │   │   ├── 0001_snapshot.json  # 0001 阶段数据库结构快照，供 Drizzle 生成后续差异
│   │   │   │   ├── 0002_snapshot.json  # 0002 阶段数据库结构快照，供 Drizzle 生成后续差异
│   │   │   │   ├── 0003_snapshot.json  # 0003 阶段数据库结构快照，供 Drizzle 生成后续差异
│   │   │   │   ├── 0004_snapshot.json  # 0004 阶段数据库结构快照，供 Drizzle 生成后续差异
│   │   │   │   ├── 0005_snapshot.json  # 0005 阶段数据库结构快照，供 Drizzle 生成后续差异
│   │   │   │   ├── 0006_snapshot.json  # 0006 阶段数据库结构快照，供 Drizzle 生成后续差异
│   │   │   │   ├── 0007_snapshot.json  # 0007 阶段数据库结构快照，供 Drizzle 生成后续差异
│   │   │   │   ├── 0009_snapshot.json  # 0009 阶段数据库结构快照，供 Drizzle 生成后续差异
│   │   │   │   ├── 0011_snapshot.json  # 0011 阶段数据库结构快照，供 Drizzle 生成后续差异
│   │   │   │   └── _journal.json       # 登记迁移标签、执行顺序、时间戳与语句断点
│   │   │   ├── 0000_lame_skin.sql                    # 建立任务、outbox、幂等、审计和 worker 心跳基础表
│   │   │   ├── 0001_far_the_spike.sql                # 建立账号、会话、认证账户、验证与登录限流表
│   │   │   ├── 0002_futuristic_genesis.sql           # 建立面试、回合、事件、报告、逐题评价及重练比较表
│   │   │   ├── 0003_curved_loki.sql                  # 增加生成流表、回合知识上下文与 Agent 记忆字段
│   │   │   ├── 0004_text_report_summary.sql          # 增加报告总结任务关联和总结输入摘要字段
│   │   │   ├── 0005_massive_marvex.sql               # 记录回答输入方式，区分文字与语音
│   │   │   ├── 0006_personal_materials.sql           # 建立账号设置、个人材料及材料版本表
│   │   │   ├── 0007_agent_preparation.sql            # 增加面试准备状态及简历分析记录表
│   │   │   ├── 0007_reset_report_scoring.sql         # 清理旧评分报告、相关任务与报告幂等记录，保留回答
│   │   │   ├── 0009_reconcile_agent_preparation.sql  # 补齐并行迁移合入时可能遗漏的面试准备和简历分析结构
│   │   │   ├── 0010_job_bookmarks.sql                # 建立用户岗位收藏表
│   │   │   └── 0011_voice_publication_activity.sql   # 增加语音输入活动状态，协调生成结果发布时间
│   │   ├── src/               # 后端源码
│   │   │   ├── content/      # 供工作区复用的公开岗位与知识内容适配入口
│   │   │   │   ├── index.ts   # 加载岗位、来源、专业基础和教师题库等公开内容
│   │   │   │   └── README.md  # 公共内容加载入口、数据来源和运行时边界说明
│   │   │   ├── database/     # 数据库连接、公共基础表结构与迁移执行
│   │   │   │   ├── connection.ts  # 创建 PostgreSQL 连接池、Drizzle、事务和就绪检查
│   │   │   │   ├── migrate.ts     # 通过数据库锁串行执行 Drizzle 迁移
│   │   │   │   └── schema.ts      # 定义任务、outbox、幂等、审计及心跳基础表
│   │   │   ├── entrypoints/  # API、worker、迁移及管理命令的进程入口
│   │   │   │   ├── api.ts          # 加载配置、启动 Fastify API 并注册退出清理
│   │   │   │   ├── create-user.ts  # 交互式创建受邀账号并显示一次随机初始密码
│   │   │   │   ├── environment.ts  # 加载仓库环境配置并统一处理进程退出
│   │   │   │   ├── migrate.ts      # 数据库迁移命令入口
│   │   │   │   ├── openapi.ts      # 离线生成已注册路由的 OpenAPI JSON
│   │   │   │   └── worker.ts       # 装配业务任务处理器并启动后台 worker
│   │   │   ├── foundation/   # 配置、认证接口、错误、校验与幂等基础能力
│   │   │   │   ├── auth.ts         # 统一校验会话身份、角色与写请求 Origin
│   │   │   │   ├── config.ts       # 校验环境变量并提供后端配置及默认值
│   │   │   │   ├── errors.ts       # 统一业务错误、错误响应及敏感异常隐藏
│   │   │   │   ├── idempotency.ts  # 计算输入摘要并在事务中实现请求幂等
│   │   │   │   └── schemas.ts      # 定义公共错误、分页、版本与异步任务响应 schema
│   │   │   ├── modules/      # 按业务划分的服务、路由、仓储与模块合同
│   │   │   │   ├── accounts/             # 账号认证、用户创建与个人设置
│   │   │   │   │   ├── auth-routes.ts   # 注册会话查询、邮箱注册、登录与退出接口
│   │   │   │   │   ├── auth-schema.ts   # 定义 Better Auth 用户、会话、账户、验证及限流表
│   │   │   │   │   ├── auth-service.ts  # 接入 Better Auth 并封装 Cookie 会话和认证操作
│   │   │   │   │   ├── provision.ts     # 事务内创建受邀账号、密码哈希及创建审计
│   │   │   │   │   └── settings.ts      # 读取和更新个人设置，校验默认简历归属
│   │   │   │   ├── interviews/           # 面试会话、准备、Agent 编排、流式提问与状态管理
│   │   │   │   │   ├── voice/                  # 实时语音会话、发布协调与供应商协议适配
│   │   │   │   │   │   ├── activity.ts    # 维护语音输入活动租约，等待补充输入后发布下一题
│   │   │   │   │   │   ├── routes.ts      # 注册语音能力查询与同源 Cookie 鉴权的 WebSocket 入口
│   │   │   │   │   │   ├── session.ts     # 管理实时语音会话、识别、回答提交、播报和打断
│   │   │   │   │   │   └── volcengine.ts  # 适配火山引擎流式 ASR/TTS 与二进制协议
│   │   │   │   │   ├── agent.ts                # 统一面试 Agent 入口，编排受限 LangGraph 提问工作流
│   │   │   │   │   ├── conversation.ts         # 识别回复行为、维护话题状态并约束对话提问
│   │   │   │   │   ├── events.ts               # 提供面试档案查询及带身份检查的 SSE 生成事件流
│   │   │   │   │   ├── experience.ts           # 建立经历证据边界，约束自我介绍、经历发现与追问
│   │   │   │   │   ├── frontend-reference.ts   # 按题目主题挂接前端专业复盘参考材料
│   │   │   │   │   ├── graph.ts                # 封装准备上下文、模型生成、输出校验三阶段 LangGraph
│   │   │   │   │   ├── knowledge.ts            # 将本地公开岗位内容适配为结构化面试知识接口
│   │   │   │   │   ├── memory.ts               # 校验并累计 Agent 的目标、观察、事实与原文证据记忆
│   │   │   │   │   ├── model-analysis.ts       # 定义模型输出校验与共享调用，接入报告分析和重练比较
│   │   │   │   │   ├── model.ts                # 通过 LangChain 适配兼容接口的 JSON 和流式模型调用
│   │   │   │   │   ├── participation.ts        # 识别持续未作答或退出意图并生成参与意愿确认问题
│   │   │   │   │   ├── preparation.ts          # 编排简历分析等待、个性化面前规划与简化流程任务
│   │   │   │   │   ├── question-policy.ts      # 校验题目符合面试类型，并确实提出新问题
│   │   │   │   │   ├── repository.ts           # 读写面试、回合、快照、记忆及任务关联的持久化状态
│   │   │   │   │   ├── response-assessment.ts  # 定义及校验回答资格、相关性、充分性和继续追问边界
│   │   │   │   │   ├── routes.ts               # 注册面试创建、推进、回答、结束、历史、删除及重练接口
│   │   │   │   │   ├── schema.ts               # 定义面试、回合、事件和生成流的数据库表
│   │   │   │   │   ├── schemas.ts              # 定义面试配置、操作请求和响应的 Zod schema
│   │   │   │   │   ├── service.ts              # 管理面试生命周期、异步推进、回答版本和报告衔接
│   │   │   │   │   ├── stream-parser.ts        # 增量解析模型 SSE、JSON 已完成字段与未完成字符串
│   │   │   │   │   ├── streaming-agent.ts      # 生成流式问题预览，选择下一步并校验目标、证据和提问
│   │   │   │   │   ├── streams.ts              # 持久化问题预览并通过 PostgreSQL 通知跨进程分发
│   │   │   │   │   └── workflow-models.ts      # 调用模型提取简历事实和生成面前规划，校验原文依据
│   │   │   │   ├── jobs/                 # 岗位查询、详情与本人收藏
│   │   │   │   │   ├── bookmarks.ts   # 注册岗位收藏、取消收藏与本人收藏列表接口
│   │   │   │   │   ├── repository.ts  # 封装公开岗位分类、模板、检索及来源的数据读取
│   │   │   │   │   ├── routes.ts      # 注册公开岗位分类、列表、详情与来源查询接口
│   │   │   │   │   ├── schema.ts      # 定义岗位收藏数据库表
│   │   │   │   │   └── service.ts     # 处理岗位筛选、分页、详情和来源查询业务
│   │   │   │   ├── knowledge/            # 全岗位知识目录、向量索引构建与混合检索
│   │   │   │   │   ├── all-roles.ts        # 加载全岗位知识发布版本并执行向量与关键词检索
│   │   │   │   │   ├── catalog-command.ts  # 提供知识库覆盖检查、迁移、构建、预览、发布和回滚命令
│   │   │   │   │   ├── catalog.ts          # 编译全岗位知识卡片、能力目标、适用绑定及版本清单
│   │   │   │   │   ├── embedding.ts        # 调用向量模型并校验返回数量、顺序和 1024 维向量
│   │   │   │   │   └── migrate-v2.sql      # 建立知识 v2 发布、向量、分块、适用绑定与索引
│   │   │   │   ├── reports/              # 逐题分析、报告汇总、建议与持久化
│   │   │   │   │   ├── agent.ts                # 用受限 LangGraph 编排报告评价、总结和建议生成
│   │   │   │   │   ├── aggregate.ts            # 确定性汇总逐题任务进度、评价、维度和报告结果
│   │   │   │   │   ├── analysis.ts             # 生成并校验逐题评价、证据评分、整场总结及练习建议
│   │   │   │   │   ├── IMPLEMENTATION_PLAN.md  # 记录文字复盘报告设计基线、实施阶段及后续范围调整
│   │   │   │   │   ├── README.md               # 说明报告当前实现、评分证据规则、接口和验收边界
│   │   │   │   │   ├── repository.ts           # 持久化报告、逐题任务和结果、总结关联及重练比较
│   │   │   │   │   ├── routes.ts               # 注册报告查询、生成重试与重练比较接口
│   │   │   │   │   ├── schema.ts               # 定义报告、逐题评价和重练比较数据库表
│   │   │   │   │   ├── schemas.ts              # 定义报告请求、评价进度和报告响应的 Zod schema
│   │   │   │   │   └── service.ts              # 编排报告封存、异步分析、汇总、建议、比较和重试发布
│   │   │   │   ├── resumes/              # 简历版本、确认、事实分析与服务接口
│   │   │   │   │   ├── analysis.ts  # 管理简历事实分析任务、版本缓存和结果发布
│   │   │   │   │   ├── pdf.ts       # 解析上传的 Base64 PDF 并提取有限长度文本
│   │   │   │   │   ├── routes.ts    # 注册个人材料、版本、PDF 文本导入及分析接口
│   │   │   │   │   ├── schema.ts    # 定义个人设置、材料、版本及简历分析数据库表
│   │   │   │   │   └── service.ts   # 管理个人材料的保存、版本、确认、删除与分析请求
│   │   │   │   ├── contracts.ts          # 定义后端模块注册、身份上下文与模块职责合同
│   │   │   │   └── interview-runtime.ts  # 装配面试、报告、简历、知识和准备服务及任务处理器
│   │   │   ├── server/       # HTTP 应用装配与公共中间件注册
│   │   │   │   └── app.ts  # 创建 Fastify 应用并装配公共中间件、依赖和业务模块
│   │   │   ├── tasks/        # 队列、事务 outbox、任务执行与 worker 调度
│   │   │   │   ├── outbox.ts   # 把事务内登记的 outbox 任务可靠投递到对应队列
│   │   │   │   ├── queue.ts    # 创建 pg-boss 队列连接并定义业务、报告和准备队列
│   │   │   │   ├── runner.ts   # 领取任务租约、执行处理器并校验取消与结果原子发布
│   │   │   │   ├── service.ts  # 事务内登记任务并提供有归属检查的任务状态查询
│   │   │   │   └── worker.ts   # 消费各类任务、维护心跳、投递 outbox 并执行维护循环
│   │   │   └── index.ts      # 导出后端应用工厂 buildApp
│   │   ├── .gitkeep           # 早期保留后端目录的空占位文件
│   │   ├── AGENTS.md          # 后端开发、模块边界、鉴权与任务处理规则
│   │   ├── compose.yaml       # 本地业务 PostgreSQL 与 pgvector 知识库容器配置
│   │   ├── drizzle.config.ts  # Drizzle 数据表来源、迁移输出及数据库连接配置
│   │   ├── package.json       # 后端包依赖、导出及开发、构建、迁移脚本
│   │   ├── README.md          # 后端能力、启动、认证、数据库及联调说明
│   │   └── tsup.config.ts     # 将 API 与 worker 入口构建为 Node.js ESM 产物
│   ├── core_engine/  # 不依赖框架的共享类型、领域规则与外部能力端口
│   │   ├── src/          # 领域核心源码与公共导出
│   │   │   ├── domain/                 # 面试与知识内容的领域数据类型
│   │   │   │   ├── interview.ts  # 定义基础面试类型、会话状态和历史评分维度类型
│   │   │   │   └── knowledge.ts  # 定义岗位模板、问题、来源、检索和搜索的数据结构
│   │   │   ├── agent-workflow.ts       # 定义简历分析、面前规划、岗位上下文和准备状态合同
│   │   │   ├── configuration.ts        # 提供面试状态和评价维度的中文显示标签
│   │   │   ├── feedback-template.ts    # 定义六维反馈模板、维度权重、观察项和提问覆盖目标
│   │   │   ├── foundation.ts           # 定义身份、认证、分页、错误、异步任务和能力查询的公共 DTO
│   │   │   ├── index.ts                # 统一导出领域核心的共享类型、常量与纯函数
│   │   │   ├── interview-agent.ts      # 定义面试 Agent 的能力卡、岗位画像、知识片段、记忆和检索合同
│   │   │   ├── interview-policy.ts     # 计算面试主题分配、题量约束和时间节奏策略
│   │   │   ├── interview-response.ts   # 定义回答意图、有效性、相关性、充分性和继续追问的判定结构
│   │   │   ├── knowledge.ts            # 将公开岗位内容转换为 JD 和知识条目，构建纯函数岗位目录
│   │   │   ├── live-interview.ts       # 定义真实面试与报告 DTO，并提供题序、时限、证据和页面路径规则
│   │   │   ├── performance-profile.ts  # 汇总同评分版本的有效报告，计算个人各维度表现
│   │   │   ├── personal.ts             # 定义个人设置及带版本的简历、经历材料数据结构
│   │   │   ├── question-scoring.ts     # 校验回答评分证据，计算逐题、整场和六维加权得分
│   │   │   ├── report-rubric.ts        # 定义前端岗位评分指标及历史指标评分的适用与聚合规则
│   │   │   ├── resume-template.ts      # 定义结构化简历字段、空模板及文本字段提取规则
│   │   │   └── voice.ts                # 定义语音能力、客户端命令和服务端实时事件协议
│   │   ├── .gitkeep      # 保留领域核心目录的 Git 占位文件
│   │   ├── package.json  # 定义 @interviewlab/core 工作区包及源码导出入口
│   │   └── README.md     # 说明领域核心的职责、依赖边界与共享合同
│   ├── frontend/     # Next.js 前端工作区
│   │   ├── app/                # App Router 页面路由、布局、状态页与全局样式
│   │   │   ├── interview/          # 面试配置及会话页面路由
│   │   │   │   ├── [id]/       # 按面试 ID 定位的会话页面
│   │   │   │   │   ├── analysis/  # 面试分析等待页面
│   │   │   │   │   │   └── page.tsx  # 读取面试 ID，挂载报告分析等待页面
│   │   │   │   │   ├── prepare/   # 面前准备页面
│   │   │   │   │   │   └── page.tsx  # 读取面试 ID，挂载设备与 Agent 准备页面
│   │   │   │   │   ├── video/     # 视频呈现页面
│   │   │   │   │   │   └── page.tsx  # 复用真实面试控制器，启用视频房间呈现
│   │   │   │   │   └── page.tsx   # 读取面试 ID，挂载真实面试控制器
│   │   │   │   ├── setup/      # 新建面试配置页面
│   │   │   │   │   └── page.tsx  # 通过 Suspense 挂载真实面试配置页面
│   │   │   │   └── layout.tsx  # 为面试路由提供跨页面共用的流程与媒体资源上下文
│   │   │   ├── jobs/               # 岗位列表与详情路由
│   │   │   │   ├── [slug]/   # 按岗位标识定位的详情页面
│   │   │   │   │   └── page.tsx  # 读取岗位标识并挂载岗位详情
│   │   │   │   └── page.tsx  # 通过 Suspense 挂载岗位模板库
│   │   │   ├── login/              # 账号登录与注册页面
│   │   │   │   └── page.tsx  # 提供独立登录注册页，登录后恢复目标页面
│   │   │   ├── me/                 # 个人中心页面路由
│   │   │   │   ├── interviews/   # 本人面试历史页面
│   │   │   │   │   └── page.tsx  # 挂载当前账号的面试历史页面
│   │   │   │   ├── preferences/  # 个人偏好入口（当前重定向至个人中心）
│   │   │   │   │   └── page.tsx  # 将旧偏好页面地址重定向至个人中心
│   │   │   │   ├── profile/      # 个人能力画像页面
│   │   │   │   │   └── page.tsx  # 在个人中心布局内挂载能力画像
│   │   │   │   ├── resumes/      # 本人简历列表与编辑路由
│   │   │   │   │   ├── [id]/     # 按材料 ID 定位的共用编辑工作区
│   │   │   │   │   │   └── page.tsx  # 在简历详情地址挂载共用材料工作区
│   │   │   │   │   └── page.tsx  # 挂载简历与经历材料管理工作区
│   │   │   │   ├── saved-jobs/   # 本人收藏岗位页面
│   │   │   │   │   └── page.tsx  # 挂载当前账号的收藏岗位页面
│   │   │   │   └── page.tsx      # 挂载个人中心概览
│   │   │   ├── reports/            # 报告与重练页面路由
│   │   │   │   └── [id]/  # 按面试 ID 定位的复盘报告页面
│   │   │   │       ├── practice/  # 从报告发起的同题重练页面
│   │   │   │       │   └── page.tsx  # 复用报告控制器，启用针对单题的重练模式
│   │   │   │       └── page.tsx   # 读取面试 ID，挂载面试复盘报告
│   │   │   ├── auth.css            # 定义登录与注册表单样式
│   │   │   ├── error.tsx           # 提供路由错误页面和重新加载入口
│   │   │   ├── globals.css         # 加载 Tailwind，定义主题变量、基础排版和全站公共样式
│   │   │   ├── layout.tsx          # 定义全站布局、元信息、字体、样式加载、会话与访问控制
│   │   │   ├── library.css         # 定义岗位库、个人中心和简历工作区等页面样式
│   │   │   ├── live-interview.css  # 定义真实面试流程、状态提示和报告基础样式
│   │   │   ├── loading.tsx         # 提供路由切换时的公共加载界面
│   │   │   ├── not-found.tsx       # 提供未匹配路由的 404 页面
│   │   │   ├── page.tsx            # 实现公开首页、推荐岗位、产品介绍和练习入口
│   │   │   ├── refinement.css      # 调整全站字号、间距、组件细节与响应式呈现
│   │   │   └── workspace.css       # 定义面试工作台、计时器、题目轨迹与对话布局样式
│   │   ├── components/         # 跨页面共享的业务组件与界面基础组件
│   │   │   ├── ui/                      # 通用 UI 基础组件
│   │   │   │   └── button.tsx  # 定义支持多种外观、尺寸和组合渲染的基础按钮
│   │   │   ├── account-access.tsx       # 拦截受保护页面，显示登录弹窗并在认证后恢复原目标
│   │   │   ├── account-controls.tsx     # 显示当前账号入口、登录状态和退出操作
│   │   │   ├── auth-form.tsx            # 实现邮箱密码登录、注册及成功后的会话刷新
│   │   │   ├── bookmark-button.tsx      # 通过真实书签接口查询并切换岗位收藏状态
│   │   │   ├── interview-setup.tsx      # 提供面试配置页公共布局和选项选择控件
│   │   │   ├── interview-workspace.tsx  # 提供计时、题目轨迹、对话、输入和结束操作的面试视图
│   │   │   ├── job-library.tsx          # 实现岗位库筛选、搜索、分页和岗位详情展示
│   │   │   ├── session-provider.tsx     # 管理公共账号会话，处理身份刷新、失效和跨标签页变化
│   │   │   └── shared.tsx               # 提供品牌、页头页脚、导航、弹窗、空状态和格式化工具
│   │   ├── features/           # 按产品功能组织的页面实现与交互逻辑
│   │   │   ├── live-interview/   # 面试配置、准备、实时作答、分析与复盘功能
│   │   │   │   ├── voice/                   # 浏览器采集、连接、播放与语音交互状态
│   │   │   │   │   ├── client.ts     # 实现语音 WebSocket 客户端、采音上送、事件处理与播放控制
│   │   │   │   │   ├── controls.tsx  # 提供语音采集控制、状态提示和未提交语音草稿恢复界面
│   │   │   │   │   ├── devices.ts    # 申请麦克风与摄像头、恢复音频上下文并释放设备资源
│   │   │   │   │   ├── playback.ts   # 调度 PCM 流式音频播放，处理打断和过期音频隔离
│   │   │   │   │   └── use-voice.ts  # 封装面试语音连接、转写草稿、服务端事件与模式切换状态
│   │   │   │   ├── analysis.tsx             # 跟踪报告生成进度，提供失败重试并在就绪后跳转报告
│   │   │   │   ├── common.tsx               # 提供会话门禁、资源读取、幂等命令及公共错误状态组件
│   │   │   │   ├── flow-provider.tsx        # 协调创建、准备、启动和跨路由语音摄像头资源的生命周期
│   │   │   │   ├── history.tsx              # 查询、分页展示、继续和删除当前账号的面试记录
│   │   │   │   ├── interview.tsx            # 协调真实面试状态、回答提交、流式提问、计时、语音及结束操作
│   │   │   │   ├── preparation.tsx          # 展示设备、简历和 Agent 准备进度，就绪后自动进入面试
│   │   │   │   ├── question-scores.tsx      # 展示逐题得分、独立重练历史和可比较的成绩趋势
│   │   │   │   ├── report-charts.tsx        # 绘制总分、能力雷达、得分分布、题目覆盖和维度评分视图
│   │   │   │   ├── report-design.css        # 定义报告模块、洞察卡片、逐题复盘与图表呈现样式
│   │   │   │   ├── report-export.ts         # 生成转义后的完整报告 HTML，并调用浏览器本地打印导出
│   │   │   │   ├── report-insights.tsx      # 展示本场评价、优势、优先提升项和行动计划
│   │   │   │   ├── report-progress.tsx      # 判断报告就绪状态、确定重试范围并展示各分析阶段进度
│   │   │   │   ├── report-standard.tsx      # 展示逐题报告适用的评分指标及其评价结果
│   │   │   │   ├── report.tsx               # 组织报告读取、总体评价、逐题复盘、重练、比较和打印功能
│   │   │   │   ├── review-advice.ts         # 统一提取逐题复盘的练习建议，避免重复展示目标与缺口
│   │   │   │   ├── review-conversation.tsx  # 展示完整问题与回答气泡，并折叠展开逐题分析
│   │   │   │   ├── setup-state.ts           # 切换岗位时按模板支持范围保留或调整求职阶段
│   │   │   │   ├── setup.tsx                # 读取真实岗位和个人材料，配置面试并发起准备流程
│   │   │   │   ├── start-request.ts         # 确认服务端状态后重试同一次启动请求，避免重复启动
│   │   │   │   ├── stream.ts                # 订阅面试 SSE 事件，更新提问预览与最新会话状态
│   │   │   │   ├── transition-screen.css    # 定义全屏准备和分析过渡动画、进度及减少动态效果样式
│   │   │   │   └── transition-screen.tsx    # 提供按真实完成阶段展示的全屏准备与分析过渡界面
│   │   │   ├── personal-center/  # 个人档案、材料、历史与收藏工作区
│   │   │   │   ├── live-workspace.tsx       # 展示个人中心快捷入口和最近面试记录
│   │   │   │   ├── materials-workspace.tsx  # 管理简历和经历的导入、结构化编辑、版本更新与确认
│   │   │   │   ├── profile-overview.tsx     # 按岗位汇总可比较的完整面试报告并展示个人能力画像
│   │   │   │   ├── saved-jobs-live.tsx      # 查询真实收藏岗位，支持查看详情、开始面试和取消收藏
│   │   │   │   └── workspace-frame.tsx      # 提供个人中心共用页头页脚、侧栏导航及内容框架
│   │   │   └── video-interview/  # 本机媒体预览与语音驱动的面试官呈现
│   │   │       ├── interviewer-avatar.tsx  # 按实际 TTS 播放状态驱动面试官双帧头像动画
│   │   │       ├── media-preview.tsx       # 稳定绑定和播放本地媒体流，避免频繁重建预览
│   │   │       ├── room.css                # 定义视频面试房间、媒体区域、控制栏和响应式布局
│   │   │       └── room.tsx                # 实现视频房间视图、摄像头与屏幕本地预览及语音控制
│   │   ├── lib/                # 前端访问控制、API 客户端与通用工具
│   │   │   ├── api/       # 同源 /api/v1 的认证、岗位与面试请求封装
│   │   │   │   ├── auth.ts        # 封装会话查询、注册、登录和退出接口
│   │   │   │   ├── http.ts        # 统一同源 HTTP、SSE、WebSocket 传输、超时、错误和会话失效通知
│   │   │   │   ├── interviews.ts  # 封装面试、准备、回答、报告、重练及比较等接口调用
│   │   │   │   └── jobs.ts        # 封装公开岗位模板列表、分类、详情和来源查询接口
│   │   │   ├── access.ts  # 校验可恢复的业务目标路径并判断页面是否需要登录
│   │   │   └── utils.ts   # 合并条件 CSS 类名并消除 Tailwind 样式冲突
│   │   ├── public/             # 可由浏览器直接访问的静态资源
│   │   │   ├── avatars/                  # 面试官形象资源
│   │   │   │   └── interviewer-reference-sprite.png  # 提供面试官头像双帧动画使用的精灵图
│   │   │   ├── fonts/                    # 本地字体与字体许可证
│   │   │   │   ├── interviewlab-sans.woff2  # 提供全站本地加载的可变字体
│   │   │   │   └── OFL.txt                  # 保存本地字体适用的 SIL Open Font License 授权文本
│   │   │   ├── images/                   # 首页与学习场景的配图资源
│   │   │   │   ├── interview-hero-wide.png  # 首页面试主题横幅背景图
│   │   │   │   └── study-desk.png           # 学习书桌场景图片素材
│   │   │   └── voice-capture.worklet.js  # 在音频工作线程中检测语音起止并输出 16 kHz 单声道 PCM16 数据包
│   │   ├── .gitkeep            # 保留前端目录的 Git 占位文件
│   │   ├── AGENTS.md           # 约束 AI 修改前端时的 Next.js 文档、认证、接口和依赖边界
│   │   ├── components.json     # 配置 shadcn/ui 风格、样式入口和组件路径别名
│   │   ├── next-env.d.ts       # 提供 Next.js 及自动生成路由的 TypeScript 类型引用
│   │   ├── next.config.ts      # 读取根环境配置，设置开发来源、工作区转译和后端同源代理
│   │   ├── package.json        # 定义前端工作区依赖及 Next.js 开发、构建、启动命令
│   │   ├── postcss.config.mjs  # 启用 Tailwind CSS 的 PostCSS 插件
│   │   ├── README.md           # 说明前端接入、账号会话、面试流程、启动方式和模块交付要求
│   │   └── tsconfig.json       # 继承根 TypeScript 配置并加入 Next.js 插件和路由生成类型
│   └── README.md     # 三个代码工作区的导航与职责说明
├── docs/                   # 需求、算法、软件、管理与复盘文档总目录
│   ├── algorithm/      # 知识、Agent、调研与算法评测说明
│   │   ├── content/                      # 公开岗位、原创问题、知识资料与来源数据
│   │   │   ├── archive/                        # 旧版岗位和来源数据的历史归档
│   │   │   │   ├── jobs-v1.json     # 初版 36 个岗位模板及原创面试题的历史归档
│   │   │   │   ├── jobs-v2.json     # 第二版 36 个岗位模板及面试内容的历史归档
│   │   │   │   └── sources-v1.json  # 初版岗位内容引用来源及核对状态的历史归档
│   │   │   ├── research/                       # 按日期及批次保留的来源调研记录
│   │   │   │   ├── sources-2026-10-19.json                # 首批 36 个岗位的招聘与官方资料调研记录
│   │   │   │   ├── sources-2026-10-28-batch2.json         # 第二批 48 个岗位的招聘详情及官方资料核对记录
│   │   │   │   ├── sources-2026-10-28-batch3.json         # 第三批 404 个岗位的招聘检索与官方资料参考记录
│   │   │   │   ├── sources-2026-10-28-batch4.json         # 第四批 100 个岗位的多平台招聘检索与官方资料参考记录
│   │   │   │   ├── sources-2026-10-28-batch5.json         # 第五批 400 个岗位的招聘检索与官方资料参考记录
│   │   │   │   ├── sources-2026-10-28-multiplatform.json  # 为 448 个岗位补充的多平台招聘交叉参考记录
│   │   │   │   └── sources-2026-10-28.json                # 新增 12 个岗位的招聘详情及官方资料核对记录
│   │   │   ├── categories.json                 # 岗位分类的标识与中文名称数据
│   │   │   ├── frontend-report-reference.json  # 前端报告参考卡片，包含知识要点、常见错误、适用边界及来源链接
│   │   │   ├── jobs.json                       # 当前岗位模板和原创问题库，包含岗位职责、能力要求、题目及来源关联
│   │   │   ├── professional-foundations.json   # 九类专业基础知识摘要及官方来源，供知识索引与检索使用
│   │   │   ├── README.md                       # 岗位内容库的结构、来源、维护规则及使用边界说明
│   │   │   ├── sources.json                    # 当前内容库的统一来源注册表，保存链接、出版方、用途和核对状态
│   │   │   └── teacher-agent-questions.json    # 教师提供的 Agent 岗位面试题及原始来源信息
│   │   ├── evaluation.md                 # 评测方案、固定案例、成本与验收门槛，以及已验证结果和剩余缺口
│   │   ├── frontend-scoring-standard.md  # 前端实习岗位行为锚定评分草案及证据、覆盖率和校准规则
│   │   ├── knowledge_and_agent.md        # 知识来源、检索、材料事实边界、动态提问与报告评分的方法设计
│   │   ├── README.md                     # 算法、技术调研、评测和岗位内容资料的导航
│   │   └── research.md                   # 技术与竞品调研、用户假设和模型及 Agent 框架选型依据
│   ├── mgmt/           # 项目管理、团队协作、沟通与风险计划
│   │   ├── COLLABORATION.md            # 分支、提交、Issue、PR 与团队日常协作约定
│   │   ├── communication_mgmt_plan.md  # 团队沟通内容、频率、渠道和责任角色的安排
│   │   ├── project_management.md       # 任务与 Issue 管理、验收流程及历史协作入口
│   │   ├── README.md                   # 团队计划、项目管理、沟通和风险文档的导航
│   │   ├── risk_mgmt_plan.md           # 项目风险登记、应对措施与 API 额度预案
│   │   └── team_plan.md                # 团队角色职责、阶段任务与历史第一周计划
│   ├── requirements/   # 问题定义、用户故事及功能与非功能需求
│   │   ├── functional_spec.md     # 功能需求编号、行为规则、页面流程、验收条件及后续目标
│   │   ├── nonfunctional_spec.md  # 隐私、安全、性能、可靠性、可用性及 Agent 工程约束
│   │   ├── problem_definition.md  # 目标用户、使用场景、问题定义、产品定位和成功标准
│   │   ├── README.md              # 需求文档导航，说明产品目标与当前实现的阅读边界
│   │   └── user_stories.md        # 按用户场景组织的需求故事与验收步骤
│   ├── retrospection/  # 按日期保留的过程复盘、教师反馈与提交记录
│   │   ├── evidence/                              # 阶段验证结果的 JSON 证据
│   │   │   ├── agent-model-20261104.json               # 新旧 Agent 在合成回答上的模型对照原始记录及实验限制
│   │   │   ├── agent-model-data-recheck-20261104.json  # 数据岗位 Agent 对照问题复测的原始记录
│   │   │   ├── background-validation-20261104.json     # 已知本人职责下背景问题判定的复现输出与修复说明
│   │   │   └── knowledge-embedding-20261104.json       # 九类基础摘要真实嵌入检索的冒烟检查记录
│   │   ├── 2026-10-15-scope-revision.md           # 产品定位、文档结构及实时口头面试目标的修订记录
│   │   ├── 2026-10-19-course-layout.md            # 按课程模板收拢仓库目录的路径迁移记录
│   │   ├── 2026-10-19-docs-consolidation.md       # 将文档归并为课程五类目录的整理记录
│   │   ├── 2026-10-19-materials-and-content.md    # 个人材料工作区和岗位内容库扩展的过程记录
│   │   ├── 2026-10-19-repository-organization.md  # 课程结构对齐、代码职责拆分与回归核对记录
│   │   ├── 2026-11-04-agent-engineering.md        # 全岗位 Agent 工程化、受控实验、问题修复和待验收事项记录
│   │   ├── 2026-11-05-runtime-cleanup.md          # 旧 Agent、演示入口和过期测试清退及最终验证记录
│   │   ├── README.md                              # 第一周初始化历史记录及后续迭代复盘导航
│   │   ├── teacher_feedback.md                    # 教师反馈、用户确认决定及对应处理记录
│   │   └── week1_submission.md                    # 第一周提交清单、证据核对和可复制的提交文本历史记录
│   ├── software/       # 架构、接口、开发部署与功能实现文档
│   │   ├── prototype/                            # 原型设计、实现说明和视觉验收材料
│   │   │   ├── references/           # 界面设计参考图
│   │   │   │   ├── home.png                   # 首页布局与配色的 AI 生成视觉参考图
│   │   │   │   ├── interview.png              # 面试双栏布局与代码区域的 AI 生成视觉参考图
│   │   │   │   ├── job-detail-v3.png          # 岗位详情页的第三版 AI 生成视觉参考图
│   │   │   │   ├── jobs-catalog-v3.png        # 岗位目录页的第三版 AI 生成视觉参考图
│   │   │   │   ├── personal-center.png        # 个人中心记录与简历分区的 AI 生成视觉参考图
│   │   │   │   ├── personal-workspace-v3.png  # 个人工作区的第三版 AI 生成视觉参考图
│   │   │   │   ├── report.png                 # 分析报告布局的 AI 生成视觉参考图
│   │   │   │   └── setup.png                  # 面试配置表单及摘要的 AI 生成视觉参考图
│   │   │   ├── screenshots/          # 不同版本、终端和场景的实际界面截图与布局检查结果
│   │   │   │   ├── code-desktop.jpg                          # 历史代码答题面板的桌面截图
│   │   │   │   ├── comparison-desktop.jpg                    # 历史重练回答对照界面的桌面截图
│   │   │   │   ├── empty-records-mobile-v3.jpg               # 第三版面试记录空态的手机截图
│   │   │   │   ├── home-desktop-v2.jpg                       # 第二版首页的桌面截图
│   │   │   │   ├── home-desktop.jpg                          # 初版首页的桌面截图
│   │   │   │   ├── home-mobile-v2.jpg                        # 第二版首页的手机截图
│   │   │   │   ├── home-mobile.jpg                           # 初版首页的手机截图
│   │   │   │   ├── interview-desktop.jpg                     # 历史面试会话界面的桌面截图
│   │   │   │   ├── interview-mobile.jpg                      # 历史面试会话界面的手机截图
│   │   │   │   ├── interview-participation-confirmation.png  # 面试参与提醒与确认弹窗的回归截图
│   │   │   │   ├── interviews-desktop-v3.jpg                 # 第三版面试记录列表的桌面截图
│   │   │   │   ├── interviews-mobile-v3.jpg                  # 第三版面试记录列表的手机截图
│   │   │   │   ├── job-detail-desktop-v3.jpg                 # 第三版岗位详情页的桌面截图
│   │   │   │   ├── job-detail-mobile-v3.jpg                  # 第三版岗位详情页的手机截图
│   │   │   │   ├── jobs-desktop-v3.jpg                       # 第三版岗位库的桌面截图
│   │   │   │   ├── jobs-mobile-v3.jpg                        # 第三版岗位库的手机截图
│   │   │   │   ├── layout-audit-v3.json                      # 第三版多视口布局检查的页面宽度与视口测量数据
│   │   │   │   ├── live-conversation-v2.png                  # 接入真实模型后的历史对话式面试截图，使用合成经历
│   │   │   │   ├── live-ecnu-plus-comparison.png             # 真实模型生成的原回答与重练回答比较截图，使用合成材料
│   │   │   │   ├── live-entry-clarity.png                    # 真实面试入口说明界面的历史截图
│   │   │   │   ├── live-original-interview.png               # 原面试布局接入真实模型后的界面截图
│   │   │   │   ├── live-original-setup.png                   # 真实面试配置沿用原布局的界面截图
│   │   │   │   ├── live-report-desktop.png                   # 真实面试报告界面的桌面截图
│   │   │   │   ├── live-setup-mobile.png                     # 真实面试配置界面的手机截图
│   │   │   │   ├── personal-center-desktop-v2.jpg            # 第二版个人中心的桌面截图
│   │   │   │   ├── personal-center-desktop-v3.jpg            # 第三版个人工作区概览的桌面截图
│   │   │   │   ├── personal-center-desktop.jpg               # 初版个人中心的桌面截图
│   │   │   │   ├── personal-center-mobile-v3.jpg             # 第三版个人工作区概览的手机截图
│   │   │   │   ├── personal-center-mobile.jpg                # 初版个人中心的手机截图
│   │   │   │   ├── report-desktop-v2.jpg                     # 第二版分析报告的桌面截图
│   │   │   │   ├── report-desktop-v3.jpg                     # 第三版分析报告的桌面截图
│   │   │   │   ├── report-desktop.jpg                        # 初版分析报告的桌面截图
│   │   │   │   ├── report-mobile-v3.jpg                      # 第三版分析报告的手机截图
│   │   │   │   ├── report-mobile.jpg                         # 初版分析报告的手机截图
│   │   │   │   ├── repository-refactor-records.png           # 仓库职责整理后面试记录页的回归截图
│   │   │   │   ├── resume-editor-desktop-v3.jpg              # 第三版简历编辑器的桌面截图
│   │   │   │   ├── resume-editor-mobile-v3.jpg               # 第三版简历编辑器的手机截图
│   │   │   │   ├── resumes-desktop-v3.jpg                    # 第三版简历库的桌面截图
│   │   │   │   ├── resumes-mobile-v3.jpg                     # 第三版简历库的手机截图
│   │   │   │   ├── saved-jobs-desktop-v3.jpg                 # 第三版目标岗位收藏列表的桌面截图
│   │   │   │   ├── saved-jobs-mobile-v3.jpg                  # 第三版目标岗位收藏列表的手机截图
│   │   │   │   ├── setup-desktop-v2.jpg                      # 第二版面试配置页的桌面截图
│   │   │   │   ├── setup-desktop-v3.jpg                      # 第三版面试配置联动的桌面截图
│   │   │   │   ├── setup-desktop.jpg                         # 初版面试配置页的桌面截图
│   │   │   │   ├── setup-mobile-v3.jpg                       # 第三版面试配置页的手机截图
│   │   │   │   └── setup-mobile.jpg                          # 初版面试配置页的手机截图
│   │   │   ├── design-prompts.md     # 首页、配置、面试、报告和个人中心视觉参考图的生成提示词
│   │   │   ├── extension-prompts.md  # 个人工作区、岗位库和岗位详情参考图的生成提示词
│   │   │   ├── implementation.md     # 首轮高保真原型的实现范围、视觉素材和页面验证记录
│   │   │   ├── library-expansion.md  # 个人工作区和岗位库原型扩展的实现及响应式检查记录
│   │   │   └── README.md             # 历史原型的信息架构、六类界面交互与状态验收设计
│   │   ├── account-management.md                 # 真实账号的注册、登录、访问控制、数据隔离与验证说明
│   │   ├── architecture.md                       # 系统分层架构、模块关系、技术栈和运行部署边界
│   │   ├── code_quality.md                       # 持续集成、自动质量检查及验证结果记录
│   │   ├── code_review.md                        # 代码评审制度、PR 证据和人工审查状态记录
│   │   ├── data_and_interfaces.md                # 业务与知识数据模型、状态机、权限及 HTTP/SSE/WebSocket 接口合同
│   │   ├── deployment.md                         # 部署发布、数据库迁移、备份恢复与回退检查说明
│   │   ├── development.md                        # 本地启动、数据库、知识索引、检查和试跑命令的统一运行指南
│   │   ├── interview-agent-implementation.md     # Agent 分层架构、准备与执行工作流、模型分工及接入验证说明
│   │   ├── interview-agent-v3.md                 # 动态面试的知识检索、私有记忆、流式对话与取消恢复机制说明
│   │   ├── personal-materials-implementation.md  # 结构化简历、事实确认、经历、版本与面前准备的实现说明
│   │   ├── README.md                             # 软件架构、接口、实现专题、运行和原型文档的导航
│   │   ├── repository_structure.md               # 完整仓库目录树及逐文件职责注释
│   │   └── voice-interview.md                    # ASR、Agent、TTS 语音链路及视频房间、设备授权与恢复机制说明
│   └── README.md       # 文档总导航，说明五类文档边界及需求到验证证据的对应关系
├── tests/                  # 单元、集成、人工验收与真实供应商验证
│   ├── fixtures/                       # 可复用的合成业务场景数据
│   │   └── interview-cases.ts  # 供人工复核追问与重练的合成原答、重答和预期行为
│   ├── integration/                    # HTTP、语音、数据库、进程与前端代理集成测试
│   │   ├── database/        # 依赖独立测试数据库的业务和基础设施回归
│   │   │   ├── agent-workflow.test.ts          # 验证简历分析、准备、三种交互模式的开始门槛及删除竞态
│   │   │   ├── all-role-knowledge.test.ts      # 验证全岗位 pgvector 导入、断点续建、版本保留与检索隔离
│   │   │   ├── auth.test.ts                    # 验证真实账号登录、Cookie、会话失效、Origin 与权限隔离
│   │   │   ├── foundation.test.ts              # 验证迁移、事务、幂等、任务、outbox 与 worker 基础设施
│   │   │   ├── interview-cancellation.test.ts  # 验证暂停时取消供应商请求及未知任务类型的失败处理
│   │   │   ├── interviews.test.ts              # 验证文字面试、报告、同题重练、比较及生命周期的真实数据库流程
│   │   │   ├── migrations.test.ts              # 验证空库与两条历史分支迁移后的结构收敛和重复执行
│   │   │   ├── realtime.test.ts                # 验证事件归属、状态发布、私有记忆与参与确认的持久化行为
│   │   │   └── voice-publication.test.ts       # 验证语音活动保留发布结果、补充回答的版本更新与旧结果拦截
│   │   ├── process/         # 编译后 API 与 worker 的独立进程测试
│   │   │   └── backend.test.ts  # 验证编译后 API 和 worker 进程的启动、认证、恢复与资源释放
│   │   ├── web/             # 生产前端同源代理的集成测试
│   │   │   └── proxy.test.ts  # 验证生产 Next.js 同源代理的查询、Cookie、Origin、错误与 SSE
│   │   ├── .gitkeep         # 保留集成测试目录的 Git 占位文件
│   │   ├── backend.test.ts  # 验证 Fastify 公共接口、健康状态、岗位分页、错误与身份注入
│   │   └── voice.test.ts    # 验证语音 WebSocket 的身份、归属、Origin、帧限制与取消
│   ├── support/                        # 测试夹具、独立数据库保护与人工/真实模型验证脚本
│   │   ├── agent-preview.ts           # 启动隔离数据库、合成材料与真实服务，供浏览器人工验收
│   │   ├── agent-workflow-live.ts     # 用九类合成材料调用真实模型，验证分析、准备和多轮 Agent 流程
│   │   ├── interview-policy-live.ts   # 通过合成对话检查真实 Agent 的提问推进、面试策略与逐题评分
│   │   ├── knowledge-all-live.ts      # 在测试库验证少量专业基础资料的真实嵌入与检索，不激活发布版本
│   │   ├── knowledge-fixture.ts       # 构造当前版本知识检索的可复用受控测试数据
│   │   ├── model-latency.ts           # 测量模型流式请求的首段返回与整体响应耗时
│   │   ├── report-wire.ts             # 将合成领域评分转换成测试模型使用的紧凑响应格式
│   │   ├── response-evidence-live.ts  # 用合成问答调用真实模型，回归回答分类、评分与证据约束
│   │   ├── run-database-checks.ts     # 校验独立测试数据库后转发数据库、进程或代理测试命令
│   │   ├── test-database.ts           # 校验测试数据库 URL 和库名，并对配置错误进行脱敏
│   │   ├── voice-fixture.ts           # 提供模拟 ASR/TTS 供应商、语音测试上下文与异步等待工具
│   │   └── voice-provider-smoke.ts    # 真实语音供应商冒烟脚本，验证合成语音到流式识别的链路
│   ├── unit/                           # 领域规则、客户端、组件、协议与证据约束单元测试
│   │   ├── .gitkeep                         # 保留单元测试目录的 Git 占位文件
│   │   ├── account-access.test.ts           # 验证登录回跳、站内路径限制与注册输入规范化
│   │   ├── agent-workflow.test.ts           # 验证新 Agent 工作流、全岗位知识适用性及简历证据约束
│   │   ├── catalog.test.ts                  # 验证岗位与题目索引、来源、筛选、退役及结构化检索
│   │   ├── feedback-coverage.test.ts        # 验证六维反馈标签与有证据的回答覆盖范围
│   │   ├── http-client.test.ts              # 验证同源 HTTP 客户端、幂等头、错误、超时与取消处理
│   │   ├── identity-contract.test.ts        # 验证身份来自服务端，拒绝客户端伪造用户归属
│   │   ├── interview-experience.test.ts     # 验证经历背景、个人职责、话题范围与追问边界
│   │   ├── interview-participation.test.ts  # 验证参与提醒、确认、终止及恢复规则，保护正常短答与拒答
│   │   ├── interview-policy.test.ts         # 验证面试类型、阶段、时长、题量、节奏与拒答边界
│   │   ├── interview-realtime.test.ts       # 验证增量 JSON 流解析、任意分片与截断拒绝
│   │   ├── interview-response.test.ts       # 验证回答响应性、材料选择与流式问题发布前的语义约束
│   │   ├── interview-setup.test.ts          # 验证岗位与招聘阶段的配置兼容性及切换状态
│   │   ├── model-analysis.test.ts           # 验证模型配置、结构化输出、证据约束及供应商错误脱敏
│   │   ├── performance-profile.test.ts      # 验证历史表现聚合，不把缺失观察当零分或混用评分版本
│   │   ├── personal-auth.test.ts            # 验证注册密码长度规则及旧账号登录兼容性
│   │   ├── planning-context.test.ts         # 验证面前规划的岗位上下文冻结、知识类型与候选人事实隔离
│   │   ├── question-scoring.test.ts         # 验证逐题六维评分、HR 适用范围与实际证据要求
│   │   ├── report-insights.test.ts          # 验证报告洞察文案、行动验收项及逐题分数状态展示
│   │   ├── report-readiness.test.ts         # 验证报告就绪判断、等待阶段、失败重试及旧记录兼容
│   │   ├── report-rubric.test.ts            # 验证行为锚定评分标准、指标适用性、证据与版本隔离
│   │   ├── report-visuals.test.ts           # 验证报告雷达图与分数条对零分、缺失和少维度的展示
│   │   ├── reports.test.ts                  # 验证报告聚合、阶段状态、回答版本、摘要与模型输出校验
│   │   ├── resume-template.test.ts          # 验证文本简历分区导入，缺失事实保持空白
│   │   ├── review-conversation.test.ts      # 验证复盘对话的原问答、追问锚点、折叠与反馈展示
│   │   ├── scoring-evidence.test.ts         # 验证回答级评分证据，防止问候、简历或其他题目的内容冒充证据
│   │   ├── start-request.test.ts            # 验证开始请求丢失后的会话恢复、幂等重试与取消门槛
│   │   ├── test-database.test.ts            # 验证测试库选择、业务库拒绝及配置错误脱敏
│   │   ├── transition-screen.test.ts        # 验证过渡页的真实进度、错误恢复、可访问性与减少动画设置
│   │   ├── voice-client.test.ts             # 验证麦克风权限、预采集、开始顺序、播放静音与语音连接恢复
│   │   ├── voice-command.test.ts            # 验证语音检查命令的运行方式、缺配置失败与密钥脱敏
│   │   ├── voice-interface.test.ts          # 验证通话界面、语音草稿、静音、视频入口与文字恢复
│   │   ├── voice-session.test.ts            # 验证语音回合提交、静音等待、打断、补充、重连与发布协调
│   │   └── voice.test.ts                    # 验证语音二进制协议、PCM 播放、采集重采样、VAD 与口型时序
│   ├── interviewlab_demo_user_test.md  # 交叉用户试用任务表，供执行时填写实际观察结果
│   └── README.md                       # 测试导航、执行命令、数据库约束及核心验收用例索引
├── .dockerignore           # Docker 构建上下文的排除规则，过滤依赖、构建产物和本地环境配置
├── .env.example            # 环境变量示例，说明数据库、认证、模型与媒体服务的配置项
├── .gitattributes          # 统一文本换行格式，并将图片和字体标记为二进制文件
├── .gitignore              # Git 忽略规则，排除密钥、依赖、生成文件和私有运行数据
├── compose.personal.yaml   # 个人版容器编排，启动数据库、迁移、API 和前端服务
├── Dockerfile.personal     # 个人版容器镜像定义，安装三个工作区的依赖并复制项目
├── package-lock.json       # 锁定 npm 依赖版本与依赖关系，供可重复安装使用
├── package.json            # npm 工作区声明、统一命令、开发依赖与代码格式设置
├── README.md               # 项目总入口，介绍能力、运行方式、验证命令与文档导航
├── start-personal.command  # macOS 双击启动脚本，通过 Docker Compose 启动个人版
└── tsconfig.json           # 仓库级 TypeScript 严格类型检查与源码扫描配置
```

以下补充本机的 Git 内部目录、被忽略的配置文件与生成目录；`code/`、`tests/` 及工作区父目录仅用于定位。依赖包、Git 内部对象、日志、构建产物和测试临时输出仅列入口，不逐项展开，实际内容会随安装和运行变化。

```text
InterviewLab/
├── .git/                   # Git 版本历史、对象、索引与本机仓库配置
├── .logs/                  # API、前端和 worker 的本地运行日志
├── .vscode/                # 本机 VS Code 工作区设置，受 Git 忽略
│   └── settings.json       # 启用 Python 终端读取环境变量文件
├── node_modules/           # npm 安装的根依赖及工作区链接
├── code/
│   ├── backend/
│   │   ├── dist/           # tsup 生成的 API 与 worker 编译产物
│   │   └── node_modules/   # 后端工作区单独解析或安装的依赖
│   └── frontend/
│       └── .next/          # Next.js 开发缓存、构建结果与自动生成类型
├── tests/
│   └── artifacts/          # 本地测试日志、模型试跑结果、截图和临时验收脚本
└── .env                    # 本机数据库、认证、模型与语音配置，受 Git 忽略
```

前后端共同依赖 `code/core_engine` 中的共享类型与规则；前端通过同源 `/api/v1` 访问 Fastify，公开内容由 `code/backend/src/content` 加载 `docs/algorithm/content` 中的资料。模块关系见[系统架构](architecture.md)，安装、启动、迁移和验证命令见[运行指南](development.md)，测试入口见[测试导航](../../tests/README.md)。

新增、删除或移动文件后，应使用 `git ls-files` 核对本目录并同步更新对应注释。
