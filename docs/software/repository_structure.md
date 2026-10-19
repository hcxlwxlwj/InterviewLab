# 工程目录与职责

更新：2026-10-19。适用于当前可运行原型；产品目标仍见[总体架构](architecture.md)。

## 与课程模板的对应

参考 [IntelligentSWEPractice 的课程成果结构](https://github.com/bettermorn/IntelligentSWEPractice#课程成果)，保留指定的文档、代码、测试路径。增加公开内容数据和适配包，避免将静态题库及合成数据与纯领域逻辑混在一起。

```text
InterviewLab/
├── docs/
│   ├── requirements/       # 问题定义、功能、非功能、用户故事
│   ├── algorithm/          # 研究、知识/Agent 方案、评测
│   ├── software/           # 架构、接口、模块、原型与实现说明
│   ├── mgmt/               # 团队、沟通、风险、反馈与提交记录
│   └── retrospection/      # 按日期追加的决定、结果与复盘
├── code/
│   ├── frontend/           # Next.js 页面、组件、演示客户端
│   ├── backend/            # HTTP 校验/路由与服务接入合同
│   ├── core_engine/        # 共享类型、纯规则及端口
│   └── content/            # JSON 适配与独立的合成案例入口
├── content/                # 岗位、分类、来源 JSON 与研究资料
├── tests/
│   ├── unit/               # 规则、客户端及内容检索
│   └── integration/        # API 合同测试
├── scripts/                # 内容完整性与依赖边界检查
└── .github/                # CI、Issue、PR 与文档检查
```

## 当前运行和依赖关系

`npm run dev` 只启动 Next.js；`/api/v1` 由 Route Handlers 转交 `@interviewlab/backend`。浏览器交互使用标签页内演示客户端，未通过 HTTP 保存个人材料。

```text
Next.js app/api → backend → content → core
Next.js 页面/演示客户端 → content / core
content/src/index.ts → 根 content/*.json
content/src/demo.ts → 合成样例与演示报告
```

核心仅定义和执行规则。`buildQuestions` 接收显式模板；`createJobCatalog` 接收模板与来源集合，不导入文件或全局题库。数据库、身份、模型、语音和代码执行通过核心接口由后端适配，不能倒向依赖 UI。

`code/content` 是可被浏览器使用的公开适配包；它不读取个人材料，也不包含密钥。前端只有 `app/api/` 可以导入后端。`npm run boundaries:check` 与 CI 检查上述依赖约束。

## 修改任务应落在哪里

| 任务 | 代码位置 | 同步文档 / 验证 |
| --- | --- | --- |
| 个人中心布局与筛选 | `frontend/features/personal-center` | 原型说明、浏览器回归 |
| 简历、收藏、个人 JD 演示操作 | `frontend/lib/demo` | 数据合同、客户端单元测试 |
| 会话规则、预算与汇总 | `core_engine/src` | 功能需求、规则单元测试 |
| HTTP 字段和错误 | `backend/src/http` | 数据与接口、接口测试 |
| 岗位正文、问题、来源与版本 | 根 `content/` | 内容维护说明、内容检查 |
| 本地公开内容加载 | `code/content/src` | 检索与模板测试 |
| 数据库与真实身份（后续） | `backend` 的仓储/服务适配 | 归属、并发、删除与集成测试 |
| 模型与向量检索（后续） | `backend` 的供应商/知识适配 | Agent 权限、引用与效果评测 |

目录内说明见[代码导航](../../code/README.md)及[测试导航](../../tests/README.md)。已有路由和组件兼容入口保留；旧文档路径保留导航，不维护重复正文。

## 当前文档与历史记录

- 根 README 负责新成员启动、当前能力与入口，不堆叠全部产品规格。
- `requirements`、`algorithm`、`software` 更新为当前目标与设计；正文开头区分已实现原型和未接入服务，避免把目标写成验收结果。
- `mgmt` 的计划可以更新；已发生的沟通、反馈和提交记录保留日期与依据。`retrospection` 按日期追加，不改写旧的决定。
- 原型设计提示、参考图与实测截图仍在 `software/prototype`；首轮实现记录标注为阶段记录，当前范围指向后续扩展说明。
- 旧 `docs/*.md` 和 `docs/modules` 仅用于兼容导航，不重新复制正文。

## 接入数据库与 Agent 前的剩余工作

本次完成职责拆分，不提前生成空仓储或供应商实现。下一阶段先给真实服务建立异步客户端和身份合同，再实现仓储、材料权限、事务及删除测试；之后通过 `KnowledgeRetriever`、`ModelAdapter` 接入已发布知识与模型。

同步 `DataClient`、浏览器存储和固定合成评分都属于演示。接口清单不等于已实现业务服务。样式当前仍按原有四份全局文件顺序加载，后续迁移按页面核对视觉，不在此次目录整理中改版。
