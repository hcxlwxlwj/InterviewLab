# 账号注册与访问管理

更新：2026-10-30。本文描述已实现的真实账号流程；未实现能力不返回演示个人数据。

## 使用与启动

需要 Node.js 24、npm、PostgreSQL，以及仓库根目录本机 `.env`。不要把密钥、账号密码或真实材料提交到 Git。

1. 执行 `npm ci`。首次使用参考根 `.env.example` 配置 `.env`。
2. 设置 `AUTH_ENABLED=true`、可用的 `DATABASE_URL`，以及至少 32 字符的随机 `BETTER_AUTH_SECRET`。`PUBLIC_ORIGIN` 必须精确匹配浏览器的协议、主机和端口，默认 `http://127.0.0.1:3000`；`BACKEND_ORIGIN` 默认 `http://127.0.0.1:3001`。
3. 执行 `npm run db:migrate`。已有数据库只应用新增迁移，不重建表、不重置账号。本次复用现有认证表，不新增迁移或依赖。
4. 分别启动 `npm run dev:api`、`npm run dev`。注册和登录不需要 worker；真实模型面试另需 `LLM_API_KEY` 及 `npm run dev:worker`。
5. 打开首页，点击业务入口，在弹窗中注册或登录。注册后自动建立会话，确认会话成功后恢复原目标。

密钥可通过 `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"` 生成。生产环境要求 HTTPS。不要混用 localhost 与 127.0.0.1；生产代理目标在前端构建时确定，修改后需重新构建。

`npm run auth:create-user` 继续用于管理员在受控终端中创建受邀账号及指定维护角色。普通注册固定为 student，不能从浏览器授予维护角色。

## 页面行为与真实数据

- 首页公开。登录入口 `/login`、首页锚点和静态资源不受页面登录拦截；其他页面先确认会话，不挂载未授权业务内容。
- 首页点击业务链接先打开登录/注册弹窗。关闭或按 Escape 取消后继续浏览首页。直接访问、刷新或前进后退进入业务页面，未登录则回首页弹窗，保留站内目标路径、查询和锚点。
- 登录成功恢复原目标；只允许 jobs、me、interview、reports、compare 下的站内路径，不接受外部跳转地址。独立 `/login` 登录成功进入 `/me`。
- 会话读取失败显示连接错误和重试，不当作登录成功，不切换为演示数据。注册成功但后续会话确认失败时，需要重新连接或登录，不能再次盲目注册。
- `/me` 显示当前会话的姓名、邮箱及最近五条真实面试。没有记录显示空状态；接口失败显示错误，不伪造零条记录或演示记录。
- `/me/interviews` 显示本人真实历史。面试、报告、重练、比较、删除与任务通过后端验证归属，他人资源统一不可读；维护角色不会自动获得私人记录权限。
- 岗位列表、分类、搜索、分页及详情使用公开岗位 API。收藏与个人 JD 保存按钮禁用；简历、旧简历详情、目标岗位和偏好维护页面明确“暂未开放”。
- 主流程隐藏演示跳转。旧演示实现及显式 `?demo=1` 地址保留，也受页面登录控制。演示材料不上传、不转换成账号记录；首页合成界面示意不属于用户数据。

## 公共接口

以下路径均以 `/api/v1` 开头。所有写入必须发送精确匹配 `PUBLIC_ORIGIN` 的 Origin，响应禁止缓存。

| 方法与路径 | 请求 | 成功响应 |
| --- | --- | --- |
| `POST /auth/sign-up/email` | `{name,email,password}` | `{success:true}`，设置 Cookie 并自动登录 |
| `POST /auth/sign-in/email` | `{email,password,rememberMe?}` | `{success:true}`，设置 Cookie |
| `GET /auth/session` | 浏览器 Cookie | `AuthSession` 或 `null` |
| `POST /auth/sign-out` | `{}`、浏览器 Cookie | `{success:true}`，撤销会话并清 Cookie |

注册显示名去首尾空白后 1–100 字符；邮箱格式有效、最长 254 字符并转换为小写；密码 12–128 字符，不对密码去空白。确认密码仅在前端验证。未知字段（包括 role、owner_id、callbackURL）均被拒绝。数据库唯一约束与 Better Auth 事务保证并发重复注册不会覆盖密码或留下未关联凭据。

共享类型为 `SignUpInput`、`SignInInput`、`AuthSession`。浏览器通过 `authClient` 和统一 `apiRequest` 调用；不直接使用 Better Auth 原生返回值，不把密码哈希、会话 token、密钥或 provider 原始错误返回前端或日志。OpenAPI 由注册路由生成，执行 `npm run openapi:generate` 可导出。

错误体为 `{code,message,retryable,request_id}`：400 输入错误；401 邮箱密码错误或未登录；403 来源/角色禁止；409 `email_already_exists`；429 过于频繁；501 认证未启用；503 认证依赖暂不可用。重复邮箱会明确提示已注册，因此本阶段不隐藏邮箱是否已注册这一信息。

## 会话封装与隔离

后端复用 Better Auth/Drizzle 和原有五张认证表。密码使用组件密码哈希；Cookie 为 HttpOnly、SameSite=Lax、Path=/，HTTPS 下 Secure，不设置 Domain。会话固定七天，不使用 Cookie 缓存或滑动续期。登录时 rememberMe=false 使用浏览器会话 Cookie，服务端仍校验到期时间。

SessionProvider 统一确认身份，保留请求序列和取消控制。注册、登录、退出及 BroadcastChannel 跨标签页通知先清除可见账号状态，再读取权威会话；私有接口 401 同样触发失效处理。登录接口的密码错误不会触发业务会话失效循环。焦点恢复会重新校验，当前会话到期设置定时重查。

AccountAccess 在会话未确认时阻止受保护组件挂载，业务树按 user.id 重新挂载；卸载会取消旧读取、轮询及事件流，迟到结果不进入新账号界面。原有文字草稿按账号和面试/题目标识分隔保存在当前标签页，不上传演示材料。退出或到期不会自动删除已持久化面试。

页面拦截不是后端授权边界。公共岗位 API 保持公开；面试/报告/任务及事件流各自校验身份和资源归属。事件流在更新及心跳时复查会话，失效后停止。

## 限流、排障和限制

注册每个 API 对端 IP 每分钟最多 5 次；登录最多 10 次。限流记录存 PostgreSQL，跨实例/重启保留。Fastify 不信任任意转发 IP；通过 Next.js 的用户可能共享代理对端的限流桶。正式多用户部署前需设计并验证可信代理 IP 策略，不能直接信任客户端 X-Forwarded-For。

| 现象 | 处理 |
| --- | --- |
| 501 账号服务未开放 | 启用 AUTH_ENABLED，配置数据库及认证密钥后重启 API |
| 启动配置错误 | 检查数据库、密钥长度、PUBLIC_ORIGIN 和生产 HTTPS，不把完整环境变量贴入日志 |
| 403 写入被拒绝 | 浏览器地址必须与 PUBLIC_ORIGIN 完全一致；命令行也需 Origin |
| 503 无法读取会话 | 检查 PostgreSQL、认证迁移和 API 是否运行，恢复后重试 |
| 429 注册/登录失败 | 等待限流窗口，检查共享代理桶；不要重启服务绕过限制 |
| 岗位可读但面试无法推进 | 检查 LLM_API_KEY、worker 和模型供应商；账号登录本身不代表模型可用 |
| 旧演示数据仍存在浏览器 | 不影响真实账号；无需上传或迁移，正常入口不会读取它 |

本轮不接邮件验证、找回/修改密码、OAuth、账号注销和部署。邮箱所有权未经验证，填错邮箱后暂没有自助找回入口。个人资料编辑、简历、个人 JD、收藏、偏好、上传、语音和 PDF 仍待各模块实现。

## 验证记录

2026-10-30：`npm run check`（141 项单元/接口测试）、前后端构建及 OpenAPI 导出通过；真实 PostgreSQL `test:db` 48 项、构建产物 `test:process` 4 项、真实 Next.js 代理 `test:web` 1 项通过。数据库测试只使用 `interviewlab_test*` 独立库。

浏览器在单独的 `interviewlab_test_accounts_preview` 库验收：首页业务链接弹窗、Escape/取消、直接地址登录后恢复查询参数、确认密码不一致、注册自动登录、刷新保持、真实岗位搜索/详情/配置、创建持久化面试、跨标签页退出、后退拦截、服务端会话过期、认证服务断开及 A/B 账号切换空记录。未出现浏览器控制台错误；截图仅含虚构测试身份，保留于被 Git 忽略的 tests/artifacts。

本轮真实模型冒烟两次均在 reports.evaluate.v1 阶段遇到 provider_timeout；第二次已将单次超时提高至 45 秒，仍未通过。受控 Agent 的真实数据库闭环通过，不等于本轮真实供应商闭环通过。所有合成测试输入仅用于验证流程，不使用真实简历。交接说明放在项目目录外，不纳入仓库。

2026-10-31 界面修正：真实面试记录复用个人中心 WorkspaceFrame、侧栏高亮、library-table、公共按钮及空状态，保持真实接口、筛选、分页、报告入口和删除逻辑。类型检查及隔离浏览器的空/有记录与状态筛选验证通过。
