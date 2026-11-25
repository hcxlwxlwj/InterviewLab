# InterviewLab · 面试练习室

面向高校学生的岗位模拟面试与复盘应用，围绕课程、比赛、科研、毕设和实习经历练习个人贡献、方案选择与验证过程。

当前已有真实账号、持久化文字面试、动态提问、报告、重练、比较和历史；支持结构化文本简历及可配置语音/视频呈现。本次新增全岗位 Agent 工作流、简历事实分析、面前规划和全岗位知识索引流水线，统一使用新 Agent，旧执行链与演示入口已清退。专业内容覆盖、人工质量门槛与真实媒体效果尚未完全验收，见[验证结果](docs/algorithm/evaluation.md)。

## 本地运行

Node.js 24 / npm 11。在根目录安装依赖，根据 `.env.example` 配置本机数据库、认证和模型密钥。不要覆盖已有 `.env` 或提交私有数据。

```bash
npm ci
npm run db:migrate
npm run dev:api
```

另开两个终端运行 `npm run dev:worker`、`npm run dev`，访问 [本机首页](http://127.0.0.1:3000/) 注册或登录。首页可单独浏览，业务页面需要真实登录与数据库。完整配置、索引构建及回退只在[运行指南](docs/software/development.md)维护；语音供应商配置见[语音设计](docs/software/voice-interview.md)。

## 能力与边界

| 模块 | 当前状态 |
| --- | --- |
| 账号 | 邮箱密码注册/登录、Cookie、退出、本人数据隔离 |
| 岗位 | 1269 个模板、10148 道活跃主问题、搜索/分类/阶段/详情及来源 |
| 材料 | 文字版 PDF / TXT 提取、结构化简历核对、确认与版本选择；Agent 分析状态和重试 |
| Agent | graph-v1 唯一运行时，使用 LangChain 模型层、LangGraph 三条有界工作流，准备失败可显式简化 |
| 知识 | 同源内容及 48 道独立补充题、98 道课程题，类型与适用绑定、混合检索、断点构建/发布/回退；正式真实全量向量版本未在日常库发布 |
| 面试 | 文字、语音、视频共享准备/回答/提问；视频仅本机摄像头/屏幕预览和语音驱动形象 |
| 面后 | 原证据报告、浏览器打印另存 PDF、同题重练、比较、历史及删除；不按简历增加分数 |
| 后续 | OCR、原文件存储、代码执行、视觉分析、完整声学指标、全岗位专家评分校准 |

当前主问题共 10152 条记录，其中原有 8000 条记录保留，4 条已合并且不参与新检索；新增 269 个岗位包含 2152 道主问题。补充题和课程题分别维护，完整统计见[内容清单](docs/algorithm/content/README.md)。

“全岗位”表示统一流程、现有内容接入和可追溯提问。九类基础资料不构成全部细分岗位的完整专业知识；框架和向量接通不代表效果验收通过。PDF 导入只提取文字供本人核对，不保存原文件；PDF 导出使用浏览器打印。业务仅保留真实账号与 HTTP 流程，演示入口已删除。

## 工程与文档

```text
docs/              requirements / algorithm / software / mgmt / retrospection
code/backend/      Fastify、Drizzle/PostgreSQL、任务、Agent 与模型适配
code/frontend/     Next.js 页面、同源客户端、媒体呈现
code/core_engine/  无框架依赖的共享 DTO、领域规则与端口
tests/             unit / integration / support
```

按老师模板整理，代码目录保持现有布局。[文档总导航](docs/README.md)包含“需求 → 工作流 → 接口与数据 → 测试证据”对应表。建议先读[系统架构](docs/software/architecture.md)、[Agent 架构](docs/software/interview-agent-implementation.md)、[工作流](docs/software/interview-agent-implementation.md)、[数据库](docs/software/data_and_interfaces.md)。

## 检查与协作

```bash
npm run check
npm run build:backend
npm run build
npm run openapi:generate
```

数据库、进程、代理和真实模型检查见[测试说明](tests/README.md)，仅使用显式 `interviewlab_test*`；它们会清理测试数据。Next 开发和生产构建不要同时占用同一 `.next`。

历史改造的保护点与验证见[实施记录](docs/retrospection/2026-11-04-agent-engineering.md)。2026-11-25 的规范整改、扫描和未完成验收见[代码质量报告](docs/software/code_quality.md)与[代码评审记录](docs/software/code_review.md)；相关提交已通过 [PR #54](https://github.com/hcxlwxlwj/InterviewLab/pull/54) 合入 `main`，不代表已部署或完成产品效果验收。协作规则见[协作须知](docs/mgmt/COLLABORATION.md)。
