# 工程目录与职责

更新：2026-10-25。独立 Fastify/worker 骨架、公共迁移和岗位只读模块已实现；其他业务按模块接入。产品架构见[总体架构](architecture.md)。

## 与课程模板的对应

参考 [IntelligentSWEPractice 的课程成果结构](https://github.com/bettermorn/IntelligentSWEPractice#课程成果)，顶层收拢为 `.github`、`code`、`docs` 和课程要求的 `tests`。根目录保留 README 以及运行必需的 npm、TypeScript、Git 配置。

```text
InterviewLab/
├── .github/
│   ├── workflows/          # 自动检查
│   └── scripts/            # 内容、依赖和文档检查
├── code/
│   ├── backend/            # HTTP 接口、服务合同、src/content 公开适配
│   ├── frontend/           # 页面、组件、演示客户端
│   └── core_engine/        # 共享类型、纯规则及端口
├── docs/
│   ├── requirements/       # 问题定义、功能、非功能、用户故事
│   ├── algorithm/          # 研究、评测、content 资料
│   ├── software/           # 架构、接口与原型
│   ├── mgmt/               # 协作、团队、沟通与风险
│   └── retrospection/      # 按日期保留复盘
├── tests/
│   ├── unit/
│   └── integration/
├── README.md
├── package.json
├── package-lock.json
└── tsconfig.json
```

不复制老师仓库的课件、考核文件或许可证。原根目录 `content` 和 `scripts` 已分别迁入 `docs/algorithm/content`、`.github/scripts`；协作说明位于 `docs/mgmt/COLLABORATION.md`。格式选项并入 `package.json`。

## 当前运行和依赖关系

`npm run dev` 只启动 Next.js；`/api/v1` 由 Route Handlers 转交 `@interviewlab/backend`。浏览器交互使用标签页内演示客户端，未通过 HTTP 保存个人材料。

```text
Next.js app/api → backend HTTP → core / backend 内容模块
Next.js 页面/演示客户端 → backend 的公开 content 子入口 / core
backend/src/content/index.ts → docs/algorithm/content/*.json
backend/src/content/demo.ts → 合成样例与演示报告
```

核心仅定义和执行规则。`buildQuestions` 接收显式模板；`createJobCatalog` 接收模板与来源集合，不导入文件或全局题库。数据库、身份、模型、语音和代码执行通过核心接口由后端适配，不能倒向依赖 UI。

公开子入口 `@interviewlab/backend/content` 和 `/content/demo` 可被浏览器使用，只依赖领域核心和公开 JSON。前端只有 `app/api/` 可以导入后端 HTTP 入口；内容模块禁止导入服务端实现。`npm run boundaries:check` 与 CI 检查上述依赖约束。

## 修改任务应落在哪里

独立真实后端由 npm run dev:api / dev:worker 启动，不经过旧演示路由。src/server 负责装配，src/modules/jobs 为完整示例，src/foundation/database/tasks 是公共基础，src/entrypoints 为命令；业务 schema 随模块建立。前端暂未迁移，后续通过同源 HTTP 接入。新 HTTP schema 不放入旧演示 src/http。成员流程见[后端 README](../../code/backend/README.md)。

| 任务 | 代码位置 | 同步文档 / 验证 |
| --- | --- | --- |
| 个人中心布局与筛选 | `frontend/features/personal-center` | 原型说明、浏览器回归 |
| 简历、收藏、个人 JD 演示操作 | `frontend/lib/demo` | 数据合同、客户端单元测试 |
| 会话规则、预算与汇总 | `core_engine/src` | 功能需求、规则单元测试 |
| HTTP 字段和错误 | `backend/src/http` | 数据与接口、接口测试 |
| 岗位正文、问题、来源与版本 | `docs/algorithm/content` | 内容维护说明、内容检查 |
| 本地公开内容加载 | `backend/src/content` | 检索与模板测试 |
| 数据库与真实身份（后续） | `backend` 的仓储/服务适配 | 归属、并发、删除与集成测试 |
| 模型与向量检索（后续） | `backend` 的供应商/知识适配 | Agent 权限、引用与效果评测 |

目录内说明见[代码导航](../../code/README.md)及[测试导航](../../tests/README.md)。已有路由和组件兼容入口保留；文档只维护当前正文，旧目录由 Git 历史追溯。

## 当前文档与历史记录

- 根 README 负责新成员启动、当前能力与入口，不堆叠全部产品规格。
- `requirements`、`algorithm`、`software` 更新为当前目标与设计；正文开头区分已实现原型和未接入服务，避免把目标写成验收结果。
- `mgmt` 的计划可以更新；已发生的沟通、反馈和提交记录保留日期与依据。`retrospection` 按日期追加，不改写旧的决定。
- 原型设计提示、参考图与实测截图仍在 `software/prototype`；首轮实现记录标注为阶段记录，当前范围指向后续扩展说明。
- `requirements` 的四份正文分别维护问题、功能、非功能和验收；原 `modules` 内容已按职责并入，不保留重复文件。

## 独立后端的工程组织

继续使用三个工作区。模块归属与逻辑 ER 统一维护在数据合同中，不新增重复模块文档。

| 位置 | 当前职责 |
| --- | --- |
| backend/src/modules | accounts、resumes、jobs、interviews、reports、knowledge 的合同与注册；jobs 已有完整实现 |
| backend/src/foundation | 公共配置、身份接口、错误、HTTP schema、幂等 |
| backend/src/database、backend/drizzle | 连接池、事务、公共表、显式迁移 |
| backend/src/tasks | pg-boss、outbox、任务执行、状态和 worker 心跳 |
| backend/src/server、backend/src/entrypoints | 应用装配与 API/worker/迁移/OpenAPI 命令 |
| core_engine/src | 纯 DTO、规则、任务/事件合同和适配端口 |
| frontend | 现有页面与演示客户端；真实异步客户端后续接入 |
| tests/unit、tests/integration | 规则、HTTP、数据库及进程测试 |

路由调用应用服务，服务调用仓储/适配器；模块间通过显式服务协作，需要时传递同一数据库事务。API/worker 已有独立入口及构建，原 Next.js 演示仍保留。生产同源代理、实时通道和业务模块在相应阶段接入。

### 依赖与客户端迁移

- 共享核心保持纯类型与规则，不引入 Zod、框架、数据库或供应商。Zod schema 留在后端并与公共 DTO 做类型一致检查；依赖边界不放开。
- 后端实现依赖核心；前端正式客户端只依赖核心 DTO 和 HTTP/实时协议，不导入 backend 运行入口、Drizzle、Better Auth 配置或模型适配器。
- 当前 `/content` 与 `/content/demo` 是已验证的公开静态过渡入口，本轮保留。真实模式通过岗位 API 获取内容，演示样例继续单独标记；私有服务不得通过公开子入口泄漏到浏览器。
- 同步 `DataClient` 保留为演示合同，不强行将真实请求伪装成同步接口。新建异步客户端，页面显式处理加载、错误、任务轮询和版本冲突，再整体迁移旧 `/sessions`、`/resume-documents` 等路径。
- 现有 `Session`、`ResumeDocument` 和 `StreamEvent.session_id` 是原型类型；目标 HTTP 使用 Interview、Resume 及 interview_id，迁移时显式映射，不能只改字段名称却遗漏状态语义。
- 保留演示入口与当前标签页资料，不将资料自动上传到受邀账号。真实模式不读取演示固定分数，未接入能力返回明确状态。

数据库迁移、生成 OpenAPI、内容初次导入、依赖锁定、前端代理和边界检查必须随代码实现同步交付；不能引用尚不存在的脚本或文件作为当前操作说明。完整接口及旧路径映射见[数据与接口](data_and_interfaces.md)，阶段门槛见[评测](../algorithm/evaluation.md)。
