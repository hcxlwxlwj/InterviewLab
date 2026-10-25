# 前端公共接入

业务负责人在现有 Next.js 工作区实现页面和联调，不需要再建 HTTP 客户端或认证系统。公共实现为同源代理、JSON HTTP 客户端、受邀账号登录页和会话上下文；首页、岗位、面试和个人中心业务页面仍是原演示实现，逐模块迁移。

## 工程位置

| 位置 | 职责 |
| --- | --- |
| app/ | 页面、布局与公共 /login；app/api/demo 仅保留合成 HTTP |
| lib/api/ | 公共 HTTP 和认证客户端；成员在此添加自己的模块客户端 |
| components/session-provider.tsx | 公共会话上下文与刷新 |
| features/personal-center/ | 概览、简历、面试记录、目标岗位和偏好页面 |
| components/ | 通用布局、弹窗、UI、编辑器和岗位组件 |
| lib/demo-client.ts、lib/demo/ | 原同步演示客户端、标签页状态、版本迁移和重置 |
| public/ | 素材和本地字体 |

保留现有 globals.css → workspace.css → refinement.css → library.css 样式顺序，auth.css 仅补登录样式。修改前阅读本目录 AGENTS.md 和已安装 Next.js 对应文档。依赖边界检查只允许 app/api 导入后端 HTTP；新业务组件通过 HTTP 调用服务。演示客户端仍可导入公开 content/content/demo 子入口。

## 启动与地址

根目录运行 npm ci。两个终端分别执行 npm run dev:api 和 npm run dev，浏览器统一打开 http://127.0.0.1:3000。顺序不限；调用真实接口时 API 必须运行。

| 地址 | 去向 |
| --- | --- |
| /api/v1/* | Next.js 同源代理到 Fastify，默认 127.0.0.1:3001 |
| /api/demo/v1/* | 原合成接口，供显式演示使用 |
| /login | 公共受邀账号登录、会话查看和退出页 |

Next.js 配置读取根 .env，显式环境变量优先。BACKEND_ORIGIN 是服务端代理目标，PUBLIC_ORIGIN 是后端认可的浏览器来源；必须精确匹配打开网站的协议、主机和端口。默认用 127.0.0.1，不混用 localhost。开发修改配置后重启；生产代理地址在 build 时确定，修改后重新构建部署。数据库和认证密钥不使用 NEXT_PUBLIC_ 前缀。

代理不回退到合成接口。后端停止后真实请求报错，演示页面及显式演示接口仍可用。当前代理面向普通 HTTP；WebSocket、语音和文件上传的代理约束随对应能力单独接入。

## 业务模块统一调用

在 lib/api 下添加模块客户端，DTO 从 @interviewlab/core 导入：

~~~typescript
import type { PageResult, JobTemplate } from '@interviewlab/core';
import { apiRequest } from './http';

export const jobsApi = {
  list: (signal?: AbortSignal) =>
    apiRequest<PageResult<JobTemplate>>('/job-templates?limit=20', { signal }),
};
~~~

路径相对于 /api/v1，不能传完整域名。客户端统一处理 Cookie、JSON、204、超时、取消和结构化错误；不自动重试写入，不在浏览器保存 token。可使用 body、method、signal 和 idempotencyKey。幂等键在同一用户操作首次发起时创建，明确重试时复用；新的操作生成新键。分页由模块按 next_cursor 继续读取。

捕获 ApiClientError 后读取 status、detail.code、detail.retryable、detail.request_id。401 表示未登录，403 表示权限或来源不允许，409 表示状态/版本冲突，501 表示未配置能力；网络失败为 status=0。取消会抛出调用方的 AbortSignal.reason。组件负责加载、空结果、错误及重试的呈现；不要把失败转为本地合成成功。通用泛型是编译时 DTO，模块仍需遵守 OpenAPI 并对供应商等不可信输入做相应校验。

## 使用公共会话

RootLayout 已装配 SessionProvider。客户端组件使用 components/session-provider 的 useSession()，得到 state 和 refresh()。state.status 为 loading、signed_out、signed_in、unavailable 或 error；signed_in 时可读 state.session.user、roles、expires_at。401、登录/退出成功和窗口重新获得焦点会刷新会话。组件卸载及并发刷新有取消和顺序保护。

登录/退出调用 lib/api/auth 的 authClient。角色仅用于前端展示；后端必须执行权限与资源归属校验。未登录可以给出 /login 链接，不能因为会话查询失败就当作已登录。不要直接访问 Better Auth 的内部端点或另建 localStorage token。

认证启动、生成密钥和创建受邀账号见[后端说明](../backend/README.md)。登录不导入现有标签页材料，认证基础不会自动使演示业务变成真实持久化业务。账号资料/偏好仍由 accounts 负责人开发。

## 模块交付清单

1. 沿用 DTO、apiRequest 和 useSession，实现本模块接口及页面状态。
2. 在服务端使用注入的身份能力校验本人资源；跨模块调用服务接口。
3. 加入模块测试并跑 npm run check、npm run build:backend、npm run build。
4. 新建/更新 schema 时补迁移；涉及数据库和真实代理时运行 test:db、test:process 和 test:web。
5. PR 说明接口、DTO、迁移及其他模块受影响之处，公共合同改动先协调。

给成员的 AI 提示词：

> 在 InterviewLab 现有工作区实现【模块】的业务和前后端联调。先读本 README、后端 AGENTS.md、架构和数据合同。沿用 /api/v1 同源代理、lib/api/http、SessionProvider 和注入的身份/角色校验；参考 jobs 模块，不重建后端、认证或 HTTP 基础。补本模块 DTO/schema、服务、迁移、页面状态和测试。不要把演示 sessionStorage 数据自动上传；共享合同变化先说明影响。
