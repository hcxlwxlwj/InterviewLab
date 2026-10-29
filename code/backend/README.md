# 统一后端 · @interviewlab/backend

Fastify API 与 pg-boss worker 共用一个后端包。公共基础统一维护，各成员负责自己模块的业务、迁移、测试和前后端联调。原 Next.js 演示接口继续保留，不自动上传浏览器数据。

## 实现状态

| 能力 | 状态 |
| --- | --- |
| 独立 API、配置校验、错误、日志、OpenAPI、构建 | 已实现 |
| 岗位分类、分页列表、详情及来源 | 已实现，读取现有 1000 个公开岗位 |
| PostgreSQL 迁移、事务、幂等、outbox、任务执行、worker 心跳 | 已实现公共基础，业务处理器另行注册 |
| 同源代理、公共 HTTP 客户端和登录入口 | 已实现，见[前端接入](../frontend/README.md) |
| Better Auth、Cookie 会话、角色校验、受邀账号命令 | 已实现，配置后启用；没有公开注册 |
| 任务查询 | 已实现 Cookie 身份和资源归属校验 |
| 真实文字面试、证据报告、单题重练、比较、历史和删除 | 已实现，真实模型效果单独验收 |
| ecnu-plus 兼容模型适配、冻结知识接口、本地公开内容适配 | 已实现；须配置本机 LLM_API_KEY，真实效果尚待验收 |
| 账号资料/偏好、简历、个人 JD/收藏、内容维护业务 | 待模块负责人实现 |
| pgvector 混合检索、目标记忆与流式面试 | 前端岗位 v3 联调试点，草案待人工审核；见[说明](../../docs/software/interview-agent-v3.md) |
| 私有文件、语音 | 尚未接通 |

[架构](../../docs/software/architecture.md)和[数据合同](../../docs/software/data_and_interfaces.md)区分当前能力与目标方案；规划接口不等于已实现接口。

文字报告的新增总结、进度、重试合同与迁移说明见[报告模块](src/modules/reports/README.md)。

## 无需数据库即可使用

使用 Node.js 24.11+，在仓库根目录执行：

~~~powershell
npm ci
npm run dev:api
~~~

不设置 DATABASE_URL 即可使用：

- GET http://127.0.0.1:3001/api/v1/health
- GET http://127.0.0.1:3001/api/v1/job-categories
- GET http://127.0.0.1:3001/api/v1/job-templates?limit=20
- GET http://127.0.0.1:3001/api/v1/job-templates/ai-product
- GET http://127.0.0.1:3001/api/v1/capabilities
- GET http://127.0.0.1:3001/api/v1/openapi.json（仅 development）

未连数据库或 worker 时，GET /api/v1/health/ready 返回 503，不影响公开岗位查询。真实服务响应标记为 backend-foundation，未实现业务不返回合成用户记录。只有已注册的真实路由进入 OpenAPI。

~~~powershell
npm run build:backend
npm run openapi:generate
npm run start:api
~~~

生产运行不依赖 tsx。OpenAPI 离线导出到 code/backend/dist/openapi.json；构建会清理 dist，先构建再导出。生产环境不开放 OpenAPI HTTP 地址。现有 npm run dev/build/start 继续服务前端演示。

## 数据库与 worker

先启动 Docker Desktop。根目录示例配置仅用于本机开发：

~~~powershell
Copy-Item .env.example .env
docker compose -f code/backend/compose.yaml up -d --wait
npm run db:migrate
npm run dev:api
~~~

另开终端：

~~~powershell
npm run dev:worker
~~~

PostgreSQL 16 仅映射本机 5433。示例是公开本地凭证，生产必须替换并通过环境注入。API/worker 各自使用连接池，部署时合计连接预算。

入口从仓库根 .env 加载，显式环境变量优先；范围见 src/foundation/config.ts。API 启动不迁移应用表。五张基础表通过 db:migrate 建立；首次 worker 启动会初始化/升级 pg-boss 自有 pgboss schema，部署升级前应审核版本。

worker 入口已注册面试规划/推进、逐题报告和比较处理器，并每秒处理期限、最终失败和报告汇总。默认 ecnu-plus，配置项及真实/演示入口见[文字面试接入](../../docs/software/interview-agent-implementation.md)。没有 LLM_API_KEY 时能力明确不可用，不能把心跳当成模型成功。未注册类型仍显式失败。

停止本项目数据库可执行 docker compose -f code/backend/compose.yaml stop；卷保留。不要删除其他成员的数据库或使用生产数据测试。

## 启用公共认证

复制根 .env.example 为 .env，设置 AUTH_ENABLED=true，保留正确的 DATABASE_URL，并使用以下命令生成独立随机密钥，填入 BETTER_AUTH_SECRET（至少 32 字符）：

~~~powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
docker compose -f code/backend/compose.yaml up -d --wait
npm run db:migrate
npm run auth:create-user
~~~

auth:create-user 在交互终端询问邮箱、显示名和角色，生成并只显示一次随机密码。默认角色 student；content_maintainer 和 operator 按实际职责授予。账户、密码哈希和创建审计同事务写入，重复邮箱失败。不要在命令参数、仓库或聊天中保存真实密码；本轮不会默认创建任何真实账号。

分别启动 npm run dev:api 和 npm run dev，打开 http://127.0.0.1:3000/login。PUBLIC_ORIGIN 必须与浏览器来源精确一致，BACKEND_ORIGIN 指向内部 API。生产认证要求 PUBLIC_ORIGIN 为 HTTPS，Cookie 为 HttpOnly/Secure/SameSite=Lax 且不设置跨域 Domain。

认证仅公开三个自有合同：GET /api/v1/auth/session 返回 AuthSession 或 null；POST /api/v1/auth/sign-in/email 接收 email/password/rememberMe，成功返回 {success:true}；POST /api/v1/auth/sign-out 接收 {}，成功撤销会话并清 Cookie。底层使用 Better Auth 1.7.12 和 Drizzle；不会把原生含 token 的登录/会话对象返回前端。公开注册、邮件找回、改密、OAuth 和管理 API 均未开放。

会话固定七天有效，不开启 Cookie 缓存或滑动续期；rememberMe=false 时浏览器 Cookie 随会话结束，服务端仍校验到期时间。退出、删除会话和到期后，旧 Cookie 不再授权。角色从数据库读取，不接受客户端角色或 owner 请求头。

所有 /api/v1 的 POST/PUT/PATCH/DELETE 在公共层检查 Origin；命令行联调也要发送配置的 Origin。模块注册收到 ModuleContext，使用 context.requireIdentity(request) 和 context.requireRole(identity, role)，再在业务服务中检查资源归属。鉴权不会自动替模块校验任意资源 ID。

登录限流保存在 PostgreSQL，默认每个 API 对端 IP 每分钟 10 次，重启后保留。Fastify 不信任客户端转发 IP；目前经过 Next.js 的访问共享代理对端的桶。多用户正式部署前由公共负责人配置可信入口 IP 策略，不能让模块自行信任 X-Forwarded-For。

AUTH_ENABLED=false 时会话接口返回明确 501；设为 true 但缺库或密钥时启动失败，依赖运行中失效返回 503。公开岗位不要求身份。登录本身不需要 worker；/health/ready 仍反映数据库和 worker 整体就绪。

## 工程入口与模块归属

| 位置 | 职责 |
| --- | --- |
| src/server/app.ts | 应用工厂、公共路由、依赖和模块装配 |
| src/modules/contracts.ts | 六模块职责、服务接口和注册合同 |
| src/modules/jobs/ | 完整的路由 → 服务 → 内容仓储示例 |
| src/foundation/ | 配置、身份、错误、schema、幂等 |
| src/database/、drizzle/ | 数据库、事务、基础表及迁移 |
| src/tasks/ | 任务、outbox、队列、执行和 worker |
| src/entrypoints/ | API、worker、迁移及文档导出 |

模块为 accounts、resumes、jobs、interviews、reports、knowledge。知识模块负责发布内容，岗位模块提供查询；后续内容仓储可替换本地公开文件。纯核心只存共享 DTO、规则和必要端口。

services.ts、http/ 和后端根 exports 保留旧演示合同。新服务使用 modules/contracts.ts、foundation 和 server。不要把真实业务加进同步演示 DataClient。

### 成员添加模块的步骤

1. 阅读 AGENTS.md 和全局合同。在 src/modules 下实现 BackendModule，参考 jobs，按实际需要添加 service/repository。
2. 共享 DTO 放 core_engine，Zod schema 放后端并做类型一致检查；路由只校验、调用服务、映射响应。
3. 在 buildApp 的 modules 参数中注册模块，并通过闭包传入服务依赖。默认 jobs 已注册，重复注册报错。HTTP 和 worker 调用同一应用服务。
4. register(app, context) 中使用 context.requireIdentity 和 context.requireRole；资源归属仍由服务/仓储检查。公共层统一检查浏览器写入 Origin，不接受任意 owner 请求头，不另建认证中间件。
5. 本模块维护自己的 schema，将文件加入 drizzle.config.ts 的 schema 列表，执行 npm run db:generate，审核 SQL 后迁移。已应用迁移不可改写；共享类型、依赖和跨模块关系变更需说明影响并协调。
6. 在 tests 下补业务规则、合同和数据库测试。前端按 OpenAPI 调用 HTTP，后端跨模块走注入服务，不调用其他模块路由或直接修改其表。
7. PR 合入 develop；公共基础负责人协调集成，各成员负责自己的前后端联调。

### 幂等与异步任务

withIdempotency(database, {owner_id,operation,key,input}, work) 将同一用户/操作/键串行化，业务写入和响应同事务；同输入复用响应，不同输入返回 409。work 只允许数据库操作。

业务事务中调用 enqueueTask(tx, {owner_id,type,key,input})，与业务变更一起保存任务和 outbox。type 使用版本化名称（如 reports.generate.v1），key 绑定对象与输入版本；输入只存必要数据，不存凭证。

在 src/entrypoints/worker.ts 的 startWorker 配置中注入 handlers。处理器接收任务和 AbortSignal，在事务外调用供应商、校验结果，然后返回：

~~~typescript
{
  result_ref: { id: resultId, version: resultVersion },
  commit: async (tx) => {
    // 重新检查本模块的输入版本、删除标记、generation，再写结果。
    // 此处只有短数据库操作，不调用模型、文件或网络。
  }
}
~~~

runner 提交前锁定任务并校验执行 token/租约，业务结果与 succeeded 同事务。默认每任务最多两次实际执行，可配置 1–5 次；单次租约 60 秒，处理器必须遵守取消信号。外部请求可能重复，副作用使用供应商幂等键。迟到结果不能提交。

outbox 投递失败两秒后重扫，允许至少一次交付。未知类型显式失败。尚未实现通用任务重试 HTTP，模块需先校验来源状态/版本再设计重试命令，不能无限重投。GET /tasks/:id 只返回本人状态/结果引用，不暴露 payload 或执行 token。

## 检查和真实数据库测试

~~~powershell
npm run check
npm run build:backend
npm run build
~~~

test:db 会清空公共基础及面试/报告测试表，并清理认证会话/限流测试数据，只能使用独立的 interviewlab_test* 数据库；缺少数据库时失败，不跳过。不要与其他写同一测试库的进程并行运行。

~~~powershell
docker compose -f code/backend/compose.yaml exec -T postgres createdb -U interviewlab interviewlab_test
$env:TEST_DATABASE_URL = 'postgresql://interviewlab:interviewlab_local@127.0.0.1:5433/interviewlab_test'
npm run test:db
npm run build:backend
npm run test:process
npm run build
npm run test:web
~~~

测试库已存在时不必再次 createdb；test:db 自动迁移。test:process 验证构建产物启动和停止/重启，Windows 使用仅限父子进程的 IPC shutdown，与 SIGINT/SIGTERM 共用清理逻辑。

test:web 启动真实 Next.js 生产代理和测试 API，验证 Cookie 往返、错误及后端断开。构建中的 BACKEND_ORIGIN 必须指向空闲的本机端口；如果 3001 已被开发服务占用，可先在终端设置 BACKEND_ORIGIN=http://127.0.0.1:33001，再执行 build 和 test:web。测试完清除此环境变量并重新 build 即恢复默认代理目标。请不要停止其他成员正在使用的服务。

2026-10-25 公共接入验证：46 项无库测试、14 项真实 PostgreSQL 测试、4 项构建产物进程测试及 1 项真实 Next.js 代理测试通过；前后端构建及 OpenAPI 导出通过，npm audit 为 0。浏览器另验证了受邀账号登录、刷新保持及退出。由于本机 Docker Desktop 启动时发生 dockerInference 套接字错误，本次数据库验证采用临时目录内的独立 PostgreSQL 16.14，未使用模拟数据库，也未重置原 Docker 数据卷；CI 继续使用 postgres:16。

给 AI 的模块任务提示：

> 在现有 InterviewLab 骨架中实现【功能】。先读后端 AGENTS.md、README、架构和数据合同，参考 jobs 模块。沿用配置、错误、身份、迁移和任务机制；跨模块通过服务调用。先说明公共合同的变化，再实现模块、联调和测试。不要重建后端项目或把演示数据当成真实成功。

设计参考社区 [architecture-patterns](https://github.com/wshobson/agents/blob/main/plugins/backend-development/skills/architecture-patterns/SKILL.md) 和 [nodejs-backend-patterns](https://github.com/wshobson/agents/blob/main/plugins/javascript-typescript/skills/nodejs-backend-patterns/SKILL.md)，未安装全局 Skill。

## 依赖审计记录

2026-10-25 已修复：完整 npm audit（含开发依赖）及生产依赖审计均为 0 项，npm ls 无依赖树错误。

原 4 项 moderate 提示源自一个问题：[GHSA-67mh-4wv8-2f99](https://github.com/advisories/GHSA-67mh-4wv8-2f99)。旧 esbuild 的 serve 开发服务器存在跨域读取风险，npm 将它及上游三个依赖包分别计入。当前 API 并不使用该 serve 功能。

采用[上游问题讨论中的临时方案](https://github.com/drizzle-team/drizzle-orm/issues/4852)：保持 drizzle-kit 0.31.11 稳定版，将废弃的 @esbuild-kit/esm-loader 通过根 overrides 替换为现有维护中的 tsx 4.23.15，移除 core-utils 与 esbuild 0.18.20 依赖链。drizzle-kit 作为全项目迁移工具统一放在根 devDependencies，使本仓库 npm 11 的覆盖规则和依赖树检查正常工作；原 db:generate 命令不变。

该兼容覆盖固定版本，未来升级迁移工具时应重新验证。上游稳定版移除旧加载器后，可删除 overrides，并通过 npm ci、npm audit、迁移生成及构建测试确认。没有使用 audit 忽略规则或将依赖降级到旧工具链。
