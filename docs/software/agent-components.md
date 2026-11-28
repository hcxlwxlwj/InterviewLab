# Agent 五部分与代码规范

更新：2026-11-28。本文按课程示例中的任务拆解、工具调用、记忆、护栏、专业知识库核对面试与报告两个 Agent；示例的 Python 文件名对应本项目的 TypeScript 文件，不迁移语言或更换框架。

## 1. 核对结论

整理前，面试 Agent 已有规划、记忆、护栏和公开知识适配，但分散在不同目录，缺少统一的核心文件位置及工具注册和调用轨迹。报告 Agent 已有逐题评价、总结、建议和证据校验，任务规划、工作记忆、专业参考过滤分别内嵌在执行文件中，不能从五部分直接定位。

流式执行、评分和总结是已有 Agent 能力的实现，归入五部分中的工具调用。它们与提示词、准备工作流和输出结构一起融合到所属核心文件，按函数划分内部步骤，保留原有校验和取消行为。各 Agent 的知识目录适配同一套公开资料和冻结检索结果，记忆为本场或本次任务的工作记忆。

两个 Agent 各保留五个核心文件和一个知识入口，共 12 个源码文件；共用模型传输、工作流、工具轨迹和两个装配入口有 5 个，本说明覆盖 17 个源码文件。Agent 内不再平铺独立的运行时、评分、总结或合同文件。

| 五个部分 | 面试 Agent | 报告 Agent |
| --- | --- | --- |
| 任务拆解 | `core/planner.ts` 实现简历分析、面前规划及单轮目标、时间和题量规划 | `core/planner.ts` 定义逐题、总结、建议三个阶段，准备各阶段上下文；评分视图排除简历和简历分析 |
| 工具调用 | `core/tools.ts` 实现提示词组装、流式生成及受限结果解析，注册检索和问题生成工具 | `core/tools.ts` 实现逐题评价、总结、练习建议和重练比较，注册相应阶段工具；`core/agent.ts` 编排执行 |
| 记忆 | `core/memory.ts` 校验目标、原文证据、重复意图，生成本场私有记忆候选 | `core/memory.ts` 为回答和已校验结论建立带 turn/revision 的原文证据编号目录，供评价及总结引用 |
| 护栏 | `core/guardrails.ts` 集中检查问题、来源、回答引用、重复、中性承接、提问策略及预览 | `core/guardrails.ts` 定义输出 schema 和版本合同，校验回答资格、评分、维度覆盖及逐字证据 |
| 专业知识库 | `knowledge/index.ts` 加载已发布且适用于岗位和招聘阶段的结构化知识；检索复用公共知识模块 | `knowledge/references.ts` 从冻结检索结果中选取专业资料、题目和评价参考，检查版本与来源白名单 |

## 2. 带注解目录

以下路径均从 `code/backend/src/` 起算。

```text
modules/
├── interviews/agent/                 # 面试 Agent：推进当前面试
│   ├── core/
│   │   ├── planner.ts                # 简历分析、面前规划及单轮目标与节奏规划
│   │   ├── tools.ts                  # 检索工具、提示词组装、流式生成和结果解析
│   │   ├── agent.ts                  # LangGraph 单轮入口及输入输出接口
│   │   ├── memory.ts                 # 本场私有记忆的初始值、证据校验和有限更新
│   │   └── guardrails.ts             # 问题、来源、原文引用、策略及预览检查
│   └── knowledge/
│       └── index.ts                  # 已发布岗位、题目和来源的结构化适配
├── reports/agent/                    # 报告 Agent：分析已经保存的作答
│   ├── core/
│   │   ├── planner.ts                # 报告阶段规划、评分视图和上下文过滤
│   │   ├── tools.ts                  # 逐题评分、总结、建议、比较及工具白名单
│   │   ├── agent.ts                  # LangGraph 编排、模型调用适配和能力装配
│   │   ├── memory.ts                 # 本次评价和总结使用的证据编号工作记忆
│   │   └── guardrails.ts             # 输出 schema、版本合同、评分及原文证据校验
│   └── knowledge/
│       └── references.ts             # 同版本、允许来源和适用类型的专业参考过滤
├── knowledge/                       # 共享公共知识编译、向量化、检索及版本发布
├── agent-runtime.ts                 # 组合面试与报告模型能力，注入业务服务
└── interview-runtime.ts             # 业务装配：简历、面试、报告、知识和任务处理器
foundation/agent/
├── graph.ts                         # 共享 prepare_context → model → validate 有界图
├── model.ts                         # 两个 Agent 共用的 LangChain ChatOpenAI 传输
└── tools.ts                         # 工具元数据、类型化调用和脱敏轨迹
```

`core` 是各 Agent 的核心实现目录；前后端共享领域包仍为 `code/core_engine`，两者职责不同。Agent 的 `core` 可以依赖 LangGraph、后端配置等，`core_engine` 继续保持无框架依赖。核心文件内部按中文分段和函数组织规划、调用、解析及校验，代码长度不改变功能的职责归属。

## 3. 实际调用链

面试业务任务先经 `retrieve_context` 按冻结知识版本取得适用片段，再调用 `core/agent.ts`。图在准备节点确认上下文，执行 `generate_question`；`core/tools.ts` 中的流式函数调用 `core/planner.ts` 准备目标与合法动作，组装提示并通过 LangChain 调用模型。记忆和护栏校验后返回候选结果，业务服务复核任务、回答 revision、取消及删除状态，最后事务提交正式问题和私有记忆。简历事实分析和面前规划的短工作流也在 `core/planner.ts` 中实现。

报告业务服务按完成状态登记逐题、总结和建议任务。每个阶段调用 `core/agent.ts`，由 `core/planner.ts` 准备输入，再执行 `core/tools.ts` 内对应的评价、总结或建议函数；重练比较由同一工具模块的比较函数处理，模型调用适配与能力装配归 `core/agent.ts`。逐题评价用 `evaluationAnswerEvidence` 建立原文编号，整场总结用 `summaryEvidenceMemory` 复用已校验结论的引用；`knowledge/references.ts` 只允许当前冻结版本、来源白名单内的专业参考，最多五条。结果经护栏验证后交回报告服务保存。练习建议可以使用确认简历的背景，逐题评分和总结的模型输入不接收简历原文或简历事实分析。

任务恢复仍由 PostgreSQL、tasks/outbox 和 pg-boss 控制。图的内存状态和工具执行成功都不等于正式业务提交；这次整理未增加 LangGraph checkpointer，也未改变数据库结构、HTTP 合同或原有评分规则。

## 4. 工具与文件规范

- 每个 Agent 保留 `core/planner.ts`、`core/tools.ts`、`core/agent.ts`、`core/memory.ts`、`core/guardrails.ts` 和一个实际调用的 `knowledge/` 入口。
- 规划、生成、评分、总结等实现放入所属职责文件；内部用函数和中文分段组织，同一职责通过对应核心文件提供入口。
- 工具显式维护名称、描述及参数名称，输入和输出继续由 TypeScript 合同、现有 Zod schema、知识过滤与业务护栏校验。程序按阶段调用工具，不把参数名称列表当作运行时 JSON Schema。
- `foundation/agent/tools.ts` 仅记录 `tool`、`duration_ms`、`status`，不记录参数、返回值或供应商原始错误。工具抛出的原始错误交由现有调用链处理，不吞掉取消、超时或业务异常。
- 两个 Agent 目录的所有 TypeScript 文件、共享图、模型和工具文件以及 Agent 装配入口，均以中文文件头注释说明用途。目录或职责变化时同步更新注释、导入、测试和[完整文件树](project-file-tree.md)。
- 保留 LangChain 模型适配和 LangGraph 有界工作流；不新增无限循环、任意代码执行、模型写库权限、跨用户记忆或独立知识副本。

图片示例中的医疗工具、用药安全、长期学习画像属于示例领域。本项目按面试领域实现对应职责，不照搬医疗功能，也不将文件齐全视为专业效果、真实语音设备或 A1–A11 用户测试已经通过。

## 5. 验证入口

`tests/unit/agent-structure.test.ts` 核对核心文件、知识目录和中文文件头；报告组件及工具回归检查规则规划、证据记忆、专业参考过滤、实际工具调用和脱敏轨迹。运行结果以本次执行记录为准。

在仓库根目录执行 `npm run check` 检查依赖边界、类型、公开内容、普通测试与文档；执行 `npm run build:backend` 验证 API 和 worker 构建。独立数据库、进程及真实模型验证需要单独的环境，见[测试说明](../../tests/README.md)，不可用静态文件检查替代。
