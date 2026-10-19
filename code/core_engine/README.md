# 领域核心 · @interviewlab/core

此包提供与框架、存储和供应商无关的类型与规则。仅允许相对引用本包源码，不从外部包或内容 JSON 读取数据。

| 文件 | 职责 |
| --- | --- |
| `src/domain/interview.ts` | 配置、简历、经历、会话、回答、报告等共享对象 |
| `src/domain/knowledge.ts` | 岗位、来源、知识、查询及检索接口 |
| `src/ports.ts` | 模型、语音、执行、存储、会话仓储与演示数据客户端合同 |
| `src/configuration.ts` | 默认配置与显示标签 |
| `src/questions.ts` | 根据传入的模板生成预设题目，控制主问题/追问预算 |
| `src/session.ts` | 提交幂等、暂停、结束及 12 分钟安全上限 |
| `src/report.ts` | 仅对已观察且非空维度汇总分数 |
| `src/knowledge.ts` | 使用调用方传入数据建立注册表、筛选及确定性检索 |
| `src/index.ts` | 稳定的公共导出入口 |

`buildQuestions(configuration, template)` 显式接收模板；新面试由内容适配器解析岗位，历史面试使用被冻结的内容，不读取不断变化的全局题库。默认配置沿用原型初始值；前端演示客户端会按当前简历和偏好重新选择材料。

合成简历、示例会话与演示报告已移到 `@interviewlab/backend/content/demo`。此处定义的 `DataClient` 是同步演示合同，不是已完成的 HTTP 客户端；真实服务需要独立的异步合同、加载及错误处理。

在仓库根目录执行 `npm test` 和 `npm run boundaries:check`。规则测试在[单元测试目录](../../tests/unit)。
