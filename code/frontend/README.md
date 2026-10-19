# Web 应用 · @interviewlab/web

Next.js App Router、React、TypeScript 和 Tailwind CSS。页面保留暖黄、浅橙、奶油白与浅青设计；此次整理不调整页面模块和视觉。

| 位置 | 职责 |
| --- | --- |
| `app/` | URL、布局、加载/异常页；`app/api/` 仅转交后端 HTTP 请求 |
| `features/personal-center/` | 概览、简历、面试记录、目标岗位、偏好五个分区及控制器 |
| `components/` | 通用布局、弹窗、基础 UI 与已有编辑器/岗位组件 |
| `components/personal-workspace.tsx` | 保留原路由与编辑器引用的兼容出口 |
| `lib/demo-client.ts` | 页面使用的统一演示客户端公共入口 |
| `lib/demo/state.ts` | 标签页存储、v1→v2 迁移、存储不可用降级与重置 |
| `lib/demo/resumes.ts` | 简历、经历、复制、默认值与乐观版本校验 |
| `lib/demo/targets.ts` | 收藏及个人 JD 操作 |
| `lib/demo/client.ts` | 客户端组合、配置、会话及材料快照 |
| `lib/demo/validation.ts` | 演示操作的名称和材料关联校验 |
| `public/` | 已确认素材和本地字体 |

`use-workspace.ts` 负责筛选、提示、确认操作和旧链接兼容，各分区只展示对应内容。页面不直接读写用户存储；新增操作先扩展统一客户端。已有代码/回答草稿仍由面试工作区管理，与演示重置联动。

当前客户端是同步 `sessionStorage` 演示；真实 HTTP 联调时须增加异步请求、身份、加载与错误状态。后端 HTTP 入口只允许在 `app/api/` 导入；客户端组件通过 `/content` 与 `/content/demo` 两个公开子入口读取资料。

样式暂按现有 `globals.css → workspace.css → refinement.css → library.css` 顺序加载，保持视觉一致；未在本次重构中合并覆盖规则。后续按功能迁移样式时需要做页面截图核对。

在仓库根目录运行 `npm ci`、`npm run dev`；打开 [首页](http://127.0.0.1:3000)。完整启动和协作说明见[根 README](../../README.md)。修改前阅读本目录 [AGENTS.md](AGENTS.md) 与已安装 Next.js 的相关文档。
