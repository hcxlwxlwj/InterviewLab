# 前端公共接入

## 面试启动与报告过渡

配置页点击“开启模拟面试”后进入全屏准备；设备、简历和面试规划就绪后自动开始。语音申请麦克风，视频同时申请摄像头；画面仅本机预览，屏幕共享需另行主动开启。面试公共布局持有临时媒体资源，跨准备页和面试间复用；取消、退出账号、离开面试流程和结束时释放。浏览器授权失败或阻止声音时，准备页提供重试、改用文字和返回配置，不反复创建面试。

结束后进入 `/interview/{id}/analysis`，按实际逐题、总结及建议任务进度等待，再自动展示完整报告；直接访问未完成报告也使用同一全屏界面。失败可重试对应阶段，或主动查看已保存结果。没有有效回答时明确提示，不补分或无限等待。动画支持手机与减少动态效果设置，不按经过时间虚构进度。

过渡页只显示流体圆球、标题、当前阶段和细进度条，错误时仍保持轻柔动画，减少动态效果模式静止。只有手动结束会弹出提前结束确认；确认会一并提交当前草稿，取消恢复语音采集。到时及语音结束直接进入分析。专业、业务、综合面整场固定六维雷达图，未体现维度计0分；HR和单题重练按实际维度展示。总报告的六维雷达、逐题表现、整体评价、优势/提升卡片和练习建议全部直接展示，不展示重复评分明细或内部规则。逐题复盘默认展示完整问答气泡，每题只保留一层展开分析；评分、反馈和独立重练轨迹在分析内平铺，练习目标只出现一次，原文仅在回答气泡中展示。有两次以上可比较的练习成绩时才显示趋势图。

首页公开，其他业务页面由统一 AccountAccess 控制访问：未登录时回首页弹窗，登录或注册成功后恢复原目标；不挂载受保护业务组件。SessionProvider 在 401、到期、退出及跨标签页账号变化时重新确认身份，业务树按账号标识重新挂载。详见[账号与访问管理](../../docs/software/account-management.md)。

业务负责人沿用现有 Next.js、HTTP 客户端和认证系统。真实 `/interview/setup`、`/interview/{id}`、`/reports/{id}`、`/me/interviews` 已通过 HTTP 接入面试闭环；已删除旧演示分支。结构化文本简历已接入真实版本维护；当前工作流新增分析和准备状态。个人 JD、收藏等未开放入口继续保持原边界，不读取演示数据。启动、模型及验收边界见[文字面试接入](../../docs/software/interview-agent-implementation.md)。

个人中心概览只展示快捷入口和最近练习，不重复嵌入成长画像或账号说明。个人画像按岗位汇总最近20条记录中的完整面试，排除单题重练；只合并同评分版本的有效结果，兼容新版六维与历史四维数据。无评分报告不会选择比较基准，缺失评分不自动补零，读取失败会保留提示和重试入口。收藏岗位通过真实书签接口读取和取消，岗位名称进入详情，列表只保留一个模拟面试入口。岗位列表、分类和详情通过 lib/api/jobs.ts 查询真实公开接口。演示实现已删除。

配置和面试沿用原有页面设计。`components/interview-setup.tsx` 复用原配置页框架与选项控件，`components/interview-workspace.tsx` 复用原顶部计时、左侧面试官/题目轨迹、右侧对话/输入框；当前 HTTP 控制器复用这些视图，不再维护另外一套聊天布局。真实流程只开放已接通选项。界面证据：[原配置布局](../../docs/software/prototype/screenshots/live-original-setup.png)、[原面试布局接入 AI](../../docs/software/prototype/screenshots/live-original-interview.png)。

## 开发面试流程与 Agent

配置本机 `.env` 的数据库、模型参数、`AUTH_ENABLED=true` 与 `BETTER_AUTH_SECRET`，执行 `npm run db:migrate`，分别启动 `npm run dev`、`npm run dev:api` 与 `npm run dev:worker`，从 `http://127.0.0.1:3000/` 注册或登录后进入面试。统一使用正常账号、Cookie 会话与报告闭环。

账号模块提供 `IdentityProvider/RequestIdentity` 与共享会话上下文；面试模块负责配置、Agent 推进、原回答、状态和封存；知识库及报告模块分别通过现有内容与封存接口对接。岗位和结构化材料已接入；Agent 准备与媒体共用合同见[工作流](../../docs/software/interview-agent-implementation.md)。

浏览器验收脚本保留在 `tests/support/agent-preview.ts`，使用独立 `TEST_DATABASE_URL` 和测试账号登录；不注入免登录身份。运行与隔离要求见[测试说明](../../tests/README.md)。

## 工程位置

| 位置 | 职责 |
| --- | --- |
| app/ | 页面、布局与公共 /login；演示 API 已删除 |
| lib/api/ | 公共 HTTP 和认证客户端；成员在此添加自己的模块客户端 |
| components/session-provider.tsx | 公共会话上下文与刷新 |
| features/personal-center/ | 概览、简历、面试记录、目标岗位和偏好页面 |
| components/ | 通用布局、弹窗、UI、编辑器和岗位组件 |
| public/ | 素材和本地字体 |

保留现有 globals.css → workspace.css → refinement.css → library.css 样式顺序，auth.css 补账号表单样式。修改前阅读本目录 AGENTS.md 和已安装 Next.js 对应文档。依赖边界检查只允许 app/api 导入后端 HTTP；新业务组件通过 HTTP 调用服务。公开岗位内容保持独立子入口，私有数据仅经 HTTP。

## 启动与地址

根目录运行 npm ci。两个终端分别执行 npm run dev:api 和 npm run dev，浏览器统一打开 http://127.0.0.1:3000。顺序不限；调用真实接口时 API 必须运行。

| 地址 | 去向 |
| --- | --- |
| /api/v1/* | Next.js 同源代理到 Fastify，默认 127.0.0.1:3001 |
| /login | 复用公共弹窗表单的邮箱密码注册/登录入口 |

Next.js 配置读取根 .env，显式环境变量优先。BACKEND_ORIGIN 是服务端代理目标，PUBLIC_ORIGIN 是后端认可的浏览器来源；必须精确匹配打开网站的协议、主机和端口。默认用 127.0.0.1，不混用 localhost。开发修改配置后重启；生产代理地址在 build 时确定，修改后重新构建部署。数据库和认证密钥不使用 NEXT_PUBLIC_ 前缀。

代理不回退到合成接口。后端停止后真实请求报错，请求直接报错，不回退到合成数据。语音沿用现有连接配置与 WebSocket 合同，详见[语音设计](../../docs/software/voice-interview.md)；文件上传尚未接入。

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
