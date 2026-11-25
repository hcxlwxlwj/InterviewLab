# 0. 评审注意事项

* 建议时长 1.5-2小时
* 针对业务逻辑复杂的、有技术难度的、耗费资源多的、能力较弱的工程师所写代码。
* 评审前需做好准备
* 填写说明：对每一个检查项目，根据具体情况填写结果，如“是、否、不适用、具体的名称”等。

* v1.5 结构整改对象：`4b08a0f` 后的 8 份产品源码、2 份测试；严格度 strict；源码 Diff 1919 行，TH-11 未通过，见 G2。
* v1.6 按用户最终确认采用双入口：通用入口保留岗位下拉，岗位库明确选岗后固定展示。最终净修改 9 份 TS/TSX 产品文件、1 份 CSS、2 份测试；范围扫描仍复核涉及的15份产品文件及2份测试，见第 5 章 UI-01/UI-02 及附录 F。下文 423 条产品告警、8 条测试告警、重复率与覆盖率均为 v1.5 快照，不是包含本次 UI 修改的全量复扫。
* v1.7 按用户要求重启本地API/worker并复核新增代码：本轮4份产品源码、2份测试，审查12份产品源码与3份测试。当前局部0Error/11Warning与85.01%插入行覆盖见附录 G，不能替代v1.5全量或v1.6较大局部快照。
* 全对话历史保留在附录 A、D；v1.5 S0–S6见附录 E，v1.6见附录 F，v1.7见附录 G。

* v1.8：fetch并快进到be648d9，三处冲突合回；本次18产品文件strict0Error/109Warning，详见附录H。历史范围分别保留。

# 1.关于代码

|  检查项目  | 结果  |说明|
|  :----  |  :----------:  |  :----  |
| 模块名 | InterviewLab 软件工程规范检查与整改 | 涵盖首次课件对照、需求与管理文档、测试证据、代码扫描、缺陷修复、职责重构和复扫。全过程见附录 A，全部改动清单见 [质量报告](code_quality.md)。 |
| 审查人员 | AI 自审（CodeQualitySkill） | CodeQualitySkill v2.0；辅助分工与独立复核已执行，团队人工评审及签署仍待实际登记。 |
| 版本 | 1.8，远端同步与新增代码检查 | 4b08a0f→be648d9；stash备份保留，旧修改逐项合回。 |
| 日期 | 2026-11-26 | 本轮跨2026-11-25至26日完成；本表保留 2026-11-15 起的全部历史阶段；本轮日期以客户端给定日期记录。 |
| 程序设计语言 | TypeScript、TSX、JavaScript；Markdown | Fastify 后端、React / Next.js 前端、共享领域规则；规范和报告用 Markdown 记录。 |
| 作者 | Git 记录账号 hcxlwxlwj、Rita1212；Codex 辅助整改与报告编制 | 沟通和风险计划的有效修订在首次检查前已存在，用户确认后纳入提交。实际组员姓名及人工评审记录由团队登记。 |
| 文件数 | 远端36文件；本次产品扫描18文件 | 远端16份TS/TSX加承接改动的setup-panels/summary；CSS、SQL、文档与测试另核验。 |

# 2.自动检查

|  检查项目  | 结果  |说明|
|  :----  |  :----------:  |  :----  |
| 代码通过编译，没有任何错误 | 是 | v1.7最终npm run check的tsc、边界和内容检查通过；显式workspace webpack在同盘隔离副本编译/类型/页面生成通过。首次根命令未透传参数导致隔离Turbopack构建失败，修正验证命令后通过，见质量报告附录I。 |
| 代码通过编译，没有任何警告信息 | 是 | 最终类型和webpack构建未见编译警告；本次局部Lint Warning11另列，不把结构告警冒充编译告警，也不写成Lint零告警。 |
| 存在单元测试 | 是 | 普通351/351；全量DB89/89后新增已作答续时场景的面试专项46/46；c8合并覆盖178/197=90.36%，重复运行不相加。真实模型媒体未验收。 |
| 代码处于源代码版本控制之下 | 否 | 前期改动已提交并合并；v1.5 与本次 UI 的新增源码、测试和证据尚有未跟踪/未提交项。git status 可核验，见第 5 章 G1；不将前期提交当作本次已归档。 |
| 使用检查工具对代码进行了检查 | 是 | v1.7实际执行12份产品/3份测试strict、类型/边界/内容、测试/c8、jscpd、模块/条件/标记、npm audit和Gitleaks。工具、范围、不可变前后副本及摘要见质量报告附录I与setup-review附件。 |
| 检查工具名称 | ESLint 9.39.5、typescript-eslint 8.74.0、sonarjs 3.0.7、jscpd 4.0.8、TypeScript 5.9.3、c8 12.0.0、Gitleaks 8.30.1、npm audit | 隔离静态解析使用 TS 6.0.3；版本、配置、SHA-256 和实际输入见质量报告及 followup/scan.json。 |
| 使用检查工具检查的结果 | Error(0) / Warning(109) | 18产品文件起点109→结束109；逐项RS001–RS109。旧全量423+8和v1.7局部11属于不同范围。 |

# 3.设计

|  检查项目  | 结果  |说明|
|  :----  |  :----------:   |:----  |
| 代码已完成（相对于软件功能定义来说） | 是 | 本轮双入口、简历精简语义保留，UIQ01拆职责及UI03刷新错误保持配置已实现；完整回归/构建通过。结构、归档和真实产品效果验收仍未整体完成，见UIW01–UIW11、G1–G2、U2。 |
| 选择的算法模型很好 | 未知 | 模型、提示文本和引用规则保持既有语义，未重新做供应商比较、专业评分校准或真实模型质量评测，见第 5 章 U2。 |
| 采用了恰当的设计模式 | 是 | 沿用现有Provider、统一API和字段组件；本轮仅按配置状态、四组面板、摘要分职责，没有增加通用表单框架或新依赖。详见UIQ01与质量报告附录I。 |
| 任何缺失的功能都已在代码中清晰的标出 | 未知 | 本次确认的差距已记录，完整产品的规划功能、占位和 Issue 标记尚未逐项重审，见第 5 章 U3。 |
| 代码的结构很好 | 否 | 本次setup相关5模块strict0告警，但12份产品范围仍11条旧结构命中，见UIW01–UIW11；760源码变更行超过建议批量，见G2。v1.5的196长函数/111CC/41认知等只为历史全量快照，未据本次局部扫描重算。 |
| 存在设计文档 | 是 | 已有 [架构](../../../architecture.md)、[数据与接口](../../../data_and_interfaces.md)、[Agent 方法](../../../../algorithm/knowledge_and_agent.md)、[功能需求](../../../../requirements/functional_spec.md)、[非功能需求](../../../../requirements/nonfunctional_spec.md)和[用户故事](../../../../requirements/user_stories.md)。 |
| 代码与这些文档相符 | 是 | v1.7保持v1.6功能需求的双入口及简历行为，仅拆内部职责；前序7份文档的数量/运行时/PDF边界修订保持v1.5范围，见D13、质量报告附录F/I。 |

# 4.对代码编写质量的总体意见

## 风格

|  检查项目  | 结果  |说明|
|  :----  |  :----------:   |:----  |
| 代码的布局很清晰 | 否 | 本轮拆出的职责模块满足strict长度/复杂度；审查范围仍有旧长函数及认知复杂度命中，见UIW01–UIW11。不能将新文件达标写成全部源码已达标。 |
| 代码遵循项目的风格准则 | 是 | 本次源码整改复用既有组件、DTO、HTTP、ServiceError 和日志方式，修改文件已格式化；原有工作区改动逐项比对保留。 |
| 存在良好（无歧义）的公共API | 是 | 开始恢复、展示回执和进入操作的输入/返回类型明确，保留现有 HTTP 与服务端 DTO 合同；R3 记录了运行时校验边界。 |
| 选择的名称表达清晰和易理解 | 是 | `confirmQuestionPresentation`、`runInterviewEntry`、`usePreparedInterviewDevices`、`analysisPresentation` 等对应具体职责。 |

## 防御性编程

|  检查项目  | 结果  |说明|
|  :----  | :----------:   |:----  |
| 避免空指针 | 是 | 本轮最终类型检查通过，场次返回值检查同时核对运行状态、已进入 ID 及当前会话；空回答和可选资源路径有回归。真实设备异常仍见 U2。 |
| 数据类型选择正确并使用类型检查 | 是 | 使用共享 Interview、InterviewConfig、报告/证据类型及本地职责类型；最终 `tsc --noEmit` 和前端构建类型检查通过。 |
| 所有输入都经过验证 | 未知 | Fastify/Zod、模型 schema 及版本/幂等边界已有测试；统一成功 DTO 的客户端泛型只作静态约束，服务端负责当前响应校验。未完成全链外部输入/注入审计，见 R3、U3；不由泛型本身推断已确认漏洞。 |
| 限制资源使用 | 是 | 沿用请求超时、队列/任务限制、会话题量和硬上限；展示回执最多自动恢复重试一次，跨场次切换失效旧代并释放设备。长时资源观测见 U2。 |
| 控制并发 | 是 | 同场进入共享在途 Promise，跨场操作取消旧代；独立保存已进入 ID，旧 finally 不会清除新任务。4 个进入用例及数据库取消/迟到发布回归通过。 |
| 避免循环引用 | 未知 | 本轮完整源码模块图运行时环0、含类型边2组；2个Next生成类型导入为inventory外但文件实际存在，不是产品缺失模块。对象引用/长期泄漏未穷尽验证，见U2及本轮engineering-checks.json。 |
| 不存在特定编译器功能（C/C++） | 不适用 | 本次源码使用 TypeScript、TSX 和 JavaScript。 |

## 错误处理

|  检查项目  | 结果  |说明|
|  :----  |  :----------:   |:----  |
| 错误情况都得到了处理 | 未知 | 本次 R1、R2 已修复，状态、网络和报告失败回归通过；全部浏览器/供应商异常尚未穷举，见 U2、U3。 |
| 使用断言来验证逻辑 | 是 | 测试断言幂等键、版本、请求次数、新旧操作归属、取消先后、评分和引用；业务入口保留状态与证据校验。 |
| 代码是异常安全(exception safe)的 | 是 | 在本轮已核验范围中，UI03保留已加载目录和同key配置实例，临时读取错误可见且阻止开始/提交；SSR仅验证目录错误下真实hook仍初始化已知岗位且blocked；已编辑值跨刷新保持由同key源码复核，挂载后网络/事件交互仍未实测。前期事务和取消证据保持各自范围。 |
| 错误将被传播，而不会被隐藏 | 是 | UI03将目录刷新错误显示并提供重试，已有值不卸载配置，禁止错误状态提交；首次无目录仍显示加载/错误，不返回合成岗位。前期R1及模型/HTTP错误传播语义保留。 |
| 本地有日志文件 | 是 | 本轮命令输出留存在本地临时验证目录，后端沿用结构化日志。扫描数据和截图随报告保存；日志及真实个人材料未新增到仓库附件。 |
| 没有任何资源被泄露 | 未知 | 设备释放、取消、迟到权限结果和场次切换已核查，尚未完成长时浏览器内存与设备占用观测，见 U2。 |
| 代码使用多线程 | 是 | 按 Skill E-07 将异步并发计入本项：Promise、API/worker 独立进程及媒体异步路径并存；不声称使用共享内存线程。 |
| 它是线程安全的 | 未知 | 任务并发、幂等、取消和版本隔离在已列场景中回归通过；完整并发/等待链与长时媒体观测尚未完成，见 U2–U3。 |
| 不会发生死锁 | 未知 | 进入请求完成/失败/取消和数据库任务路径已回归；完整等待链与锁序专项分析未执行，见 U3。 |
##  结构

|  检查项目  | 结果  |说明|
|  :----  | :----------:   |:----  |
| 不存在冗余的代码 | 未知 | 新增函数均有调用方，完整死代码、未使用导出及依赖审计未执行，见 U3。 |
| 不存在剪切粘贴式的编程 | 否 | 本轮6行/50token/mild主检测0→0，但6行/1token原始重叠候选126→127尚未逐块人工核验，不宣称strict零重复通过。v1.5的10块/80行及DUP清单保留原范围，见本次duplication-probe.json及U1。 |

# 5.代码审查 清单

## 语句级审查

|  文件  |行   |问题   |说明|
|  :----  |   :----------:   |:----------: |  :----  |
| code/frontend/features/live-interview/interview-notices.tsx | 60 | RS-UI 续时提示仍显示最初时长，新增提示组件过长 | [Major] 改显示累计时长并拆分时间决策；25分钟及27分钟硬截止断言通过。【已修复 v1.8】 |
| code/backend/src/modules/interviews/repository.ts | 29 | RS001 Async function 'loadInterview' has too many lines (74). Maximum allowed is 40. | [Major][strict规则命中] 按职责继续核查，历史重复命中不相加为独立故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/repository.ts | 29 | RS002 Async function 'loadInterview' has a complexity of 16. Maximum allowed is 10. | [Major][strict规则命中] 按职责继续核查，历史重复命中不相加为独立故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/repository.ts | 103 | RS003 Async function 'saveInterview' has too many lines (82). Maximum allowed is 40. | [Major][strict规则命中] 按职责继续核查，历史重复命中不相加为独立故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/repository.ts | 218 | RS004 Async function 'interviewEvent' has too many parameters (5). Maximum allowed is 4. | [Major][strict规则命中] 按职责继续核查，历史重复命中不相加为独立故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/routes.ts | 24 | RS005 Function 'interviewsModule' has too many lines (265). Maximum allowed is 40. | [Major][strict规则命中] 按职责继续核查，历史重复命中不相加为独立故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/routes.ts | 30 | RS006 Async method 'register' has too many lines (257). Maximum allowed is 40. | [Major][strict规则命中] 按职责继续核查，历史重复命中不相加为独立故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/routes.ts | 195 | RS007 Function 'turnCommand' has too many lines (44). Maximum allowed is 40. | [Major][strict规则命中] 按职责继续核查，历史重复命中不相加为独立故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/routes.ts | 198 | RS008 Function has too many parameters (5). Maximum allowed is 4. | [Major][strict规则命中] 按职责继续核查，历史重复命中不相加为独立故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/service.ts | 89 | RS009 Function 'fallbackQuestion' has a complexity of 12. Maximum allowed is 10. | [Major][strict规则命中] 按职责继续核查，历史重复命中不相加为独立故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/service.ts | 135 | RS010 Function 'createInterviewsService' has too many lines (833). Maximum allowed is 40. | [Major][strict规则命中] 按职责继续核查，历史重复命中不相加为独立故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/service.ts | 135 | RS011 Function 'createInterviewsService' has too many parameters (7). Maximum allowed is 4. | [Major][strict规则命中] 按职责继续核查，历史重复命中不相加为独立故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/service.ts | 192 | RS012 Async function 'mutate' has too many lines (46). Maximum allowed is 40. | [Major][strict规则命中] 按职责继续核查，历史重复命中不相加为独立故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/service.ts | 192 | RS013 Async function 'mutate' has too many parameters (6). Maximum allowed is 4. | [Major][strict规则命中] 按职责继续核查，历史重复命中不相加为独立故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/service.ts | 270 | RS014 Async function 'advanceAfterAnswer' has a complexity of 11. Maximum allowed is 10. | [Major][strict规则命中] 按职责继续核查，历史重复命中不相加为独立故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/service.ts | 326 | RS015 Async function 'start' has too many lines (77). Maximum allowed is 40. | [Major][strict规则命中] 按职责继续核查，历史重复命中不相加为独立故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/service.ts | 354 | RS016 Async arrow function has too many lines (49). Maximum allowed is 40. | [Major][strict规则命中] 按职责继续核查，历史重复命中不相加为独立故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/service.ts | 354 | RS017 Async arrow function has a complexity of 15. Maximum allowed is 10. | [Major][strict规则命中] 按职责继续核查，历史重复命中不相加为独立故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/service.ts | 401 | RS018 File has too many lines (972). Maximum allowed is 400. | [Major][strict规则命中] 按职责继续核查，历史重复命中不相加为独立故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/service.ts | 418 | RS019 Async arrow function has too many lines (146). Maximum allowed is 40. | [Major][strict规则命中] 按职责继续核查，历史重复命中不相加为独立故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/service.ts | 418 | RS020 Async arrow function has a complexity of 30. Maximum allowed is 10. | [Major][strict规则命中] 按职责继续核查，历史重复命中不相加为独立故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/service.ts | 512 | RS021 Async method 'commit' has a complexity of 23. Maximum allowed is 10. | [Major][strict规则命中] 按职责继续核查，历史重复命中不相加为独立故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/service.ts | 512 | RS022 Async method 'commit' has too many lines (50). Maximum allowed is 40. | [Major][strict规则命中] 按职责继续核查，历史重复命中不相加为独立故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/service.ts | 592 | RS023 Async method 'list' has too many lines (47). Maximum allowed is 40. | [Major][strict规则命中] 按职责继续核查，历史重复命中不相加为独立故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/service.ts | 592 | RS024 Async method 'list' has a complexity of 17. Maximum allowed is 10. | [Major][strict规则命中] 按职责继续核查，历史重复命中不相加为独立故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/service.ts | 700 | RS025 Method 'answer' has too many parameters (5). Maximum allowed is 4. | [Major][strict规则命中] 按职责继续核查，历史重复命中不相加为独立故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/service.ts | 736 | RS026 Method 'continueVoice' has too many parameters (5). Maximum allowed is 4. | [Major][strict规则命中] 按职责继续核查，历史重复命中不相加为独立故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/service.ts | 743 | RS027 Async arrow function has a complexity of 13. Maximum allowed is 10. | [Major][strict规则命中] 按职责继续核查，历史重复命中不相加为独立故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/service.ts | 777 | RS028 Method 'presented' has too many parameters (5). Maximum allowed is 4. | [Major][strict规则命中] 按职责继续核查，历史重复命中不相加为独立故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/service.ts | 788 | RS029 Method 'action' has too many parameters (5). Maximum allowed is 4. | [Major][strict规则命中] 按职责继续核查，历史重复命中不相加为独立故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/service.ts | 830 | RS030 Async arrow function has a complexity of 12. Maximum allowed is 10. | [Major][strict规则命中] 按职责继续核查，历史重复命中不相加为独立故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/service.ts | 856 | RS031 Async method 'createRetry' has too many lines (55). Maximum allowed is 40. | [Major][strict规则命中] 按职责继续核查，历史重复命中不相加为独立故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/service.ts | 928 | RS032 Async method 'maintain' has too many lines (42). Maximum allowed is 40. | [Major][strict规则命中] 按职责继续核查，历史重复命中不相加为独立故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/service.ts | 938 | RS033 Async arrow function has a complexity of 12. Maximum allowed is 10. | [Major][strict规则命中] 按职责继续核查，历史重复命中不相加为独立故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/streaming-agent.ts | 127 | RS034 Function 'canFinishAdvance' has a complexity of 16. Maximum allowed is 10. | [Major][strict规则命中] 按职责继续核查，历史重复命中不相加为独立故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/streaming-agent.ts | 166 | RS035 Function 'backgroundGoals' has a complexity of 19. Maximum allowed is 10. | [Major][strict规则命中] 按职责继续核查，历史重复命中不相加为独立故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/streaming-agent.ts | 166 | RS036 Refactor this function to reduce its Cognitive Complexity from 19 to the 15 allowed. | [Major][strict规则命中] 按职责继续核查，历史重复命中不相加为独立故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/streaming-agent.ts | 246 | RS037 Function 'selectGoalOptions' has too many lines (42). Maximum allowed is 40. | [Major][strict规则命中] 按职责继续核查，历史重复命中不相加为独立故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/streaming-agent.ts | 288 | RS038 Function 'prepareAdvancePlan' has too many lines (63). Maximum allowed is 40. | [Major][strict规则命中] 按职责继续核查，历史重复命中不相加为独立故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/streaming-agent.ts | 288 | RS039 Function 'prepareAdvancePlan' has a complexity of 15. Maximum allowed is 10. | [Major][strict规则命中] 按职责继续核查，历史重复命中不相加为独立故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/streaming-agent.ts | 396 | RS040 Function 'advanceGoalIndices' has too many lines (44). Maximum allowed is 40. | [Major][strict规则命中] 按职责继续核查，历史重复命中不相加为独立故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/streaming-agent.ts | 401 | RS041 File has too many lines (1321). Maximum allowed is 400. | [Major][strict规则命中] 按职责继续核查，历史重复命中不相加为独立故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/streaming-agent.ts | 489 | RS042 Function 'createAdvanceSchemas' has too many lines (109). Maximum allowed is 40. | [Major][strict规则命中] 按职责继续核查，历史重复命中不相加为独立故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/streaming-agent.ts | 600 | RS043 Function 'buildAdvanceMessages' has too many lines (163). Maximum allowed is 40. | [Major][strict规则命中] 按职责继续核查，历史重复命中不相加为独立故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/streaming-agent.ts | 600 | RS044 Function 'buildAdvanceMessages' has a complexity of 21. Maximum allowed is 10. | [Major][strict规则命中] 按职责继续核查，历史重复命中不相加为独立故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/streaming-agent.ts | 600 | RS045 Refactor this function to reduce its Cognitive Complexity from 18 to the 15 allowed. | [Major][strict规则命中] 按职责继续核查，历史重复命中不相加为独立故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/streaming-agent.ts | 763 | RS046 Function 'createAdvanceChecks' has too many lines (140). Maximum allowed is 40. | [Major][strict规则命中] 按职责继续核查，历史重复命中不相加为独立故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/streaming-agent.ts | 793 | RS047 Arrow function has a complexity of 11. Maximum allowed is 10. | [Major][strict规则命中] 按职责继续核查，历史重复命中不相加为独立故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/streaming-agent.ts | 825 | RS048 Arrow function has too many lines (58). Maximum allowed is 40. | [Major][strict规则命中] 按职责继续核查，历史重复命中不相加为独立故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/streaming-agent.ts | 825 | RS049 Refactor this function to reduce its Cognitive Complexity from 20 to the 15 allowed. | [Major][strict规则命中] 按职责继续核查，历史重复命中不相加为独立故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/streaming-agent.ts | 825 | RS050 Arrow function has a complexity of 33. Maximum allowed is 10. | [Major][strict规则命中] 按职责继续核查，历史重复命中不相加为独立故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/streaming-agent.ts | 904 | RS051 Function 'createPreviewHandler' has too many lines (72). Maximum allowed is 40. | [Major][strict规则命中] 按职责继续核查，历史重复命中不相加为独立故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/streaming-agent.ts | 914 | RS052 Async arrow function has too many lines (61). Maximum allowed is 40. | [Major][strict规则命中] 按职责继续核查，历史重复命中不相加为独立故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/streaming-agent.ts | 914 | RS053 Refactor this function to reduce its Cognitive Complexity from 25 to the 15 allowed. | [Major][strict规则命中] 按职责继续核查，历史重复命中不相加为独立故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/streaming-agent.ts | 914 | RS054 Async arrow function has a complexity of 23. Maximum allowed is 10. | [Major][strict规则命中] 按职责继续核查，历史重复命中不相加为独立故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/streaming-agent.ts | 981 | RS055 Function 'advanceDecision' has too many lines (42). Maximum allowed is 40. | [Major][strict规则命中] 按职责继续核查，历史重复命中不相加为独立故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/streaming-agent.ts | 1024 | RS056 Function 'advanceObservation' has a complexity of 13. Maximum allowed is 10. | [Major][strict规则命中] 按职责继续核查，历史重复命中不相加为独立故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/streaming-agent.ts | 1049 | RS057 Function 'createAdvanceMemory' has too many lines (53). Maximum allowed is 40. | [Major][strict规则命中] 按职责继续核查，历史重复命中不相加为独立故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/streaming-agent.ts | 1049 | RS058 Function 'createAdvanceMemory' has a complexity of 16. Maximum allowed is 10. | [Major][strict规则命中] 按职责继续核查，历史重复命中不相加为独立故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/streaming-agent.ts | 1049 | RS059 Refactor this function to reduce its Cognitive Complexity from 19 to the 15 allowed. | [Major][strict规则命中] 按职责继续核查，历史重复命中不相加为独立故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/streaming-agent.ts | 1102 | RS060 Function 'createAdvanceQuestion' has too many lines (67). Maximum allowed is 40. | [Major][strict规则命中] 按职责继续核查，历史重复命中不相加为独立故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/streaming-agent.ts | 1102 | RS061 Function 'createAdvanceQuestion' has a complexity of 24. Maximum allowed is 10. | [Major][strict规则命中] 按职责继续核查，历史重复命中不相加为独立故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/streaming-agent.ts | 1102 | RS062 Refactor this function to reduce its Cognitive Complexity from 45 to the 15 allowed. | [Major][strict规则命中] 按职责继续核查，历史重复命中不相加为独立故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/streaming-agent.ts | 1186 | RS063 Function 'buildAdvanceResult' has too many parameters (5). Maximum allowed is 4. | [Major][strict规则命中] 按职责继续核查，历史重复命中不相加为独立故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/streaming-agent.ts | 1207 | RS064 Function 'createStreamingAgent' has too many lines (115). Maximum allowed is 40. | [Major][strict规则命中] 按职责继续核查，历史重复命中不相加为独立故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/streaming-agent.ts | 1215 | RS065 Async method 'advance' has too many lines (105). Maximum allowed is 40. | [Major][strict规则命中] 按职责继续核查，历史重复命中不相加为独立故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/streaming-agent.ts | 1215 | RS066 Async method 'advance' has too many parameters (6). Maximum allowed is 4. | [Major][strict规则命中] 按职责继续核查，历史重复命中不相加为独立故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/streaming-agent.ts | 1215 | RS067 Async method 'advance' has a complexity of 14. Maximum allowed is 10. | [Major][strict规则命中] 按职责继续核查，历史重复命中不相加为独立故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/streaming-agent.ts | 1215 | RS068 Refactor this function to reduce its Cognitive Complexity from 25 to the 15 allowed. | [Major][strict规则命中] 按职责继续核查，历史重复命中不相加为独立故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/voice/session.ts | 62 | RS069 Constructor has too many parameters (7). Maximum allowed is 4. | [Major][strict规则命中] 按职责继续核查，历史重复命中不相加为独立故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/voice/session.ts | 104 | RS070 Async method 'start' has too many lines (48). Maximum allowed is 40. | [Major][strict规则命中] 按职责继续核查，历史重复命中不相加为独立故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/voice/session.ts | 152 | RS071 Method 'audio' has a complexity of 17. Maximum allowed is 10. | [Major][strict规则命中] 按职责继续核查，历史重复命中不相加为独立故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/voice/session.ts | 196 | RS072 Method 'control' has too many lines (108). Maximum allowed is 40. | [Major][strict规则命中] 按职责继续核查，历史重复命中不相加为独立故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/voice/session.ts | 196 | RS073 Method 'control' has a complexity of 23. Maximum allowed is 10. | [Major][strict规则命中] 按职责继续核查，历史重复命中不相加为独立故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/voice/session.ts | 228 | RS074 Async arrow function has too many lines (76). Maximum allowed is 40. | [Major][strict规则命中] 按职责继续核查，历史重复命中不相加为独立故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/voice/session.ts | 228 | RS075 Refactor this function to reduce its Cognitive Complexity from 29 to the 15 allowed. | [Major][strict规则命中] 按职责继续核查，历史重复命中不相加为独立故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/voice/session.ts | 228 | RS076 Async arrow function has a complexity of 22. Maximum allowed is 10. | [Major][strict规则命中] 按职责继续核查，历史重复命中不相加为独立故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/voice/session.ts | 242 | RS077 Blocks are nested too deeply (4). Maximum allowed is 3. | [Major][strict规则命中] 按职责继续核查，历史重复命中不相加为独立故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/voice/session.ts | 306 | RS078 Async method 'reserveInputActivity' has too many lines (48). Maximum allowed is 40. | [Major][strict规则命中] 按职责继续核查，历史重复命中不相加为独立故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/voice/session.ts | 306 | RS079 Async method 'reserveInputActivity' has a complexity of 15. Maximum allowed is 10. | [Major][strict规则命中] 按职责继续核查，历史重复命中不相加为独立故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/voice/session.ts | 401 | RS080 File has too many lines (770). Maximum allowed is 400. | [Major][strict规则命中] 按职责继续核查，历史重复命中不相加为独立故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/voice/session.ts | 481 | RS081 Async method 'resetRecognition' has too many lines (126). Maximum allowed is 40. | [Major][strict规则命中] 按职责继续核查，历史重复命中不相加为独立故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/voice/session.ts | 492 | RS082 Arrow function has too many lines (94). Maximum allowed is 40. | [Major][strict规则命中] 按职责继续核查，历史重复命中不相加为独立故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/voice/session.ts | 494 | RS083 Async arrow function has too many lines (91). Maximum allowed is 40. | [Major][strict规则命中] 按职责继续核查，历史重复命中不相加为独立故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/voice/session.ts | 494 | RS084 Refactor this function to reduce its Cognitive Complexity from 45 to the 15 allowed. | [Major][strict规则命中] 按职责继续核查，历史重复命中不相加为独立故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/voice/session.ts | 494 | RS085 Async arrow function has a complexity of 50. Maximum allowed is 10. | [Major][strict规则命中] 按职责继续核查，历史重复命中不相加为独立故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/voice/session.ts | 535 | RS086 Blocks are nested too deeply (4). Maximum allowed is 3. | [Major][strict规则命中] 按职责继续核查，历史重复命中不相加为独立故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/voice/session.ts | 543 | RS087 Blocks are nested too deeply (4). Maximum allowed is 3. | [Major][strict规则命中] 按职责继续核查，历史重复命中不相加为独立故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/voice/session.ts | 610 | RS088 Async method 'submit' has too many lines (62). Maximum allowed is 40. | [Major][strict规则命中] 按职责继续核查，历史重复命中不相加为独立故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/voice/session.ts | 610 | RS089 Async method 'submit' has a complexity of 26. Maximum allowed is 10. | [Major][strict规则命中] 按职责继续核查，历史重复命中不相加为独立故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/voice/session.ts | 610 | RS090 Refactor this function to reduce its Cognitive Complexity from 16 to the 15 allowed. | [Major][strict规则命中] 按职责继续核查，历史重复命中不相加为独立故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/voice/session.ts | 672 | RS091 Method 'publish' has a complexity of 17. Maximum allowed is 10. | [Major][strict规则命中] 按职责继续核查，历史重复命中不相加为独立故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/voice/session.ts | 706 | RS092 Method 'say' has too many lines (44). Maximum allowed is 40. | [Major][strict规则命中] 按职责继续核查，历史重复命中不相加为独立故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/voice/session.ts | 706 | RS093 Method 'say' has a complexity of 12. Maximum allowed is 10. | [Major][strict规则命中] 按职责继续核查，历史重复命中不相加为独立故障。【未关闭，未豁免】 |
| code/core_engine/src/interview-policy.ts | 20 | RS094 Function 'interviewPolicy' has too many lines (88). Maximum allowed is 40. | [Major][strict规则命中] 按职责继续核查，历史重复命中不相加为独立故障。【未关闭，未豁免】 |
| code/core_engine/src/interview-policy.ts | 20 | RS095 Function 'interviewPolicy' has a complexity of 17. Maximum allowed is 10. | [Major][strict规则命中] 按职责继续核查，历史重复命中不相加为独立故障。【未关闭，未豁免】 |
| code/core_engine/src/interview-policy.ts | 20 | RS096 Refactor this function to reduce its Cognitive Complexity from 27 to the 15 allowed. | [Major][strict规则命中] 按职责继续核查，历史重复命中不相加为独立故障。【未关闭，未豁免】 |
| code/core_engine/src/interview-policy.ts | 109 | RS097 Function 'interviewPacing' has too many lines (57). Maximum allowed is 40. | [Major][strict规则命中] 按职责继续核查，历史重复命中不相加为独立故障。【未关闭，未豁免】 |
| code/core_engine/src/interview-policy.ts | 109 | RS098 Function 'interviewPacing' has a complexity of 31. Maximum allowed is 10. | [Major][strict规则命中] 按职责继续核查，历史重复命中不相加为独立故障。【未关闭，未豁免】 |
| code/frontend/components/interview-workspace.tsx | 69 | RS099 Function 'InterviewWorkspace' has too many lines (309). Maximum allowed is 40. | [Major][strict规则命中] 按职责继续核查，历史重复命中不相加为独立故障。【未关闭，未豁免】 |
| code/frontend/components/interview-workspace.tsx | 69 | RS100 Function 'InterviewWorkspace' has a complexity of 41. Maximum allowed is 10. | [Major][strict规则命中] 按职责继续核查，历史重复命中不相加为独立故障。【未关闭，未豁免】 |
| code/frontend/components/interview-workspace.tsx | 69 | RS101 Refactor this function to reduce its Cognitive Complexity from 19 to the 15 allowed. | [Major][strict规则命中] 按职责继续核查，历史重复命中不相加为独立故障。【未关闭，未豁免】 |
| code/frontend/features/live-interview/interview.tsx | 22 | RS102 Function 'InterviewBody' has too many lines (305). Maximum allowed is 40. | [Major][strict规则命中] 按职责继续核查，历史重复命中不相加为独立故障。【未关闭，未豁免】 |
| code/frontend/features/live-interview/interview.tsx | 22 | RS103 Function 'InterviewBody' has a complexity of 40. Maximum allowed is 10. | [Major][strict规则命中] 按职责继续核查，历史重复命中不相加为独立故障。【未关闭，未豁免】 |
| code/frontend/features/live-interview/voice/use-voice.ts | 30 | RS104 Function 'useInterviewVoice' has too many lines (291). Maximum allowed is 40. | [Major][strict规则命中] 按职责继续核查，历史重复命中不相加为独立故障。【未关闭，未豁免】 |
| code/frontend/features/live-interview/voice/use-voice.ts | 30 | RS105 Function 'useInterviewVoice' has a complexity of 12. Maximum allowed is 10. | [Major][strict规则命中] 按职责继续核查，历史重复命中不相加为独立故障。【未关闭，未豁免】 |
| code/frontend/features/live-interview/voice/use-voice.ts | 112 | RS106 Function 'createConnection' has too many lines (74). Maximum allowed is 40. | [Major][strict规则命中] 按职责继续核查，历史重复命中不相加为独立故障。【未关闭，未豁免】 |
| code/frontend/features/live-interview/voice/use-voice.ts | 115 | RS107 Arrow function has too many lines (59). Maximum allowed is 40. | [Major][strict规则命中] 按职责继续核查，历史重复命中不相加为独立故障。【未关闭，未豁免】 |
| code/frontend/features/live-interview/voice/use-voice.ts | 115 | RS108 Refactor this function to reduce its Cognitive Complexity from 19 to the 15 allowed. | [Major][strict规则命中] 按职责继续核查，历史重复命中不相加为独立故障。【未关闭，未豁免】 |
| code/frontend/features/live-interview/voice/use-voice.ts | 115 | RS109 Arrow function has a complexity of 20. Maximum allowed is 10. | [Major][strict规则命中] 按职责继续核查，历史重复命中不相加为独立故障。【未关闭，未豁免】 |
| code/frontend/features/live-interview/setup.tsx；code/frontend/features/live-interview/setup-controller.ts；code/frontend/features/live-interview/setup-panels.tsx；code/frontend/features/live-interview/setup-summary.tsx | setup.tsx:57；setup-controller.ts:25、49、81、97；setup-panels.tsx:9、199；setup-summary.tsx:19、46 | UIQ01 配置状态、流程与界面混在285行/CC31函数 | [Major][SM-B01+SM-C01] 分离读取分发、状态/简历、四组面板与摘要；ConfigurationForm降至11有效行/CC3，相关5模块全部函数最高CC6、正式strict0告警。删除恒空command，沿用真实flow.busy。【已修复 v1.7】 |
| code/frontend/features/live-interview/setup.tsx；code/frontend/features/live-interview/setup-controller.ts | 起点setup.tsx:31；当前setup.tsx:37、45–51；setup-controller.ts:107–118 | UI03 目录临时读取错误卸载表单，重试后丢失未提交选择 | [Major][SM-V15/E-03] 有目录值时保留同key配置实例，显示错误/重试；catalogError进入blocked/canStart并检查submit，无目录才整体加载/错误。同key实例保持经源码复核；SSR仅验证目录错误下仍初始化已知岗位且blocked，不声称执行前后刷新更新，挂载后网络/事件交互未实测。不称发现现有岗位不可用。【已修复 v1.7】 |
| code/frontend/components/job-library.tsx | 18 | UIW01 JobLibrary有效行159超过40 | [Major][SM-B01+TH-01] 本次范围复扫确认，和旧F332重叠，继续按职责拆分；非本轮新增功能缺陷。【未关闭，未豁免】 |
| code/frontend/components/job-library.tsx | 18 | UIW02 JobLibrary圈复杂度12超过10 | [Major][TH-02] 本次范围复扫确认，和旧F331重叠，保留当前命中。【未关闭，未豁免】 |
| code/frontend/components/job-library.tsx | 194 | UIW03 JobDetail有效行159超过40 | [Major][SM-B01+TH-01] 删除过时提示后仍过长，旧F333为其原快照162行，不覆盖历史值。【未关闭，未豁免】 |
| code/frontend/features/live-interview/analysis.tsx | 137 | UIW04 AnalysisBody有效行44超过40 | [Major][SM-B01+TH-01] 与旧F338同职责命中，当前行号因入口import改变，保留本次准确位置。【未关闭，未豁免】 |
| code/frontend/features/live-interview/preparation.tsx | 13 | UIW05 PreparationScreen有效行145超过40 | [Major][SM-B01+TH-01] 与旧F352重叠；本轮仅修改返回配置入口，未将此结构项写为已修。【未关闭，未豁免】 |
| code/frontend/features/live-interview/preparation.tsx | 13 | UIW06 PreparationScreen圈复杂度48超过10 | [Major][TH-02] 与旧F351重叠，按实际范围扫描保留。【未关闭，未豁免】 |
| code/frontend/features/live-interview/preparation.tsx | 13 | UIW07 PreparationScreen认知复杂度40超过15 | [Major][TH-03] 与旧F353重叠，需继续拆分状态判断职责。【未关闭，未豁免】 |
| code/frontend/features/live-interview/preparation.tsx | 159 | UIW08 PreparationBody有效行80超过40 | [Major][SM-B01+TH-01] 与旧F354重叠，保留当前行号与量化值。【未关闭，未豁免】 |
| code/frontend/features/personal-center/materials-workspace.tsx | 9 | UIW09 MaterialsWorkspace有效行204超过40 | [Major][SM-B01+TH-01] 与旧F407重叠；文案精简后的本次值为204，旧205仅为历史采样。【未关闭，未豁免】 |
| code/frontend/features/personal-center/materials-workspace.tsx | 9 | UIW10 MaterialsWorkspace圈复杂度19超过10 | [Major][TH-02] 与旧F406重叠，本轮未扩展到材料编辑器结构重构。【未关闭，未豁免】 |
| code/frontend/features/personal-center/materials-workspace.tsx | 99 | UIW11 上传处理回调有效行48超过40 | [Major][SM-B01+TH-01] 与旧F408同职责命中，当前行号99，保留当前证据。【未关闭，未豁免】 |
| code/frontend/app/interview/setup/page.tsx；code/frontend/features/live-interview/setup.tsx、setup-state.ts、setup-fields.tsx | page.tsx:4；setup.tsx:29、57；setup-controller.ts:25、81；setup-state.ts:46；setup-fields.tsx:4、36 | UI-01 已选岗位仍可在配置页改动，入口及旧配置影响明确选岗 | [Major][用户体验/入口一致性] 按用户最终确认区分入口：无job的通用配置保留下拉，明确job只读取并固定展示所选岗位，换岗须返回岗位库；空白job使用通用配置，重复参数返回岗位库，无效明确岗位显式报错。明确选择优先于旧岗位，同岗位保留设置；恢复时已知岗位保留，无岗位进入通用配置。沿用提交前ID与目录的一致性校验。新增入口/配置回归，定向23/23、最终完整336/336及隔离构建通过；Edge核对通用下拉选岗与岗位详情固定入口。【已修复】 |
| code/frontend/features/live-interview/setup.tsx、setup-fields.tsx；code/frontend/features/personal-center/materials-workspace.tsx；code/frontend/components/job-library.tsx | setup-panels.tsx:132、169；setup-fields.tsx:50；materials-workspace.tsx:158、173；job-library.tsx:342–347 | UI-02 简历多版本、选中摘要、冻结解释与相邻过时提示占用界面 | [Major][用户体验/文案一致性] 简历选项只显示标题，保留可选/不使用简历/管理入口，删除重复说明与冻结版本摘要；移除材料页重复说明及岗位页过时未接入文案。保留错误、空态、权限和媒体隐私提示；现有版本与快照合同不变。展示回归、双入口实页及最终完整检查/隔离构建通过。【已修复】 |
| code/frontend/features/live-interview/flow-provider.tsx | 初审 175；整改 134；entry-request.ts:7 | R2 进入操作和已运行场次资源缺少跨场次隔离 | [Critical][SM-V15+SM-V14] 按场次 ID 共享在途操作，独立记录已进入 ID；切换先释放媒体并清理绑定、草稿和降级状态；旧 finally 无法清新请求。【已修复，4 项回归通过】 |
| code/frontend/features/live-interview/interview.tsx | 初审 90–93；整改见 presentation-request.ts:21、use-question-presentation.ts:5 | R1 展示回执失败后被提前标记已确认 | [Critical][SM-V03+SM-V04] 读取权威状态后最多重试一次，同输入复用键、新版本换键；成功才确认，持续失败可见并可手动重试，取消或换题停止恢复。【已修复，5 项回归通过】 |
| .github/scripts/check-content.ts | 376 | I1 PR 合并结果中岗位数组误用集合计数属性 | [Major][类型错误] 最新主分支同步后的 publishedJobs 是数组，使用 size 导致 TS2339。先复现失败，再改为 length；独立隔离树 npm run check 通过，311 项测试及文档检查通过。【已修复，云端结果见 PR #54】 |
| README.md；code/backend/README.md；tests/README.md；functional_spec.md；problem_definition.md；knowledge_and_agent.md；architecture.md | 各文档当前能力表及入口说明 | D13 最新目录和已实现PDF能力与当前说明漂移 | [Major][SM-D03] 同步1269/10148及独立48/98；原8000与历史验收保留；修正退役演示入口、文字PDF提取和浏览器打印边界。【已修订 v1.5】 |
| code/backend/src/database/connection.ts | 14 | F001 Function 'createDatabase' has too many lines (54). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/foundation/config.ts | 65 | F002 Function 'loadConfig' has a complexity of 24. Maximum allowed is 10. | [Major][SM-B01+TH-02] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/foundation/config.ts | 65 | F003 Function 'loadConfig' has too many lines (49). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/foundation/config.ts | 65 | F004 Refactor this function to reduce its Cognitive Complexity from 16 to the 15 allowed. | [Major][SM-B01+TH-03] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/foundation/errors.ts | 16 | F005 Function 'installErrorHandler' has too many lines (41). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/accounts/auth-routes.ts | 31 | F006 Async function 'registerAuthRoutes' has too many lines (73). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/accounts/auth-routes.ts；code/backend/src/modules/accounts/auth-routes.ts | 76–82；60–66 | DUP09 同口径重复候选 7 行 | [Major][SM-D01+TH-08] 需结合职责判定与消除，未获团队豁免；低token探测另保存原始结果。【未关闭】 |
| code/backend/src/modules/accounts/auth-routes.ts；code/backend/src/modules/accounts/auth-routes.ts | 92–98；60–66 | DUP10 同口径重复候选 7 行 | [Major][SM-D01+TH-08] 需结合职责判定与消除，未获团队豁免；低token探测另保存原始结果。【未关闭】 |
| code/backend/src/modules/accounts/auth-service.ts | 12 | F007 Function 'createAuthService' has too many lines (167). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/accounts/auth-service.ts | 96 | F008 Async arrow function has too many lines (71). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/accounts/auth-service.ts | 100 | F009 Async arrow function has a complexity of 18. Maximum allowed is 10. | [Major][SM-B01+TH-02] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/accounts/auth-service.ts | 100 | F010 Refactor this function to reduce its Cognitive Complexity from 34 to the 15 allowed. | [Major][SM-B01+TH-03] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/accounts/auth-service.ts | 132 | F011 Blocks are nested too deeply (4). Maximum allowed is 3. | [Major][SM-B06+TH-04] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/accounts/auth-service.ts | 138 | F012 Blocks are nested too deeply (5). Maximum allowed is 3. | [Major][SM-B06+TH-04] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/accounts/auth-service.ts | 141 | F013 Blocks are nested too deeply (5). Maximum allowed is 3. | [Major][SM-B06+TH-04] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interview-runtime.ts | 28 | F014 Function 'createInterviewRuntime' has too many lines (103). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interview-runtime.ts | 55 | F015 Method 'context' has too many parameters (5). Maximum allowed is 4. | [Major][SM-B03+TH-05] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interview-runtime.ts | 84 | F016 Async method 'isCancelled' has a complexity of 15. Maximum allowed is 10. | [Major][SM-B01+TH-02] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interview-runtime.ts | 84 | F017 Async method 'isCancelled' has too many lines (45). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/agent.ts | 10 | F018 Function 'createInterviewAgent' has too many lines (43). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/agent.ts | 20 | F019 Async method 'advance' has too many parameters (6). Maximum allowed is 4. | [Major][SM-B03+TH-05] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/conversation.ts | 29 | F020 Function 'questionTopic' has a complexity of 12. Maximum allowed is 10. | [Major][SM-B01+TH-02] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/conversation.ts | 71 | F021 Function 'conversationPolicy' has a complexity of 18. Maximum allowed is 10. | [Major][SM-B01+TH-02] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/conversation.ts | 71 | F022 Function 'conversationPolicy' has too many lines (48). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/conversation.ts | 71 | F023 Refactor this function to reduce its Cognitive Complexity from 23 to the 15 allowed. | [Major][SM-B01+TH-03] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/conversation.ts | 87 | F024 Blocks are nested too deeply (4). Maximum allowed is 3. | [Major][SM-B06+TH-04] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/events.ts | 7 | F025 Function 'registerInterviewEvents' has too many lines (145). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/events.ts | 52 | F026 Async arrow function has too many lines (98). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/events.ts | 74 | F027 Async arrow function has a complexity of 13. Maximum allowed is 10. | [Major][SM-B01+TH-02] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/events.ts | 74 | F028 Async arrow function has too many lines (51). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/events.ts | 74 | F029 Refactor this function to reduce its Cognitive Complexity from 19 to the 15 allowed. | [Major][SM-B01+TH-03] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/events.ts | 112 | F030 Blocks are nested too deeply (4). Maximum allowed is 3. | [Major][SM-B06+TH-04] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/experience.ts | 75 | F031 Function 'learningBackground' has a complexity of 18. Maximum allowed is 10. | [Major][SM-B01+TH-02] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/experience.ts | 75 | F032 Refactor this function to reduce its Cognitive Complexity from 20 to the 15 allowed. | [Major][SM-B01+TH-03] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/experience.ts | 129 | F033 Function 'experiencePolicy' has a complexity of 49. Maximum allowed is 10. | [Major][SM-B01+TH-02] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/experience.ts | 129 | F034 Function 'experiencePolicy' has too many lines (123). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/experience.ts | 129 | F035 Refactor this function to reduce its Cognitive Complexity from 58 to the 15 allowed. | [Major][SM-B01+TH-03] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/experience.ts | 256 | F036 Function 'applyResumeExperience' has a complexity of 11. Maximum allowed is 10. | [Major][SM-B01+TH-02] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/experience.ts | 256 | F037 Function 'applyResumeExperience' has too many lines (60). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/experience.ts | 322 | F038 Function 'assertExperienceQuestion' has a complexity of 17. Maximum allowed is 10. | [Major][SM-B01+TH-02] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/graph.ts | 5 | F039 Async function 'checkedGraph' has too many lines (43). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/graph.ts | 5 | F040 Async function 'checkedGraph' has too many parameters (5). Maximum allowed is 4. | [Major][SM-B03+TH-05] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/memory.ts | 48 | F041 Function 'applyMemory' has a complexity of 16. Maximum allowed is 10. | [Major][SM-B01+TH-02] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/memory.ts；code/backend/src/modules/interviews/model-analysis.ts | 8–14；17–24 | DUP08 同口径重复候选 7 行 | [Major][SM-D01+TH-08] 需结合职责判定与消除，未获团队豁免；低token探测另保存原始结果。【未关闭】 |
| code/backend/src/modules/interviews/model-analysis.ts | 93 | F042 Function 'assertQuestion' has a complexity of 12. Maximum allowed is 10. | [Major][SM-B01+TH-02] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/model-analysis.ts | 122 | F043 Function 'createModelAnalysis' has too many lines (203). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/model-analysis.ts | 128 | F044 Async function 'call' has a complexity of 31. Maximum allowed is 10. | [Major][SM-B01+TH-02] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/model-analysis.ts | 128 | F045 Async function 'call' has too many lines (129). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/model-analysis.ts | 128 | F046 Async function 'call' has too many parameters (6). Maximum allowed is 4. | [Major][SM-B03+TH-05] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/model-analysis.ts | 128 | F047 Refactor this function to reduce its Cognitive Complexity from 36 to the 15 allowed. | [Major][SM-B01+TH-03] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/model-analysis.ts | 198 | F048 Blocks are nested too deeply (4). Maximum allowed is 3. | [Major][SM-B06+TH-04] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/model-analysis.ts | 200 | F049 Blocks are nested too deeply (4). Maximum allowed is 3. | [Major][SM-B06+TH-04] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/model-analysis.ts | 261 | F050 Async method 'compare' has too many lines (62). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/model-analysis.ts；code/backend/src/modules/reports/analysis.ts | 18–27；36–44 | DUP07 同口径重复候选 10 行 | [Major][SM-D01+TH-08] 需结合职责判定与消除，未获团队豁免；低token探测另保存原始结果。【未关闭】 |
| code/backend/src/modules/interviews/model.ts | 8 | F051 Function 'langChainFetch' has too many lines (94). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/model.ts | 9 | F052 Async arrow function has a complexity of 13. Maximum allowed is 10. | [Major][SM-B01+TH-02] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/model.ts | 9 | F053 Async arrow function has too many lines (92). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/participation.ts | 32 | F054 Function 'participationPolicy' has a complexity of 19. Maximum allowed is 10. | [Major][SM-B01+TH-02] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/participation.ts | 32 | F055 Function 'participationPolicy' has too many lines (63). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/participation.ts | 32 | F056 Refactor this function to reduce its Cognitive Complexity from 32 to the 15 allowed. | [Major][SM-B01+TH-03] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/preparation.ts | 46 | F057 Function 'createInterviewPreparation' has too many lines (280). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/preparation.ts | 46 | F058 Function 'createInterviewPreparation' has too many parameters (6). Maximum allowed is 4. | [Major][SM-B03+TH-05] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/preparation.ts | 89 | F059 Async function 'request' has too many lines (70). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/preparation.ts | 159 | F060 Async arrow function has too many lines (54). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/preparation.ts | 246 | F061 Async method 'maintain' has too many lines (78). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/preparation.ts | 278 | F062 Async arrow function has a complexity of 17. Maximum allowed is 10. | [Major][SM-B01+TH-02] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/preparation.ts | 278 | F063 Async arrow function has too many lines (44). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/repository.ts | 29 | F064 Async function 'loadInterview' has a complexity of 13. Maximum allowed is 10. | [Major][SM-B01+TH-02] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/repository.ts | 29 | F065 Async function 'loadInterview' has too many lines (73). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/repository.ts | 102 | F066 Async function 'saveInterview' has too many lines (81). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/repository.ts | 216 | F067 Async function 'interviewEvent' has too many parameters (5). Maximum allowed is 4. | [Major][SM-B03+TH-05] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/response-assessment.ts | 29 | F068 Function 'streamResponseAssessment' has too many lines (51). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/response-assessment.ts | 81 | F069 Function 'assertResponseAssessment' has a complexity of 13. Maximum allowed is 10. | [Major][SM-B01+TH-02] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/response-assessment.ts；code/backend/src/modules/reports/analysis.ts | 15–22；68–75 | DUP06 同口径重复候选 8 行 | [Major][SM-D01+TH-08] 需结合职责判定与消除，未获团队豁免；低token探测另保存原始结果。【未关闭】 |
| code/backend/src/modules/interviews/routes.ts | 24 | F070 Function 'interviewsModule' has too many lines (264). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/routes.ts | 30 | F071 Async method 'register' has too many lines (256). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/routes.ts | 194 | F072 Function 'turnCommand' has too many lines (44). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/routes.ts | 197 | F073 Function has too many parameters (5). Maximum allowed is 4. | [Major][SM-B03+TH-05] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/routes.ts；code/backend/src/modules/interviews/routes.ts | 222–236；111–125 | DUP05 同口径重复候选 15 行 | [Major][SM-D01+TH-08] 需结合职责判定与消除，未获团队豁免；低token探测另保存原始结果。【未关闭】 |
| code/backend/src/modules/interviews/routes.ts；code/backend/src/modules/reports/routes.ts | 29–35；12–18 | DUP04 同口径重复候选 7 行 | [Major][SM-D01+TH-08] 需结合职责判定与消除，未获团队豁免；低token探测另保存原始结果。【未关闭】 |
| code/backend/src/modules/interviews/schemas.ts | 原141（已删除） | K1 冗余转导出形成运行时模块环 | [Major][SM-K02] 调用方原本直接引用报告模块，删除未使用转导出，运行时环1→0；48项专项及最终回归通过。【已修复 v1.5】 |
| code/backend/src/modules/interviews/service.ts | 87 | F074 Function 'fallbackQuestion' has a complexity of 12. Maximum allowed is 10. | [Major][SM-B01+TH-02] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/service.ts | 133 | F075 Function 'createInterviewsService' has too many lines (813). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/service.ts | 133 | F076 Function 'createInterviewsService' has too many parameters (7). Maximum allowed is 4. | [Major][SM-B03+TH-05] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/service.ts | 190 | F077 Async function 'mutate' has too many lines (46). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/service.ts | 190 | F078 Async function 'mutate' has too many parameters (6). Maximum allowed is 4. | [Major][SM-B03+TH-05] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/service.ts | 262 | F079 Async function 'advanceAfterAnswer' has a complexity of 12. Maximum allowed is 10. | [Major][SM-B01+TH-02] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/service.ts | 318 | F080 Async function 'start' has too many lines (77). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/service.ts | 346 | F081 Async arrow function has a complexity of 15. Maximum allowed is 10. | [Major][SM-B01+TH-02] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/service.ts | 346 | F082 Async arrow function has too many lines (49). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/service.ts | 401 | F083 File has too many lines (950). Maximum allowed is 400. | [Major][SM-B02+TH-06] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/service.ts | 410 | F084 Async arrow function has a complexity of 30. Maximum allowed is 10. | [Major][SM-B01+TH-02] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/service.ts | 410 | F085 Async arrow function has too many lines (145). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/service.ts | 504 | F086 Async method 'commit' has a complexity of 23. Maximum allowed is 10. | [Major][SM-B01+TH-02] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/service.ts | 504 | F087 Async method 'commit' has too many lines (49). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/service.ts | 583 | F088 Async method 'list' has a complexity of 17. Maximum allowed is 10. | [Major][SM-B01+TH-02] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/service.ts | 583 | F089 Async method 'list' has too many lines (47). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/service.ts | 678 | F090 Method 'answer' has too many parameters (5). Maximum allowed is 4. | [Major][SM-B03+TH-05] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/service.ts | 714 | F091 Method 'continueVoice' has too many parameters (5). Maximum allowed is 4. | [Major][SM-B03+TH-05] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/service.ts | 721 | F092 Async arrow function has a complexity of 13. Maximum allowed is 10. | [Major][SM-B01+TH-02] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/service.ts | 755 | F093 Method 'presented' has too many parameters (5). Maximum allowed is 4. | [Major][SM-B03+TH-05] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/service.ts | 766 | F094 Method 'action' has too many parameters (5). Maximum allowed is 4. | [Major][SM-B03+TH-05] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/service.ts | 808 | F095 Async arrow function has a complexity of 12. Maximum allowed is 10. | [Major][SM-B01+TH-02] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/service.ts | 834 | F096 Async method 'createRetry' has too many lines (55). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/service.ts | 906 | F097 Async method 'maintain' has too many lines (42). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/service.ts | 916 | F098 Async arrow function has a complexity of 12. Maximum allowed is 10. | [Major][SM-B01+TH-02] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/stream-parser.ts | 2 | F099 Function 'jsonFields' has a complexity of 43. Maximum allowed is 10. | [Major][SM-B01+TH-02] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/stream-parser.ts | 2 | F100 Function 'jsonFields' has too many lines (90). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/stream-parser.ts | 2 | F101 Refactor this function to reduce its Cognitive Complexity from 81 to the 15 allowed. | [Major][SM-B01+TH-03] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/stream-parser.ts | 92 | F102 Async function 'readChatStream' has a complexity of 24. Maximum allowed is 10. | [Major][SM-B01+TH-02] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/stream-parser.ts | 92 | F103 Async function 'readChatStream' has too many lines (55). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/stream-parser.ts | 92 | F104 Refactor this function to reduce its Cognitive Complexity from 47 to the 15 allowed. | [Major][SM-B01+TH-03] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/stream-parser.ts | 115 | F105 Blocks are nested too deeply (4). Maximum allowed is 3. | [Major][SM-B06+TH-04] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/stream-parser.ts | 117 | F106 Blocks are nested too deeply (4). Maximum allowed is 3. | [Major][SM-B06+TH-04] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/stream-parser.ts | 122 | F107 Blocks are nested too deeply (4). Maximum allowed is 3. | [Major][SM-B06+TH-04] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/stream-parser.ts | 123 | F108 Blocks are nested too deeply (4). Maximum allowed is 3. | [Major][SM-B06+TH-04] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/stream-parser.ts | 125 | F109 Blocks are nested too deeply (5). Maximum allowed is 3. | [Major][SM-B06+TH-04] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/stream-parser.ts | 126 | F110 Blocks are nested too deeply (6). Maximum allowed is 3. | [Major][SM-B06+TH-04] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/stream-parser.ts | 127 | F111 Blocks are nested too deeply (5). Maximum allowed is 3. | [Major][SM-B06+TH-04] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/stream-parser.ts | 130 | F112 Blocks are nested too deeply (4). Maximum allowed is 3. | [Major][SM-B06+TH-04] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/stream-parser.ts | 133 | F113 Blocks are nested too deeply (4). Maximum allowed is 3. | [Major][SM-B06+TH-04] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/stream-parser.ts | 135 | F114 Blocks are nested too deeply (5). Maximum allowed is 3. | [Major][SM-B06+TH-04] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/streaming-agent.ts | 初轮 116；后续构造函数见 F 清单 | Q1 动态出题职责与 schema 长度 | [Major][SM-B01+SM-C01] 初轮 advance 192→14；v1.5 createAdvanceSchemas 39→10，新增策略≤9，320 个文本/模板片段 AST 一致。schema 109 有效行及历史大文件仍超 strict，未豁免。【复杂度已改，长度未关闭】 |
| code/backend/src/modules/interviews/streaming-agent.ts | 122 | F115 Function 'canFinishAdvance' has a complexity of 16. Maximum allowed is 10. | [Major][SM-B01+TH-02] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/streaming-agent.ts | 161 | F116 Function 'backgroundGoals' has a complexity of 19. Maximum allowed is 10. | [Major][SM-B01+TH-02] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/streaming-agent.ts | 161 | F117 Refactor this function to reduce its Cognitive Complexity from 19 to the 15 allowed. | [Major][SM-B01+TH-03] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/streaming-agent.ts | 241 | F118 Function 'selectGoalOptions' has too many lines (42). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/streaming-agent.ts | 283 | F119 Function 'prepareAdvancePlan' has a complexity of 15. Maximum allowed is 10. | [Major][SM-B01+TH-02] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/streaming-agent.ts | 283 | F120 Function 'prepareAdvancePlan' has too many lines (63). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/streaming-agent.ts | 391 | F121 Function 'advanceGoalIndices' has too many lines (44). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/streaming-agent.ts | 401 | F122 File has too many lines (1315). Maximum allowed is 400. | [Major][SM-B02+TH-06] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/streaming-agent.ts | 484 | F123 Function 'createAdvanceSchemas' has too many lines (109). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/streaming-agent.ts | 595 | F124 Function 'buildAdvanceMessages' has a complexity of 21. Maximum allowed is 10. | [Major][SM-B01+TH-02] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/streaming-agent.ts | 595 | F125 Function 'buildAdvanceMessages' has too many lines (162). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/streaming-agent.ts | 595 | F126 Refactor this function to reduce its Cognitive Complexity from 18 to the 15 allowed. | [Major][SM-B01+TH-03] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/streaming-agent.ts | 757 | F127 Function 'createAdvanceChecks' has too many lines (140). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/streaming-agent.ts | 787 | F128 Arrow function has a complexity of 11. Maximum allowed is 10. | [Major][SM-B01+TH-02] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/streaming-agent.ts | 819 | F129 Arrow function has a complexity of 33. Maximum allowed is 10. | [Major][SM-B01+TH-02] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/streaming-agent.ts | 819 | F130 Arrow function has too many lines (58). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/streaming-agent.ts | 819 | F131 Refactor this function to reduce its Cognitive Complexity from 20 to the 15 allowed. | [Major][SM-B01+TH-03] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/streaming-agent.ts | 898 | F132 Function 'createPreviewHandler' has too many lines (72). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/streaming-agent.ts | 908 | F133 Async arrow function has a complexity of 23. Maximum allowed is 10. | [Major][SM-B01+TH-02] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/streaming-agent.ts | 908 | F134 Async arrow function has too many lines (61). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/streaming-agent.ts | 908 | F135 Refactor this function to reduce its Cognitive Complexity from 25 to the 15 allowed. | [Major][SM-B01+TH-03] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/streaming-agent.ts | 975 | F136 Function 'advanceDecision' has too many lines (42). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/streaming-agent.ts | 1018 | F137 Function 'advanceObservation' has a complexity of 13. Maximum allowed is 10. | [Major][SM-B01+TH-02] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/streaming-agent.ts | 1043 | F138 Function 'createAdvanceMemory' has a complexity of 16. Maximum allowed is 10. | [Major][SM-B01+TH-02] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/streaming-agent.ts | 1043 | F139 Function 'createAdvanceMemory' has too many lines (53). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/streaming-agent.ts | 1043 | F140 Refactor this function to reduce its Cognitive Complexity from 19 to the 15 allowed. | [Major][SM-B01+TH-03] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/streaming-agent.ts | 1096 | F141 Function 'createAdvanceQuestion' has a complexity of 24. Maximum allowed is 10. | [Major][SM-B01+TH-02] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/streaming-agent.ts | 1096 | F142 Function 'createAdvanceQuestion' has too many lines (67). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/streaming-agent.ts | 1096 | F143 Refactor this function to reduce its Cognitive Complexity from 45 to the 15 allowed. | [Major][SM-B01+TH-03] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/streaming-agent.ts | 1180 | F144 Function 'buildAdvanceResult' has too many parameters (5). Maximum allowed is 4. | [Major][SM-B03+TH-05] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/streaming-agent.ts | 1201 | F145 Function 'createStreamingAgent' has too many lines (115). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/streaming-agent.ts | 1209 | F146 Async method 'advance' has a complexity of 14. Maximum allowed is 10. | [Major][SM-B01+TH-02] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/streaming-agent.ts | 1209 | F147 Async method 'advance' has too many lines (105). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/streaming-agent.ts | 1209 | F148 Async method 'advance' has too many parameters (6). Maximum allowed is 4. | [Major][SM-B03+TH-05] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/streaming-agent.ts | 1209 | F149 Refactor this function to reduce its Cognitive Complexity from 25 to the 15 allowed. | [Major][SM-B01+TH-03] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/streams.ts | 5 | F150 Function 'createGenerationStreams' has too many lines (83). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/voice/activity.ts | 18 | F151 Async function 'setVoiceInputActivity' has too many lines (55). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/voice/activity.ts | 24 | F152 Async arrow function has a complexity of 14. Maximum allowed is 10. | [Major][SM-B01+TH-02] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/voice/activity.ts | 24 | F153 Async arrow function has too many lines (48). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/voice/routes.ts | 33 | F154 Function 'registerVoiceRoutes' has too many lines (148). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/voice/routes.ts | 96 | F155 Arrow function has too many lines (83). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/voice/session.ts | 61 | F156 Constructor has too many parameters (7). Maximum allowed is 4. | [Major][SM-B03+TH-05] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/voice/session.ts | 103 | F157 Async method 'start' has too many lines (48). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/voice/session.ts | 151 | F158 Method 'audio' has a complexity of 16. Maximum allowed is 10. | [Major][SM-B01+TH-02] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/voice/session.ts | 195 | F159 Method 'control' has a complexity of 15. Maximum allowed is 10. | [Major][SM-B01+TH-02] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/voice/session.ts | 195 | F160 Method 'control' has too many lines (99). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/voice/session.ts | 218 | F161 Async arrow function has a complexity of 22. Maximum allowed is 10. | [Major][SM-B01+TH-02] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/voice/session.ts | 218 | F162 Async arrow function has too many lines (76). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/voice/session.ts | 218 | F163 Refactor this function to reduce its Cognitive Complexity from 29 to the 15 allowed. | [Major][SM-B01+TH-03] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/voice/session.ts | 232 | F164 Blocks are nested too deeply (4). Maximum allowed is 3. | [Major][SM-B06+TH-04] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/voice/session.ts | 296 | F165 Async method 'reserveInputActivity' has a complexity of 15. Maximum allowed is 10. | [Major][SM-B01+TH-02] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/voice/session.ts | 296 | F166 Async method 'reserveInputActivity' has too many lines (48). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/voice/session.ts | 401 | F167 File has too many lines (751). Maximum allowed is 400. | [Major][SM-B02+TH-06] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/voice/session.ts | 471 | F168 Async method 'resetRecognition' has too many lines (126). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/voice/session.ts | 482 | F169 Arrow function has too many lines (94). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/voice/session.ts | 484 | F170 Async arrow function has a complexity of 50. Maximum allowed is 10. | [Major][SM-B01+TH-02] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/voice/session.ts | 484 | F171 Async arrow function has too many lines (91). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/voice/session.ts | 484 | F172 Refactor this function to reduce its Cognitive Complexity from 45 to the 15 allowed. | [Major][SM-B01+TH-03] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/voice/session.ts | 525 | F173 Blocks are nested too deeply (4). Maximum allowed is 3. | [Major][SM-B06+TH-04] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/voice/session.ts | 533 | F174 Blocks are nested too deeply (4). Maximum allowed is 3. | [Major][SM-B06+TH-04] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/voice/session.ts | 600 | F175 Async method 'submit' has a complexity of 26. Maximum allowed is 10. | [Major][SM-B01+TH-02] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/voice/session.ts | 600 | F176 Async method 'submit' has too many lines (61). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/voice/session.ts | 600 | F177 Refactor this function to reduce its Cognitive Complexity from 16 to the 15 allowed. | [Major][SM-B01+TH-03] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/voice/session.ts | 661 | F178 Method 'publish' has a complexity of 11. Maximum allowed is 10. | [Major][SM-B01+TH-02] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/voice/session.ts | 687 | F179 Method 'say' has a complexity of 12. Maximum allowed is 10. | [Major][SM-B01+TH-02] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/voice/session.ts | 687 | F180 Method 'say' has too many lines (44). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/voice/volcengine.ts | 43 | F181 Function 'decodeVoicePacket' has a complexity of 15. Maximum allowed is 10. | [Major][SM-B01+TH-02] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/voice/volcengine.ts | 97 | F182 Function 'createVolcengineVoice' has too many lines (149). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/voice/volcengine.ts | 100 | F183 Async method 'recognize' has too many lines (85). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/voice/volcengine.ts | 115 | F184 Arrow function has a complexity of 15. Maximum allowed is 10. | [Major][SM-B01+TH-02] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/voice/volcengine.ts | 185 | F185 Async method 'speak' has too many lines (59). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/voice/volcengine.ts | 196 | F186 Arrow function has too many lines (47). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/workflow-models.ts | 68 | F187 Function 'createWorkflowModels' has too many lines (260). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/workflow-models.ts | 74 | F188 Async function 'call' has a complexity of 15. Maximum allowed is 10. | [Major][SM-B01+TH-02] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/workflow-models.ts | 74 | F189 Async function 'call' has too many lines (62). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/workflow-models.ts | 74 | F190 Async function 'call' has too many parameters (7). Maximum allowed is 4. | [Major][SM-B03+TH-05] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/workflow-models.ts | 137 | F191 Method 'analyze' has too many lines (70). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/workflow-models.ts | 207 | F192 Method 'prepare' has too many lines (119). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/workflow-models.ts | 207 | F193 Method 'prepare' has too many parameters (6). Maximum allowed is 4. | [Major][SM-B03+TH-05] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/workflow-models.ts | 269 | F194 Method 'validate' has too many lines (52). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/jobs/routes.ts | 94 | F195 Function 'jobsModule' has too many lines (62). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/jobs/routes.ts | 97 | F196 Async method 'register' has too many lines (57). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/jobs/service.ts | 7 | F197 Function 'createJobsService' has too many lines (52). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/jobs/service.ts | 11 | F198 Method 'list' has too many lines (41). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/knowledge/all-roles.ts | 17 | F199 Function 'createAllRoleKnowledge' has too many lines (251). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/knowledge/all-roles.ts | 43 | F200 Async function 'read' has a complexity of 16. Maximum allowed is 10. | [Major][SM-B01+TH-02] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/knowledge/all-roles.ts | 43 | F201 Async function 'read' has too many lines (44). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/knowledge/all-roles.ts | 110 | F202 Async function 'retrieve' has a complexity of 12. Maximum allowed is 10. | [Major][SM-B01+TH-02] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/knowledge/all-roles.ts | 110 | F203 Async function 'retrieve' has too many lines (79). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/knowledge/all-roles.ts | 110 | F204 Async function 'retrieve' has too many parameters (5). Maximum allowed is 4. | [Major][SM-B03+TH-05] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/knowledge/all-roles.ts | 222 | F205 Async method 'context' has too many lines (43). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/knowledge/all-roles.ts | 222 | F206 Async method 'context' has too many parameters (5). Maximum allowed is 4. | [Major][SM-B03+TH-05] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/knowledge/catalog-command.ts | 9 | F207 Async function 'main' has a complexity of 41. Maximum allowed is 10. | [Major][SM-B01+TH-02] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/knowledge/catalog-command.ts | 9 | F208 Async function 'main' has too many lines (180). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/knowledge/catalog-command.ts | 9 | F209 Refactor this function to reduce its Cognitive Complexity from 75 to the 15 allowed. | [Major][SM-B01+TH-03] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/knowledge/catalog-command.ts | 40 | F210 Blocks are nested too deeply (4). Maximum allowed is 3. | [Major][SM-B06+TH-04] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/knowledge/catalog-command.ts | 58 | F211 Blocks are nested too deeply (4). Maximum allowed is 3. | [Major][SM-B06+TH-04] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/knowledge/catalog-command.ts | 59 | F212 Blocks are nested too deeply (5). Maximum allowed is 3. | [Major][SM-B06+TH-04] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/knowledge/catalog-command.ts | 62 | F213 Blocks are nested too deeply (6). Maximum allowed is 3. | [Major][SM-B06+TH-04] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/knowledge/catalog-command.ts | 63 | F214 Blocks are nested too deeply (6). Maximum allowed is 3. | [Major][SM-B06+TH-04] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/knowledge/catalog-command.ts | 66 | F215 Blocks are nested too deeply (4). Maximum allowed is 3. | [Major][SM-B06+TH-04] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/knowledge/catalog-command.ts | 69 | F216 Blocks are nested too deeply (5). Maximum allowed is 3. | [Major][SM-B06+TH-04] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/knowledge/catalog-command.ts | 70 | F217 Blocks are nested too deeply (6). Maximum allowed is 3. | [Major][SM-B06+TH-04] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/knowledge/catalog-command.ts | 77 | F218 Blocks are nested too deeply (7). Maximum allowed is 3. | [Major][SM-B06+TH-04] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/knowledge/catalog-command.ts | 80 | F219 Blocks are nested too deeply (5). Maximum allowed is 3. | [Major][SM-B06+TH-04] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/knowledge/catalog-command.ts | 94 | F220 Blocks are nested too deeply (4). Maximum allowed is 3. | [Major][SM-B06+TH-04] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/knowledge/catalog-command.ts | 95 | F221 Blocks are nested too deeply (5). Maximum allowed is 3. | [Major][SM-B06+TH-04] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/knowledge/catalog-command.ts | 99 | F222 Blocks are nested too deeply (6). Maximum allowed is 3. | [Major][SM-B06+TH-04] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/knowledge/catalog-command.ts | 101 | F223 Blocks are nested too deeply (7). Maximum allowed is 3. | [Major][SM-B06+TH-04] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/knowledge/catalog-command.ts | 117 | F224 Blocks are nested too deeply (8). Maximum allowed is 3. | [Major][SM-B06+TH-04] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/knowledge/catalog-command.ts | 128 | F225 Blocks are nested too deeply (6). Maximum allowed is 3. | [Major][SM-B06+TH-04] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/knowledge/catalog.ts | 128 | F226 Function 'buildCatalog' has a complexity of 22. Maximum allowed is 10. | [Major][SM-B01+TH-02] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/knowledge/catalog.ts | 128 | F227 Function 'buildCatalog' has too many lines (140). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/knowledge/catalog.ts | 128 | F228 Refactor this function to reduce its Cognitive Complexity from 38 to the 15 allowed. | [Major][SM-B01+TH-03] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/reports/agent.ts | 19 | F229 Function 'createReportAgent' has too many lines (128). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/reports/aggregate.ts | 59 | F230 Function 'emptyReport' has a complexity of 11. Maximum allowed is 10. | [Major][SM-B01+TH-02] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/reports/aggregate.ts | 59 | F231 Function 'emptyReport' has too many lines (49). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/reports/aggregate.ts | 初审 110；整改 346 | Q4 证据与多个评分版本的聚合职责混合 | [Major][SM-B01+SM-C01] 拆分证据、历史分数、BARS 与当前逐题评分；圈复杂度 58→5，新辅助函数最高 10。【已重构并通过评分回归】 |
| code/backend/src/modules/reports/aggregate.ts | 173 | F232 Function 'applyIndicatorScores' has too many lines (47). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/reports/analysis.ts | 135 | F233 Function has too many parameters (6). Maximum allowed is 4. | [Major][SM-B03+TH-05] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/reports/analysis.ts | 193 | F234 Function 'assertScoringEvidence' has a complexity of 35. Maximum allowed is 10. | [Major][SM-B01+TH-02] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/reports/analysis.ts | 193 | F235 Function 'assertScoringEvidence' has too many lines (117). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/reports/analysis.ts | 193 | F236 Refactor this function to reduce its Cognitive Complexity from 31 to the 15 allowed. | [Major][SM-B01+TH-03] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/reports/analysis.ts | 310 | F237 Function 'assertEvaluation' has a complexity of 30. Maximum allowed is 10. | [Major][SM-B01+TH-02] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/reports/analysis.ts | 310 | F238 Function 'assertEvaluation' has too many lines (68). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/reports/analysis.ts | 310 | F239 Refactor this function to reduce its Cognitive Complexity from 16 to the 15 allowed. | [Major][SM-B01+TH-03] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/reports/analysis.ts | 381 | F240 Function 'assertSummary' has a complexity of 18. Maximum allowed is 10. | [Major][SM-B01+TH-02] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/reports/analysis.ts | 381 | F241 Function 'assertSummary' has too many lines (108). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/reports/analysis.ts | 401 | F242 File has too many lines (1233). Maximum allowed is 400. | [Major][SM-B02+TH-06] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/reports/analysis.ts | 491 | F243 Function 'reuseSingleQuestionSummary' has too many lines (51). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/reports/analysis.ts | 576 | F244 Blocks are nested too deeply (4). Maximum allowed is 3. | [Major][SM-B06+TH-04] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/reports/analysis.ts | 579 | F245 Blocks are nested too deeply (4). Maximum allowed is 3. | [Major][SM-B06+TH-04] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/reports/analysis.ts | 初审 601；整改 928 | Q5 逐题评价混合证据准备、输入与解码 | [Major][SM-B01+SM-C01] 分离证据、schema、模型输入与结果解码，圈复杂度 56→4，新辅助函数最高 10；9 段长指令 AST 核对一致。【已重构，78 项报告/评分专项通过】 |
| code/backend/src/modules/reports/analysis.ts | 622 | F246 Function 'evaluationSchema' has too many lines (51). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/reports/analysis.ts | 683 | F247 Function 'evaluationInput' has too many lines (77). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/reports/analysis.ts | 801 | F248 Function 'decodeEvaluation' has too many lines (67). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/reports/analysis.ts | 869 | F249 Function 'createReportAnalysis' has too many lines (361). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/reports/analysis.ts | 874 | F250 Async method 'suggest' has too many lines (54). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/reports/analysis.ts | 928 | F251 Async method 'evaluate' has too many parameters (5). Maximum allowed is 4. | [Major][SM-B03+TH-05] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/reports/analysis.ts | 960 | F252 Async method 'summarize' has a complexity of 30. Maximum allowed is 10. | [Major][SM-B01+TH-02] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/reports/analysis.ts | 960 | F253 Async method 'summarize' has too many lines (268). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/reports/analysis.ts | 960 | F254 Async method 'summarize' has too many parameters (5). Maximum allowed is 4. | [Major][SM-B03+TH-05] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/reports/analysis.ts | 960 | F255 Refactor this function to reduce its Cognitive Complexity from 30 to the 15 allowed. | [Major][SM-B01+TH-03] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/reports/analysis.ts；code/backend/src/modules/reports/schemas.ts | 163–170；81–87 | DUP03 同口径重复候选 8 行 | [Major][SM-D01+TH-08] 需结合职责判定与消除，未获团队豁免；低token探测另保存原始结果。【未关闭】 |
| code/backend/src/modules/reports/repository.ts | 20 | F256 Async function 'insertReport' has too many parameters (6). Maximum allowed is 4. | [Major][SM-B03+TH-05] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/reports/repository.ts | 63 | F257 Async function 'putEvaluationTask' has too many parameters (5). Maximum allowed is 4. | [Major][SM-B03+TH-05] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/reports/repository.ts | 75 | F258 Async function 'putEvaluationResult' has too many parameters (5). Maximum allowed is 4. | [Major][SM-B03+TH-05] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/reports/repository.ts | 140 | F259 Async function 'insertComparison' has too many parameters (5). Maximum allowed is 4. | [Major][SM-B03+TH-05] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/reports/repository.ts | 161 | F260 Async function 'updateComparison' has too many parameters (6). Maximum allowed is 4. | [Major][SM-B03+TH-05] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/reports/routes.ts | 10 | F261 Function 'reportsModule' has too many lines (104). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/reports/routes.ts | 13 | F262 Async method 'register' has too many lines (99). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/reports/service.ts | 见当前扫描重复块位置 | Q9 报告合成任务及锁检查重复 | [Major][SM-D01] 复用既有评价上下文，统一事务内建议/总结登记及源删除锁处理，保留幂等/版本/取消；91项专项、43项数据库专项及全回归通过。【目标重复已改，其他重复见U1】 |
| code/backend/src/modules/reports/service.ts | 56 | F263 Function 'createReportsService' has too many lines (920). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/reports/service.ts | 95 | F264 Async function 'queueEvaluations' has too many parameters (5). Maximum allowed is 4. | [Major][SM-B03+TH-05] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/reports/service.ts | 175 | F265 Async function 'get' has a complexity of 32. Maximum allowed is 10. | [Major][SM-B01+TH-02] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/reports/service.ts | 175 | F266 Async function 'get' has too many lines (72). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/reports/service.ts | 175 | F267 Refactor this function to reduce its Cognitive Complexity from 18 to the 15 allowed. | [Major][SM-B01+TH-03] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/reports/service.ts | 342 | F268 Async arrow function has too many lines (100). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/reports/service.ts | 396 | F269 Async method 'commit' has a complexity of 15. Maximum allowed is 10. | [Major][SM-B01+TH-02] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/reports/service.ts | 396 | F270 Async method 'commit' has too many lines (44). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/reports/service.ts | 401 | F271 File has too many lines (981). Maximum allowed is 400. | [Major][SM-B02+TH-06] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/reports/service.ts | 442 | F272 Async arrow function has too many lines (60). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/reports/service.ts | 502 | F273 Async arrow function has a complexity of 11. Maximum allowed is 10. | [Major][SM-B01+TH-02] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/reports/service.ts | 502 | F274 Async arrow function has too many lines (97). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/reports/service.ts | 545 | F275 Async method 'commit' has a complexity of 12. Maximum allowed is 10. | [Major][SM-B01+TH-02] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/reports/service.ts | 545 | F276 Async method 'commit' has too many lines (52). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/reports/service.ts | 599 | F277 Async arrow function has too many lines (47). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/reports/service.ts | 684 | F278 Async method 'request' has too many lines (77). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/reports/service.ts | 688 | F279 Async arrow function has a complexity of 22. Maximum allowed is 10. | [Major][SM-B01+TH-02] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/reports/service.ts | 688 | F280 Async arrow function has too many lines (70). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/reports/service.ts | 688 | F281 Refactor this function to reduce its Cognitive Complexity from 22 to the 15 allowed. | [Major][SM-B01+TH-03] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/reports/service.ts | 762 | F282 Async method 'createComparison' has too many lines (90). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/reports/service.ts | 777 | F283 Async arrow function has a complexity of 15. Maximum allowed is 10. | [Major][SM-B01+TH-02] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/reports/service.ts | 777 | F284 Async arrow function has too many lines (72). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/reports/service.ts | 893 | F285 Async method 'maintain' has too many lines (84). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/reports/service.ts | 895 | F286 Async arrow function has a complexity of 22. Maximum allowed is 10. | [Major][SM-B01+TH-02] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/reports/service.ts | 895 | F287 Async arrow function has too many lines (70). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/reports/service.ts | 895 | F288 Refactor this function to reduce its Cognitive Complexity from 29 to the 15 allowed. | [Major][SM-B01+TH-03] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/reports/service.ts；code/backend/src/modules/reports/service.ts | 505–515；445–455 | DUP01 同口径重复候选 11 行 | [Major][SM-D01+TH-08] 需结合职责判定与消除，未获团队豁免；低token探测另保存原始结果。【未关闭】 |
| code/backend/src/modules/reports/service.ts；code/backend/src/modules/reports/service.ts | 547–556；476–485 | DUP02 同口径重复候选 10 行 | [Major][SM-D01+TH-08] 需结合职责判定与消除，未获团队豁免；低token探测另保存原始结果。【未关闭】 |
| code/backend/src/modules/resumes/analysis.ts | 23 | F289 Function 'createResumeAnalysis' has too many lines (152). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/resumes/analysis.ts | 49 | F290 Async function 'enqueue' has a complexity of 14. Maximum allowed is 10. | [Major][SM-B01+TH-02] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/resumes/analysis.ts | 49 | F291 Async function 'enqueue' has too many parameters (5). Maximum allowed is 4. | [Major][SM-B03+TH-05] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/resumes/routes.ts | 24 | F292 Function 'materialsModule' has too many lines (74). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/resumes/routes.ts | 27 | F293 Async method 'register' has too many lines (69). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/resumes/service.ts | 6 | F294 Function 'createMaterialsService' has too many lines (93). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/resumes/service.ts | 25 | F295 Async function 'save' has too many lines (52). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/resumes/service.ts | 32 | F296 Async arrow function has too many lines (44). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/server/app.ts | 45 | F297 Async function 'buildApp' has a complexity of 20. Maximum allowed is 10. | [Major][SM-B01+TH-02] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/server/app.ts | 45 | F298 Async function 'buildApp' has too many lines (177). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/server/app.ts | 109 | F299 Async arrow function has too many lines (106). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/tasks/runner.ts | 21 | F300 Async function 'runTask' has a complexity of 16. Maximum allowed is 10. | [Major][SM-B01+TH-02] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/tasks/runner.ts | 21 | F301 Async function 'runTask' has too many lines (137). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/tasks/runner.ts | 21 | F302 Async function 'runTask' has too many parameters (5). Maximum allowed is 4. | [Major][SM-B03+TH-05] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/tasks/runner.ts | 21 | F303 Refactor this function to reduce its Cognitive Complexity from 20 to the 15 allowed. | [Major][SM-B01+TH-03] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/tasks/runner.ts | 109 | F304 Async arrow function has a complexity of 13. Maximum allowed is 10. | [Major][SM-B01+TH-02] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/tasks/service.ts | 24 | F305 Async function 'enqueueTask' has a complexity of 11. Maximum allowed is 10. | [Major][SM-B01+TH-02] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/tasks/worker.ts | 18 | F306 Async function 'startWorker' has too many lines (101). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/core_engine/src/interview-policy.ts | 19 | F307 Function 'interviewPolicy' has a complexity of 17. Maximum allowed is 10. | [Major][SM-B01+TH-02] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/core_engine/src/interview-policy.ts | 19 | F308 Function 'interviewPolicy' has too many lines (88). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/core_engine/src/interview-policy.ts | 19 | F309 Refactor this function to reduce its Cognitive Complexity from 27 to the 15 allowed. | [Major][SM-B01+TH-03] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/core_engine/src/interview-policy.ts | 108 | F310 Function 'interviewPacing' has a complexity of 31. Maximum allowed is 10. | [Major][SM-B01+TH-02] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/core_engine/src/interview-policy.ts | 108 | F311 Function 'interviewPacing' has too many lines (57). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/core_engine/src/knowledge.ts | 68 | F312 Function 'createJobCatalog' has too many lines (72). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/core_engine/src/performance-profile.ts | 4 | F313 Function 'summarizePerformance' has a complexity of 11. Maximum allowed is 10. | [Major][SM-B01+TH-02] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/core_engine/src/performance-profile.ts | 4 | F314 Function 'summarizePerformance' has too many lines (65). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/core_engine/src/performance-profile.ts | 40 | F315 Arrow function has a complexity of 12. Maximum allowed is 10. | [Major][SM-B01+TH-02] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/core_engine/src/question-scoring.ts | 117 | F316 Function 'questionScores' has too many lines (58). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/core_engine/src/question-scoring.ts | 128 | F317 Arrow function has too many lines (46). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/core_engine/src/report-rubric.ts | 205 | F318 Arrow function has a complexity of 13. Maximum allowed is 10. | [Major][SM-B01+TH-02] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/core_engine/src/resume-template.ts | 4 | F319 Function 'extractResumeTemplate' has a complexity of 19. Maximum allowed is 10. | [Major][SM-B01+TH-02] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/core_engine/src/resume-template.ts | 4 | F320 Refactor this function to reduce its Cognitive Complexity from 30 to the 15 allowed. | [Major][SM-B01+TH-03] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/frontend/app/page.tsx | 18 | F321 Function 'Home' has too many lines (269). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/frontend/components/account-access.tsx | 10 | F322 Function 'AccountAccess' has too many lines (88). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/frontend/components/account-access.tsx | 52 | F323 Arrow function has a complexity of 16. Maximum allowed is 10. | [Major][SM-B01+TH-02] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/frontend/components/auth-form.tsx | 8 | F324 Function 'AuthForm' has a complexity of 15. Maximum allowed is 10. | [Major][SM-B01+TH-02] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/frontend/components/auth-form.tsx | 8 | F325 Function 'AuthForm' has too many lines (145). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/frontend/components/auth-form.tsx | 13 | F326 Async function 'submit' has a complexity of 12. Maximum allowed is 10. | [Major][SM-B01+TH-02] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/frontend/components/auth-form.tsx | 13 | F327 Refactor this function to reduce its Cognitive Complexity from 17 to the 15 allowed. | [Major][SM-B01+TH-03] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/frontend/components/interview-workspace.tsx | 69 | F328 Function 'InterviewWorkspace' has a complexity of 36. Maximum allowed is 10. | [Major][SM-B01+TH-02] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/frontend/components/interview-workspace.tsx | 69 | F329 Function 'InterviewWorkspace' has too many lines (285). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/frontend/components/interview-workspace.tsx | 69 | F330 Refactor this function to reduce its Cognitive Complexity from 19 to the 15 allowed. | [Major][SM-B01+TH-03] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/frontend/components/job-library.tsx | 18 | F331 Function 'JobLibrary' has a complexity of 12. Maximum allowed is 10. | [Major][SM-B01+TH-02] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/frontend/components/job-library.tsx | 18 | F332 Function 'JobLibrary' has too many lines (159). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/frontend/components/job-library.tsx | 194 | F333 Function 'JobDetail' has too many lines (162). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/frontend/components/session-provider.tsx | 16 | F334 Function 'SessionProvider' has too many lines (67). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/frontend/components/session-provider.tsx | 20 | F335 Async arrow function has a complexity of 11. Maximum allowed is 10. | [Major][SM-B01+TH-02] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/frontend/components/shared.tsx | 33 | F336 Function 'Header' has too many lines (50). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/frontend/components/shared.tsx | 160 | F337 Function 'Modal' has too many lines (49). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/frontend/features/live-interview/analysis.tsx | 初审 14；整改 95 | Q2 报告等待页混合进度、失败恢复和导航 | [Major][SM-B01+SM-B06] 提取 analysis-state 真实状态投影和小组件；圈复杂度 82→6，相关函数最高 9，扫描零告警。【已重构，新增 3 项状态回归通过】 |
| code/frontend/features/live-interview/analysis.tsx | 136 | F338 Function 'AnalysisBody' has too many lines (44). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/frontend/features/live-interview/common.tsx | 62 | F339 Function 'useLiveResource' has too many lines (68). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/frontend/features/live-interview/common.tsx | 131 | F340 Function 'useLiveCommand' has too many lines (49). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/frontend/features/live-interview/common.tsx | 146 | F341 Async function 'execute' has a complexity of 15. Maximum allowed is 10. | [Major][SM-B01+TH-02] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/frontend/features/live-interview/flow-provider.tsx | 39 | F342 Function 'InterviewFlowProvider' has too many lines (284). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/frontend/features/live-interview/flow-provider.tsx | 初审 42；整改 39 | R5 Provider 集中设备和会话生命周期 | [Major][SM-B01+SM-C01] 提取媒体准备/释放 Hook，补齐取消与跨场次边界；有效行数 307→284。【已作本轮拆分，长函数告警保留】 |
| code/frontend/features/live-interview/flow-provider.tsx | 149 | F343 Async function 'enterSession' has a complexity of 15. Maximum allowed is 10. | [Major][SM-B01+TH-02] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/frontend/features/live-interview/flow-provider.tsx | 149 | F344 Async function 'enterSession' has too many lines (42). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/frontend/features/live-interview/flow-provider.tsx | 191 | F345 Function 'begin' has a complexity of 11. Maximum allowed is 10. | [Major][SM-B01+TH-02] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/frontend/features/live-interview/flow-provider.tsx | 191 | F346 Function 'begin' has too many lines (66). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/frontend/features/live-interview/history.tsx | 11 | F347 Function 'HistoryBody' has too many lines (196). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/frontend/features/live-interview/history.tsx | 102 | F348 Arrow function has too many lines (44). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/frontend/features/live-interview/interview.tsx | 22 | F349 Function 'InterviewBody' has a complexity of 40. Maximum allowed is 10. | [Major][SM-B01+TH-02] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/frontend/features/live-interview/interview.tsx | 22 | F350 Function 'InterviewBody' has too many lines (315). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/frontend/features/live-interview/interview.tsx | 初审 27；整改 22 | R4 页面集中多类状态和通知 | [Major][SM-B01+SM-C01] 提取展示投影、通知组件及回执 Hook；圈复杂度 65→40，认知复杂度告警消除。【已作本轮拆分，长函数及圈复杂度仍待跟踪】 |
| code/frontend/features/live-interview/preparation.tsx | 12 | F351 Function 'PreparationScreen' has a complexity of 48. Maximum allowed is 10. | [Major][SM-B01+TH-02] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/frontend/features/live-interview/preparation.tsx | 12 | F352 Function 'PreparationScreen' has too many lines (145). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/frontend/features/live-interview/preparation.tsx | 12 | F353 Refactor this function to reduce its Cognitive Complexity from 40 to the 15 allowed. | [Major][SM-B01+TH-03] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/frontend/features/live-interview/preparation.tsx | 158 | F354 Function 'PreparationBody' has too many lines (80). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/frontend/features/live-interview/presentation-request.ts | 21 | F355 Async function 'confirmQuestionPresentation' has a complexity of 11. Maximum allowed is 10. | [Major][SM-B01+TH-02] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/frontend/features/live-interview/question-scores.tsx | 11 | F356 Function 'QuestionScorecard' has too many lines (42). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/frontend/features/live-interview/question-scores.tsx | 53 | F357 Function 'PracticeHistory' has too many lines (125). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/frontend/features/live-interview/report-charts.tsx | 65 | F358 Function 'AbilityRadar' has too many lines (122). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/frontend/features/live-interview/report-charts.tsx | 188 | F359 Function 'QuestionCoverage' has too many lines (87). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/frontend/features/live-interview/report-charts.tsx | 224 | F360 Arrow function has a complexity of 11. Maximum allowed is 10. | [Major][SM-B01+TH-02] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/frontend/features/live-interview/report-charts.tsx | 224 | F361 Arrow function has too many lines (47). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/frontend/features/live-interview/report-charts.tsx | 224 | F362 Refactor this function to reduce its Cognitive Complexity from 20 to the 15 allowed. | [Major][SM-B01+TH-03] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/frontend/features/live-interview/report-charts.tsx | 276 | F363 Function 'FeedbackScoreTable' has too many lines (57). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/frontend/features/live-interview/report-export.ts | 29 | F364 Function 'reportExportHtml' has a complexity of 19. Maximum allowed is 10. | [Major][SM-B01+TH-02] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/frontend/features/live-interview/report-export.ts | 29 | F365 Function 'reportExportHtml' has too many lines (54). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/frontend/features/live-interview/report-insights.tsx | 6 | F366 Function 'ReportInsights' has too many lines (156). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/frontend/features/live-interview/report-overview.tsx | 17 | F367 Function 'ReportHeading' has too many lines (49). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/frontend/features/live-interview/report-overview.tsx | 108 | F368 Function 'ReportOverview' has too many lines (70). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/frontend/features/live-interview/report-practice.tsx | 65 | F369 Function 'PracticeResult' has too many lines (68). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/frontend/features/live-interview/report-practice.tsx | 167 | F370 Function 'PracticeReportTurn' has too many lines (53). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/frontend/features/live-interview/report-practice.tsx | 221 | F371 Function 'PracticeReportPage' has too many lines (71). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/frontend/features/live-interview/report-progress.tsx | 18 | F372 Function 'reportDisplayState' has a complexity of 19. Maximum allowed is 10. | [Major][SM-B01+TH-02] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/frontend/features/live-interview/report-progress.tsx | 56 | F373 Function 'ReportProgress' has a complexity of 24. Maximum allowed is 10. | [Major][SM-B01+TH-02] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/frontend/features/live-interview/report-progress.tsx | 56 | F374 Function 'ReportProgress' has too many lines (89). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/frontend/features/live-interview/report.tsx | 149 | F375 Function 'ReportBody' has too many lines (51). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/frontend/features/live-interview/report.tsx | 210 | F376 Function 'ReportResults' has too many lines (50). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/frontend/features/live-interview/report.tsx；code/backend/src/modules/reports/service.ts | 见 F 清单与扫描 JSON | U1 严格结构与重复候选仍未关闭 | [Major][SM-B01+SM-D01] ReportBody 52→7，语音 51→10；项目最高仍 50。strict 423、历史规则 248 告警；同口径重复 10 块、80 行。详见 F001–F423、DUP01–DUP10。【部分整改，未关闭】 |
| code/frontend/features/live-interview/report.tsx；report-overview.tsx；report-practice.tsx | 见 scan.json 函数测量及 F 清单 | Q6 报告入口混合加载、命令、打印和重练 | [Major][SM-B01+SM-C01] ReportBody CC52→7；新增7项真实视图回归，保留零分、失败、回答revision及主问题边界。仍有7条strict长函数。【部分整改 v1.5】 |
| code/frontend/features/live-interview/review-conversation.tsx | 7 | F377 Function 'ReviewConversationTurn' has too many lines (72). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/frontend/features/live-interview/setup.tsx | 44 | F378 Function 'ConfigurationForm' has a complexity of 27. Maximum allowed is 10. | [Major][SM-B01+TH-02] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/frontend/features/live-interview/setup.tsx | 44 | F379 Function 'ConfigurationForm' has too many lines (321). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/frontend/features/live-interview/start-request.ts | 11 | F380 Async function 'startPreparedInterview' has a complexity of 31. Maximum allowed is 10. | [Major][SM-B01+TH-02] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/frontend/features/live-interview/start-request.ts | 11 | F381 Async function 'startPreparedInterview' has too many lines (75). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/frontend/features/live-interview/start-request.ts | 11 | F382 Refactor this function to reduce its Cognitive Complexity from 26 to the 15 allowed. | [Major][SM-B01+TH-03] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/frontend/features/live-interview/stream.ts | 5 | F383 Function 'useInterviewStream' has too many lines (78). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/frontend/features/live-interview/stream.ts | 19 | F384 Arrow function has too many lines (60). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/frontend/features/live-interview/transition-screen.tsx | 23 | F385 Function 'TransitionScreen' has a complexity of 27. Maximum allowed is 10. | [Major][SM-B01+TH-02] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/frontend/features/live-interview/transition-screen.tsx | 23 | F386 Function 'TransitionScreen' has too many lines (133). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/frontend/features/live-interview/transition-screen.tsx | 23 | F387 Refactor this function to reduce its Cognitive Complexity from 19 to the 15 allowed. | [Major][SM-B01+TH-03] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/frontend/features/live-interview/transition-screen.tsx | 53 | F388 Arrow function has too many lines (41). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/frontend/features/live-interview/transition-screen.tsx | 60 | F389 Arrow function has a complexity of 11. Maximum allowed is 10. | [Major][SM-B01+TH-02] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/frontend/features/live-interview/use-prepared-devices.ts | 19 | F390 Function 'usePreparedInterviewDevices' has too many lines (45). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/frontend/features/live-interview/voice/client.ts | 35 | F391 Constructor has too many parameters (5). Maximum allowed is 4. | [Major][SM-B03+TH-05] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/frontend/features/live-interview/voice/client.ts | 81 | F392 Method 'initialize' has too many lines (83). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/frontend/features/live-interview/voice/client.ts | 115 | F393 Arrow function has a complexity of 17. Maximum allowed is 10. | [Major][SM-B01+TH-02] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/frontend/features/live-interview/voice/client.ts | 164 | F394 Async method 'openSocket' has too many lines (51). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/frontend/features/live-interview/voice/client.ts | 174 | F395 Arrow function has a complexity of 16. Maximum allowed is 10. | [Major][SM-B01+TH-02] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/frontend/features/live-interview/voice/controls.tsx；voice/call-presentation.ts | 见 scan.json 函数测量 | Q7 语音控制混合状态优先级与多种展示 | [Major][SM-B01+SM-B06] VoiceControls CC51→10，两文件strict零告警；2项新增及9项语音界面测试通过；2560组渲染与基线相同。【已修复 v1.5】 |
| code/frontend/features/live-interview/voice/devices.ts | 26 | F396 Function 'voiceDeviceError' has a complexity of 12. Maximum allowed is 10. | [Major][SM-B01+TH-02] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/frontend/features/live-interview/voice/devices.ts | 43 | F397 Async function 'prepareVoiceDevices' has a complexity of 11. Maximum allowed is 10. | [Major][SM-B01+TH-02] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/frontend/features/live-interview/voice/playback.ts | 21 | F398 Method 'append' has a complexity of 11. Maximum allowed is 10. | [Major][SM-B01+TH-02] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/frontend/features/live-interview/voice/use-voice.ts | 30 | F399 Function 'useInterviewVoice' has a complexity of 12. Maximum allowed is 10. | [Major][SM-B01+TH-02] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/frontend/features/live-interview/voice/use-voice.ts | 30 | F400 Function 'useInterviewVoice' has too many lines (288). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/frontend/features/live-interview/voice/use-voice.ts | 112 | F401 Function 'createConnection' has too many lines (71). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/frontend/features/live-interview/voice/use-voice.ts | 115 | F402 Arrow function has a complexity of 20. Maximum allowed is 10. | [Major][SM-B01+TH-02] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/frontend/features/live-interview/voice/use-voice.ts | 115 | F403 Arrow function has too many lines (56). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/frontend/features/live-interview/voice/use-voice.ts | 115 | F404 Refactor this function to reduce its Cognitive Complexity from 19 to the 15 allowed. | [Major][SM-B01+TH-03] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/frontend/features/personal-center/live-workspace.tsx | 12 | F405 Function 'AccountOverview' has too many lines (100). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/frontend/features/personal-center/materials-workspace.tsx | 9 | F406 Function 'MaterialsWorkspace' has a complexity of 19. Maximum allowed is 10. | [Major][SM-B01+TH-02] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/frontend/features/personal-center/materials-workspace.tsx | 9 | F407 Function 'MaterialsWorkspace' has too many lines (205). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/frontend/features/personal-center/materials-workspace.tsx | 100 | F408 Async arrow function has too many lines (48). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/frontend/features/personal-center/profile-overview.tsx | 17 | F409 Function 'ProfileOverview' has a complexity of 30. Maximum allowed is 10. | [Major][SM-B01+TH-02] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/frontend/features/personal-center/profile-overview.tsx | 17 | F410 Function 'ProfileOverview' has too many lines (167). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/frontend/features/personal-center/profile-overview.tsx | 17 | F411 Refactor this function to reduce its Cognitive Complexity from 21 to the 15 allowed. | [Major][SM-B01+TH-03] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/frontend/features/personal-center/saved-jobs-live.tsx | 18 | F412 Function 'SavedJobs' has too many lines (105). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/frontend/features/personal-center/saved-jobs-live.tsx | 58 | F413 Arrow function has too many lines (61). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/frontend/features/video-interview/interviewer-avatar.tsx | 5 | F414 Function 'InterviewerAvatar' has too many lines (42). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/frontend/features/video-interview/room.tsx | 29 | F415 Function 'useLocalMedia' has too many lines (77). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/frontend/features/video-interview/room.tsx | 66 | F416 Async function 'toggle' has a complexity of 13. Maximum allowed is 10. | [Major][SM-B01+TH-02] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/frontend/features/video-interview/room.tsx | 106 | F417 Function 'VideoInterviewWorkspace' has a complexity of 39. Maximum allowed is 10. | [Major][SM-B01+TH-02] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/frontend/features/video-interview/room.tsx | 106 | F418 Function 'VideoInterviewWorkspace' has too many lines (223). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/frontend/features/video-interview/room.tsx | 106 | F419 Refactor this function to reduce its Cognitive Complexity from 22 to the 15 allowed. | [Major][SM-B01+TH-03] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/frontend/lib/api/http.ts | 43 | F420 Function 'createApiClient' has too many lines (69). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/frontend/lib/api/http.ts | 44 | F421 Async function 'request' has a complexity of 34. Maximum allowed is 10. | [Major][SM-B01+TH-02] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/frontend/lib/api/http.ts | 44 | F422 Async function 'request' has too many lines (67). Maximum allowed is 40. | [Major][SM-B01+TH-01] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/frontend/lib/api/http.ts | 44 | F423 Refactor this function to reduce its Cognitive Complexity from 21 to the 15 allowed. | [Major][SM-B01+TH-03] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| docs/algorithm/evaluation.md | 54、66、91、184、231 | D6 评测口径和手测脚本入口过时 | [Major][SM-D03] 同步评分、时长和专业面入口；说明 agent-preview 实际使用真实模型及合成材料，保留历史失败记录。【已修订 ce88b1c】 |
| docs/algorithm/knowledge_and_agent.md | 173、194、238、254 | D5 当前和历史评分规则混用 | [Major][SM-D03] 标明 interview-feedback-v2、text-review-v16、question-evidence-v3 及历史四维的适用范围，同步时长规则。【已修订 ce88b1c】 |
| docs/mgmt/COLLABORATION.md；docs/mgmt/team_plan.md | 5；11–15 | U4 书面集成分支流程与实际提交路径、人员安排待确认 | [Major][SM-D03] 文档规定先集成 develop，近期 PR 实际进入 main。保留差异和待团队确认项，未替团队决定流程或填写负责人。【未关闭】 |
| docs/mgmt/communication_mgmt_plan.md | 7 | M1 沟通计划需要按生命周期落到可检查的安排 | [Major][SM-C01] 登记分析、设计、开发、测试、发布和运行维护的内容、频度、方式、产出及角色。【原有有效修订，经用户确认于 44dce33 提交】 |
| docs/mgmt/risk_mgmt_plan.md | 5 | M2 风险表需要明确优先级、跟踪与额度预案 | [Major][SM-V16] 登记 API 免费额度、网络、语音、模型、联调、隐私和交付访问风险，并列触发与处理安排。【原有有效修订，经用户确认于 44dce33 提交】 |
| docs/requirements/functional_spec.md | 25、71、87、183 | D1 时长、面试类型和评分描述与实现版本不一致 | [Major][SM-D03] 同步 10/20/30 分钟、6/10/14 主问题及 12/22/32 分钟硬上限；更新新建类型、默认文字和六维/历史评分说明。【已修订 ce88b1c】 |
| docs/requirements/nonfunctional_spec.md | 7、15 | D2 非功能时长与作答方式口径过时 | [Major][SM-D03] 同步 NFR-05 的时间/题量规则，说明实时语音设计目标和当前默认文字行为。【已修订 ce88b1c】 |
| docs/requirements/problem_definition.md | 63、69、75 | D3 产品叙述中的时长和账号口径过时 | [Major][SM-D03] 同步时长和硬上限，说明注册登录及媒体主动授权。【已修订 ce88b1c】 |
| docs/requirements/user_stories.md | 15、51、110、171 | D4 验收故事与当前入口及偏好接入状态不一致 | [Major][SM-D03] 修正时长、类型、默认作答和恢复验收，保留历史四维例子并明确偏好尚未完整复用。【已修订 ce88b1c，偏好实现状态按当时版本记录】 |
| docs/software/code_quality.md；docs/software/code_review.md | 1；1 | F1 原质量和评审报告缺少实际扫描及完整过程 | [Major][SM-D03] 从证据入口发展为真实扫描、截图、历史与本轮对比、问题跟踪、完整过程台账；本版按教师原表填写。【本版已更新】 |
| docs/software/data_and_interfaces.md | 178、184、208 | D7 接口文档中的新建类型和聚合规则过时 | [Major][SM-D03] 区分新建与历史类型，更新时长及报告的版本化聚合说明。【已修订 ce88b1c】 |
| docs/software/deployment.md | 3、8、12 | D10 缺少可定位的发布和迁移检查入口 | [Major][SM-D03] 新增环境、迁移、备份恢复、就绪与回退检查，明确报告重置迁移的影响。【已建立 ce88b1c，真实发布和恢复演练待验证】 |
| docs/software/development.md | 7、17 | D8 迁移影响和个人启动入口用途不清 | [Major][SM-D03] 说明历史迁移会清派生报告并保留原回答；个人 Compose 用于材料与偏好，完整面试需 worker。【已修订 ce88b1c】 |
| docs/software/personal-materials-implementation.md | 15 | D9 材料说明夸大了偏好的实际接入范围 | [Major][SM-D03] 按当时实现写明读取默认简历和风格，新表单为 10 分钟文字模式，其他偏好接入状态待完善。【已修订 ce88b1c】 |
| tests/integration/database/all-role-knowledge.test.ts | 134–146 | I2 新增 HR 问题的类型合同与旧检索断言不一致 | [Major][测试合同] 旧断言禁止 HR 检索 question，新目录已有显式 hr binding 的问题。先在独立专用库复现，再允许 HR 问题，同时加强 release、岗位、阶段、类型、返回 DTO 类型及禁用评价参考的断言；生产检索未改。【全量数据库 87/87 通过】 |
| tests/interviewlab_demo_user_test.md | 3 | D12 缺少交叉用户试用记录入口 | [Major][SM-D03] 建立任务、预期、实际结果和复验记录表，明确实际试用待执行。【表已建立 ce88b1c，试用待执行】 |
| tests/unit/report-pages.test.ts | 135 | T001 Arrow function has too many lines (53). Maximum allowed is 40. | [Major][SM-B01] 本轮测试另行strict筛查，断言有效性已验；布局/复杂度项仍需整理，未计入产品源码前后对照。【未关闭】 |
| tests/unit/report-pages.test.ts | 216 | T002 Arrow function has too many lines (65). Maximum allowed is 40. | [Major][SM-B01] 本轮测试另行strict筛查，断言有效性已验；布局/复杂度项仍需整理，未计入产品源码前后对照。【未关闭】 |
| tests/unit/report-pages.test.ts | 282 | T003 Arrow function has too many lines (65). Maximum allowed is 40. | [Major][SM-B01] 本轮测试另行strict筛查，断言有效性已验；布局/复杂度项仍需整理，未计入产品源码前后对照。【未关闭】 |
| tests/unit/report-pages.test.ts | 282 | T004 Arrow function has a complexity of 12. Maximum allowed is 10. | [Major][SM-B01] 本轮测试另行strict筛查，断言有效性已验；布局/复杂度项仍需整理，未计入产品源码前后对照。【未关闭】 |
| tests/unit/report-pages.test.ts | 348 | T005 Arrow function has too many lines (54). Maximum allowed is 40. | [Major][SM-B01] 本轮测试另行strict筛查，断言有效性已验；布局/复杂度项仍需整理，未计入产品源码前后对照。【未关闭】 |
| tests/unit/report-pages.test.ts | 401 | T006 File has too many lines (401). Maximum allowed is 400. | [Major][SM-B02] 本轮测试另行strict筛查，断言有效性已验；布局/复杂度项仍需整理，未计入产品源码前后对照。【未关闭】 |
| tests/unit/voice-interface.test.ts | 89 | T007 Arrow function has too many lines (48). Maximum allowed is 40. | [Major][SM-B01] 本轮测试另行strict筛查，断言有效性已验；布局/复杂度项仍需整理，未计入产品源码前后对照。【未关闭】 |
| tests/unit/voice-interface.test.ts | 229 | T008 Arrow function has too many lines (61). Maximum allowed is 40. | [Major][SM-B01] 本轮测试另行strict筛查，断言有效性已验；布局/复杂度项仍需整理，未计入产品源码前后对照。【未关闭】 |
| code/frontend/features/live-interview/setup.tsx、setup-controller.ts、setup-panels.tsx、setup-summary.tsx | 1；当前本轮numstat见质量报告附录I | G2 本轮源码改动760行，超过400行小批建议 | [Major][SM-V10/TH-11] task-start至最终4份源码447插入/313删除，共760行，不含测试/报告；尚未分批归档。旧v1.5的1919行保留为原快照，不当作本轮值。【未关闭，未豁免】 |
| code/backend/src/foundation/config.ts | 81 | B018 if condition contains 5 boolean leaves; threshold 3 | [Minor][SM-B05+TH-07] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/experience.ts | 90 | B019 if condition contains 5 boolean leaves; threshold 3 | [Minor][SM-B05+TH-07] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/experience.ts | 263 | B032 if condition contains 4 boolean leaves; threshold 3 | [Minor][SM-B05+TH-07] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/preparation.ts | 289 | B033 if condition contains 4 boolean leaves; threshold 3 | [Minor][SM-B05+TH-07] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/preparation.ts | 308 | B034 if condition contains 4 boolean leaves; threshold 3 | [Minor][SM-B05+TH-07] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/question-policy.ts | 22 | B020 if condition contains 5 boolean leaves; threshold 3 | [Minor][SM-B05+TH-07] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/routes.ts | 169 | B021 if condition contains 5 boolean leaves; threshold 3 | [Minor][SM-B05+TH-07] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/service.ts | 225 | B035 if condition contains 4 boolean leaves; threshold 3 | [Minor][SM-B05+TH-07] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/service.ts | 420 | B036 if condition contains 4 boolean leaves; threshold 3 | [Minor][SM-B05+TH-07] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/service.ts | 474 | B037 if condition contains 4 boolean leaves; threshold 3 | [Minor][SM-B05+TH-07] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/service.ts | 593 | B005 if condition contains 6 boolean leaves; threshold 3 | [Minor][SM-B05+TH-07] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/service.ts | 724 | B006 if condition contains 6 boolean leaves; threshold 3 | [Minor][SM-B05+TH-07] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/streaming-agent.ts | 98 | B022 if condition contains 5 boolean leaves; threshold 3 | [Minor][SM-B05+TH-07] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/streaming-agent.ts | 170 | B038 if condition contains 4 boolean leaves; threshold 3 | [Minor][SM-B05+TH-07] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/streaming-agent.ts | 203 | B023 if condition contains 5 boolean leaves; threshold 3 | [Minor][SM-B05+TH-07] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/streaming-agent.ts | 295 | B039 if condition contains 4 boolean leaves; threshold 3 | [Minor][SM-B05+TH-07] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/streaming-agent.ts | 794 | B040 if condition contains 4 boolean leaves; threshold 3 | [Minor][SM-B05+TH-07] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/streaming-agent.ts | 833 | B041 if condition contains 4 boolean leaves; threshold 3 | [Minor][SM-B05+TH-07] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/streaming-agent.ts | 844 | B024 if condition contains 5 boolean leaves; threshold 3 | [Minor][SM-B05+TH-07] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/streaming-agent.ts | 847 | B025 if condition contains 5 boolean leaves; threshold 3 | [Minor][SM-B05+TH-07] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/streaming-agent.ts | 862 | B002 if condition contains 8 boolean leaves; threshold 3 | [Minor][SM-B05+TH-07] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/voice/activity.ts | 41 | B007 if condition contains 6 boolean leaves; threshold 3 | [Minor][SM-B05+TH-07] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/voice/session.ts | 412 | B004 if condition contains 7 boolean leaves; threshold 3 | [Minor][SM-B05+TH-07] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/voice/session.ts | 430 | B042 if condition contains 4 boolean leaves; threshold 3 | [Minor][SM-B05+TH-07] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/voice/session.ts | 516 | B043 if condition contains 4 boolean leaves; threshold 3 | [Minor][SM-B05+TH-07] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/voice/session.ts | 602 | B044 if condition contains 4 boolean leaves; threshold 3 | [Minor][SM-B05+TH-07] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/voice/session.ts | 622 | B045 if condition contains 4 boolean leaves; threshold 3 | [Minor][SM-B05+TH-07] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/voice/session.ts | 690 | B008 if condition contains 6 boolean leaves; threshold 3 | [Minor][SM-B05+TH-07] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/interviews/workflow-models.ts | 60 | B026 if condition contains 5 boolean leaves; threshold 3 | [Minor][SM-B05+TH-07] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/reports/aggregate.ts | 161 | B046 if condition contains 4 boolean leaves; threshold 3 | [Minor][SM-B05+TH-07] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/reports/analysis.ts | 204 | B047 if condition contains 4 boolean leaves; threshold 3 | [Minor][SM-B05+TH-07] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/reports/analysis.ts | 261 | B048 if condition contains 4 boolean leaves; threshold 3 | [Minor][SM-B05+TH-07] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/reports/analysis.ts | 302 | B009 if condition contains 6 boolean leaves; threshold 3 | [Minor][SM-B05+TH-07] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/reports/analysis.ts | 346 | B049 if condition contains 4 boolean leaves; threshold 3 | [Minor][SM-B05+TH-07] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/reports/analysis.ts | 359 | B010 if condition contains 6 boolean leaves; threshold 3 | [Minor][SM-B05+TH-07] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/reports/analysis.ts | 369 | B050 if condition contains 4 boolean leaves; threshold 3 | [Minor][SM-B05+TH-07] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/reports/service.ts | 302 | B027 if condition contains 5 boolean leaves; threshold 3 | [Minor][SM-B05+TH-07] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/reports/service.ts | 406 | B011 if condition contains 6 boolean leaves; threshold 3 | [Minor][SM-B05+TH-07] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/reports/service.ts | 452 | B028 if condition contains 5 boolean leaves; threshold 3 | [Minor][SM-B05+TH-07] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/reports/service.ts | 484 | B051 if condition contains 4 boolean leaves; threshold 3 | [Minor][SM-B05+TH-07] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/reports/service.ts | 512 | B012 if condition contains 6 boolean leaves; threshold 3 | [Minor][SM-B05+TH-07] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/reports/service.ts | 555 | B013 if condition contains 6 boolean leaves; threshold 3 | [Minor][SM-B05+TH-07] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/modules/reports/service.ts | 794 | B001 if condition contains 9 boolean leaves; threshold 3 | [Minor][SM-B05+TH-07] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/tasks/runner.ts | 84 | B052 if condition contains 4 boolean leaves; threshold 3 | [Minor][SM-B05+TH-07] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/tasks/runner.ts | 116 | B053 if condition contains 4 boolean leaves; threshold 3 | [Minor][SM-B05+TH-07] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/backend/src/tasks/service.ts | 27 | B029 if condition contains 5 boolean leaves; threshold 3 | [Minor][SM-B05+TH-07] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/core_engine/src/question-scoring.ts | 139 | B054 if condition contains 4 boolean leaves; threshold 3 | [Minor][SM-B05+TH-07] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/frontend/components/account-access.tsx | 54 | B014 if condition contains 6 boolean leaves; threshold 3 | [Minor][SM-B05+TH-07] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/frontend/components/interview-workspace.tsx | 285 | B055 if condition contains 4 boolean leaves; threshold 3 | [Minor][SM-B05+TH-07] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/frontend/features/live-interview/interview.tsx | 66 | B056 if condition contains 4 boolean leaves; threshold 3 | [Minor][SM-B05+TH-07] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/frontend/features/live-interview/interview.tsx | 135 | B057 if condition contains 4 boolean leaves; threshold 3 | [Minor][SM-B05+TH-07] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/frontend/features/live-interview/preparation.tsx | 184 | B058 if condition contains 4 boolean leaves; threshold 3 | [Minor][SM-B05+TH-07] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/frontend/features/live-interview/report-progress.tsx | 22 | B003 if condition contains 8 boolean leaves; threshold 3 | [Minor][SM-B05+TH-07] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/frontend/features/live-interview/report-progress.tsx | 42 | B059 if condition contains 4 boolean leaves; threshold 3 | [Minor][SM-B05+TH-07] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/frontend/features/live-interview/start-request.ts | 73 | B060 if condition contains 4 boolean leaves; threshold 3 | [Minor][SM-B05+TH-07] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/frontend/features/live-interview/stream.ts | 34 | B061 if condition contains 4 boolean leaves; threshold 3 | [Minor][SM-B05+TH-07] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/frontend/features/live-interview/stream.ts | 55 | B015 if condition contains 6 boolean leaves; threshold 3 | [Minor][SM-B05+TH-07] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/frontend/features/live-interview/use-question-presentation.ts | 13 | B016 if condition contains 6 boolean leaves; threshold 3 | [Minor][SM-B05+TH-07] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/frontend/features/live-interview/voice/use-voice.ts | 41 | B062 if condition contains 4 boolean leaves; threshold 3 | [Minor][SM-B05+TH-07] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/frontend/lib/api/http.ts | 47 | B030 if condition contains 5 boolean leaves; threshold 3 | [Minor][SM-B05+TH-07] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/frontend/lib/api/http.ts | 118 | B031 if condition contains 5 boolean leaves; threshold 3 | [Minor][SM-B05+TH-07] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| code/frontend/lib/api/http.ts | 132 | B017 if condition contains 6 boolean leaves; threshold 3 | [Minor][SM-B05+TH-07] 依据 strict 实测，按职责复核并整改；保留候选，不计为等量功能故障。【未关闭，未豁免】 |
| docs/software/README.md | 13 | N1 工程文档缺少质量、评审和部署导航 | [Minor][SM-D03] 增加三份工程报告入口，与测试索引互相引用。【已修订 ce88b1c】 |
| tests/README.md | 22 | D11 现有测试缺少需求到用例的集中索引 | [Minor][SM-D03] 整理 TC-01 至 TC-10 的需求、前置条件、输入、预期和实际测试入口，复用已有代码。【已建立 ce88b1c】 |
| code/frontend/lib/api/http.ts | 109；server/app.ts:68 | R3 成功 JSON 的运行时 DTO 校验边界需明确 | [审查关注项][SM-V07] 服务端 Zod 响应序列化及契约测试控制成功 DTO，共享客户端负责传输；泛型只提供静态类型。完整客户端运行时结构校验尚未增加。【边界已核对】 |
| docs/algorithm/evaluation.md；tests/interviewlab_demo_user_test.md | 166、206；3 | U2 产品效果、真实媒体和人工验收证据不足 | [验收缺口] 独立人工 90% 审查、专业评分校准、正式全量向量发布、真实麦克风、交叉试用、长时资源观测及发布恢复演练未在本轮完成。【待实际验证与签署】 |
| docs/software/code_quality.md | 当前第 4 节及附录 F | U3 全量工程检查仍有边界 | [证据跟踪] 已补覆盖率、模块环、依赖、密钥和 TODO 实测；完整死代码/未使用导出、注入、日志、等待链仍未执行，真实对象/资源长期观测未知。见 followup/engineering-checks.json、coverage.json。【部分关闭】 |
| 本轮新增 report-overview.tsx 等源码及证据 | 1 | G1 本轮新增文件尚未版本归档 | [交付跟踪] 前期 5bfb56d、03a41dd、cc0a3bc 已归档并合并；v1.5 新增源码、测试及附件仍在工作区，未纳入本轮提交。【未关闭】 |

# 6.跟踪调查

## 评审结论

|  检查项目  | 结果  |说明|
|  :----  |:----------:  |:----  |
| 代码质量较好 | 否 | 续时提示和冲突已修；RS001–RS109、重复候选、超建议批量及未归档项仍未关闭。 |
| 重新编写并验证 | 未完成 | 普通351、数据库全量89及最终面试46、前后端构建和90.36%插入行覆盖通过；整体strict未全部通过。 |
| 重新编写并重新审查 | 未通过 | 已复扫与回归具体修正，结构/重复及人工效果仍待核验。 |

### 说明

代码质量较好为“否”时，需要“重新编写并验证”和“重新编写并重新审查”。


## 在这里记录审查的结果

|  检查项目  | 结果  |说明|
|  :----  |:----------:  |:----  |
| 审查 | 结果1：存在问题，需重新校验并重新审查 | UIQ01/UI03已处理，UIW01–UIW11及U1/U2/G1/G2等仍需后续整改或人工核验。 |
| 校验 | 结果1：未通过校验 | 本次已运行编译/类型/345项测试、插入行覆盖及依赖/密钥检查达标；局部strict11条、低token重复人工核查及分批归档尚未全部通过。v1.5/v1.6结果保持原范围。 |


# 附录 A 本对话规范整改全过程

## A.1 依据与阶段台账

本报告覆盖本对话内的软件工程规范检查、修订、代码整改与验证。评审正文按教师原模板保留 0–6 章和检查项，仅填写结果、说明及第 5 章的问题记录。质量报告按课程任务顺序记录扫描与重构证据。教师给出的建议评审时长保留在正文中，实际人工评审人和耗时待团队登记。[教师模板](https://github.com/bettermorn/ACMWDevHubPPT/blob/master/Methodology/CodeReviewTemplate.md) · [教师质量方法](https://github.com/bettermorn/ACMWDevHubPPT/blob/master/Methodology/CodeQualitySkill.md) · [质量全过程报告](code_quality.md)

| 阶段 | 日期与输入 | 实际处理 | 产出及状态 |
| --- | --- | --- | --- |
| P01 课件对照和首次检查 | 2026-11-15，297 页课件及 `bb545a3` | 按需求、设计、开发、测试、部署、管理逐项核对，检查分层、事务/任务、权限、版本和工程证据 | 发现规格漂移、证据入口和验收缺口；普通测试 286/286、前后端构建通过，初期 Docker 不可用，独立数据库回归当时未重跑 |
| P02 确认整改范围 | 2026-11-16，项目现状和课件要求 | 确认逐项对照，复用已有实践和证据，仅补确认的差距；以当前实现及产品决定核实过时说明 | 确定规格、测试、质量、评审、部署、试用及协作的核对范围 |
| P03 同步远端 | 2026-11-16，`bb545a3 → f10d7e1` | 先只读比较远端，再 fetch；确认可快进且不覆盖两份已有管理文档，执行 `merge --ff-only origin/main` | 远端多一个提交但源码内容一致，本地管理文档改动保留 |
| P04 补齐规格和工程入口 | 2026-11-16，按 D1–D12、N1、F1 处理 | 修正时长、题量、硬上限、类型、默认交互、评分版本、偏好接入、真实模型脚本、迁移影响与个人入口用途；整理 10 个用例 | 完成 `ce88b1c` 对应 15 份文档的更新和入口；交叉试用表、部署检查均写明待实际执行 |
| P05 纳入有效管理修订 | 2026-11-16，已有的 11 月 12 日 v0.4 管理文档 | 用户确认两份改动有效，将生命周期沟通表和风险/额度预案纳入本次提交 | `44dce33`，2 份管理文档；修改来源按实际记录 |
| P06 本地提交及推送 | 2026-11-16，用户授权 | 分别提交管理计划和规范/证据整理；推送 `codex/all-role-agent` 并核对远端 HEAD | 当时远端包含 `44dce33`、`ce88b1c`，工作区干净；后续观察到 PR #52 的合并提交 `d300e8b`，作为 11 月 25 日基线 |
| P07 按教师链接初审 | 2026-11-25，课程 171/172 和模板 | 获取课程源文件、CodeReviewTemplate 和 CodeQualitySkill；隔离安装扫描工具，导出 Git 快照，运行 ESLint/sonarjs/jscpd，生成 JSON、HTML 和截图 | 已提交基线为 Error 0、Warning 253、最高圈复杂度 192；当日工作区普通测试 293/293、直接专项 13/13 |
| P08 确认代码问题并整改 | 2026-11-25，R1–R5、Q1–Q5 | 修复展示回执重试；隔离跨场次在途操作与已运行场次资源，清理设备/草稿/绑定/文字降级；分离五个复杂入口及设备职责 | 新增 7 份源码、修改 6 份源码；补充 5 份测试共 18 项；提示文本做 AST 比对，已有评分和事实边界继续回归 |
| P09 处理验证中发现的边界 | 2026-11-25，临时构建和复审结果 | 先修复跨场次设备复用，再补“已运行后切换”用例；前端临时副本跨盘路径和依赖定位失败后改同盘副本并补齐依赖链接；修正场次返回值的空值判定 | 中间普通回归 310/310，最终 311/311；前后端生产构建通过，生产代理回归通过 |
| P10 最终回归与复扫 | 2026-11-25，相同工具、规则及前置补丁 | 验证普通、数据库、进程和代理；对整改前后工作区留源码摘要及逐文件扫描记录 | 311/87/4/1 项分别全部通过。Error 0、Warning 258、最高圈复杂度 52；重复行 134 不变，比例 0.47% |
| P11 临时资源清理状态 | 2026-11-25，本轮专用测试库和构建副本 | 清理命令被自动审批拒绝，仅返回 `blocked by policy` | 清理未执行，临时资源保留；这项状态与已通过的验证结果分别记录 |
| P12 模板和全过程整合 | 2026-11-25，本版报告 | 恢复教师原始章节层级、表格和检查项，补齐本对话前期文档、提交/推送、初审、整改、验证和未关闭项 | 本版为 1.3；严格结论保留“未通过复审”，已完成的自动验证按实际填报 |

P01 的 PDF 为本地《SWIEP软件工程》课件，源文件位于课程资料目录，报告未复制该教材。P01、P04、P07、P10 的测试数量代表不同日期和代码范围。历史覆盖率 71.65% 是 2026-11-16 的普通测试采样，未包含独立数据库回归，完整核心覆盖率仍待合并统计。

## A.2 全部文档变更和提交

| 提交或阶段 | 文件 | 本对话处理 |
| --- | --- | --- |
| `44dce33` | [沟通管理](../../../../mgmt/communication_mgmt_plan.md)、[风险管理](../../../../mgmt/risk_mgmt_plan.md) | 两份既有有效修改经确认后提交，记录沟通安排、七项风险及 API 额度预案 |
| `ce88b1c` | [问题定义](../../../../requirements/problem_definition.md)、[功能需求](../../../../requirements/functional_spec.md)、[非功能需求](../../../../requirements/nonfunctional_spec.md)、[用户故事](../../../../requirements/user_stories.md) | 对齐产品、时长、类型、默认方式、评分和验收口径 |
| `ce88b1c` | [Agent 方法](../../../../algorithm/knowledge_and_agent.md)、[评测](../../../../algorithm/evaluation.md)、[数据与接口](../../../data_and_interfaces.md)、[材料说明](../../../personal-materials-implementation.md) | 明确当前/历史规则、脚本实际依赖及偏好接入状态 |
| `ce88b1c` | [软件导航](../../../README.md)、[运行指南](../../../development.md)、[部署检查](../../../deployment.md) | 增加质量/评审/部署入口，说明完整启动和迁移影响 |
| `ce88b1c` | [测试索引](../../../../../tests/README.md)、[交叉试用表](../../../../../tests/interviewlab_demo_user_test.md) | 复用已有测试整理 TC-01–TC-10，建立实际试用记录入口 |
| `ce88b1c` 及本轮修订 | [质量报告](code_quality.md)、本评审报告 | 初版证据入口、11 月 25 日初审和整改复扫、本版全过程记录 |

两次提交覆盖 17 份 Markdown，其中本版两份报告继续更新。前期提交分别可由 [44dce33](https://github.com/hcxlwxlwj/InterviewLab/commit/44dce33)、[ce88b1c](https://github.com/hcxlwxlwj/InterviewLab/commit/ce88b1c)核对。当前 `d300e8b` 为已存在的 [PR #52 合并](https://github.com/hcxlwxlwj/InterviewLab/commit/d300e8b)；本轮整改按用户要求追加本地提交，源码、测试、报告和证据同批归档。

## A.3 源码、测试与附件范围

| 类别 | 文件及状态 |
| --- | --- |
| 6 份既有源码整改 | `code/backend/src/modules/interviews/streaming-agent.ts`；`code/backend/src/modules/reports/aggregate.ts`、`analysis.ts`；`code/frontend/features/live-interview/analysis.tsx`、`interview.tsx`、`flow-provider.tsx` |
| 7 份新增源码 | 同一前端目录中的 `analysis-state.ts`、`entry-request.ts`、`presentation-request.ts`、`use-question-presentation.ts`、`use-prepared-devices.ts`、`interview-notices.tsx`、`interview-presentation.ts` |
| 2 份核对的既有合同源码 | `code/frontend/features/live-interview/start-request.ts`、`code/frontend/lib/api/http.ts`，复用其开始恢复和统一传输合同 |
| 5 份新增测试 | `tests/unit/analysis-state.test.ts` 3 项、`entry-request.test.ts` 4 项、`presentation-request.test.ts` 5 项、`interview-notices.test.ts` 3 项、`interview-presentation.test.ts` 3 项，共 18 项 |
| 1 份既有数据库测试更新 | `tests/integration/database/all-role-knowledge.test.ts`，修正 HR 问题合同，并加强发布版本、岗位、阶段、类型及评价参考隔离断言 |
| 5 份扫描附件 | `quality/2026-11-25/` 下的 `baseline-workspace.patch`、`eslint.config.mjs`、`scan.json`、`scan-report.html`、`scan-report.png` |

已有测试在源码整改前后实际运行。18 项新增回归在整改实现过程中补充并验证，未保留先于实现的新增用例失败运行记录。

## A.4 原有工作区改动与历史开发的归属

11 月 25 日开始时已有的 9 项改动为 `code/frontend/features/live-interview/setup-state.ts`、`setup.tsx`、`code/frontend/lib/api/interviews.ts`、`code/frontend/package.json`、`package-lock.json`、`docs/software/architecture.md`、`docs/software/repository_structure.md`、`tests/unit/interview-setup.test.ts`、`tests/unit/interview-jobs-client.test.ts`。本轮保留这些输入，整改完成时核对原有差异仍与起始基线一致。扫描前后副本都包含前三份源码的前置补丁。

`9546bf5 → 93d05fc` 为本对话之前的历史职责拆分及功能改进，报告引用其指标作历史对照。该历史变更的 `InterviewBody` 圈复杂度 83→65；本轮为 65→40，原始记录均保存在 [scan.json](../../2026-11-25/scan.json)。

# 附录 B 模板外补充检查项

| 检查项目 | 结果 | 说明 |
| --- | --- | --- |
| 不存在硬编码的密钥、口令和环境信息（SM-V05） | 是 | Gitleaks 8.30.1 默认规则扫描当前 469 份快照文件，完全脱敏、忽略内联放行标记，命中 0。私有忽略文件及全历史未扫描；范围见 engineering-checks.json。 |
| 不存在 SQL、命令、HTML 注入风险（SM-V13） | 未知 | 本次主要保持领域与传输边界，完整注入专项审计未执行 |
| 已做鉴权与越权（IDOR）检查 | 是 | 独立数据库、账号、Origin、事件与代理相关回归通过，覆盖范围按已有测试记录 |
| 日志中无敏感信息（SM-V17） | 未知 | 本次未新增回答或密钥日志；全日志链路审计未执行 |
| 依赖无高危漏洞，新增依赖已锁定版本（TH-14，SM-V18） | 是 | 本轮 npm audit 已知漏洞 0；业务依赖未新增。临时质量工具固定版本且不纳入业务锁文件；该结果不代表未来没有新公告。 |
| 单元测试有效：有断言，覆盖异常路径，未 Mock 被测对象（SM-V06） | 是 | 新增用例直接调用回执、进入和展示逻辑，断言键、版本、次数、状态、取消顺序与输出 |
| 变更聚焦，无超范围修改（SM-V10，TH-11） | 否 | 改动围绕用户授权的确认差距；源代码加删 1919 行，TH-11 的 400 行小批门槛未满足，尚未分批提交与评审，见 G2。未将该项豁免为通过。 |
| 公共接口和数据结构的变更向后兼容，或附有迁移方案 | 是 | 本轮保留既有公开 API/DTO/评分合同，数据库回归含历史迁移起点及报告兼容检查 |

# 附录 C 给人工评审者的关注点

1. 用真实浏览器和设备验证已运行场次切换、迟到权限结果与设备释放。
2. 核对展示回执持续失败时的提示和重试是否便于用户理解。
3. 确认 HTTP 成功 DTO 的服务端合同与客户端信任边界。
4. 结合具体业务变更继续整理 Q1、Q3、R5 和 258 条残留告警，并逐项判断 16 个候选重复块。
5. 确认团队采用的分支流程、负责人、交叉用户试用、发布恢复演练及人工签署记录。

# 附录 D 提交、PR 与集成失败复验

| 阶段 | 输入及动作 | 实际结果 |
| --- | --- | --- |
| 提交独立复验 | 独立检出 `5bfb56d`，复用已安装依赖，不包含工作区另 9 项改动；运行 `npm run check` | 304/304 普通测试、类型/边界/内容检查通过；59 份 Markdown、508 个本地链接通过 |
| 推送及创建 PR | 推送 `codex/all-role-agent`，核对远端 HEAD 为 `5bfb56d`；创建 [PR #54](https://github.com/hcxlwxlwj/InterviewLab/pull/54) 到 `main` | PR 已打开，未执行合并 |
| 云端集成失败 | 分支 push 检查已通过；PR 检查验证 `5bfb56d` 与更新后的 `2205b2e` 合并结果 `55620a2` | [application 日志](https://github.com/hcxlwxlwj/InterviewLab/actions/runs/45633138412/job/139271399599)在 `.github/scripts/check-content.ts:376` 报 TS2339：数组无 `size` |
| 同步并复现 | 在隔离工作树合入 `origin/main`，原工作区未提交改动保留；先运行 `npm run typecheck` | 复现同一 TS2339，确认实际失败位置 |
| 最小修复及回归 | 数组计数改为 `publishedJobs.length`；重新运行 `npm run check` | 311/311 普通测试、0 失败、0 跳过；边界、类型、内容、文档检查通过。新主分支比原独立提交增加 7 项用例，数量与工作区历史的 311 项分别归档 |
| 应用通过后继续核查数据库 | `03a41dd` 的 push/pull_request 应用及文档检查均通过；[后端日志](https://github.com/hcxlwxlwj/InterviewLab/actions/runs/45633817945/job/139273804101)显示数据库 86/87 | 唯一失败为全岗位检索测试仍禁止 HR 返回 question；当前明确适用 HR 的问题符合目录 binding 合同 |
| HR 检索合同复验 | 新建专用 `interviewlab_test_pr54_*` 数据库先复现失败；更新类型白名单并加强版本、岗位、阶段、类型及评价参考隔离断言 | 全量数据库 87/87、进程测试 4/4、0 失败、0 跳过；后端生产构建通过；生产检索逻辑保持当前合同 |

本次修复未添加依赖、未调整工作流或跳过断言。全量静态质量复扫、完整覆盖率及真实设备/人工验收未在此轮追加，原记录的版本范围继续有效。云端最终状态以 PR 对应提交的 Actions 为准。


# 附录 E v1.5 按 CodeQualitySkill 继续整改

评审范围、S0–S6、三轮复核及完整历史均见[质量报告](code_quality.md)。本轮保留教师原 0–6 章、表格及检查项文字，仅填结果/说明并在第 5 章追加实际发现；旧问题行保留历史处理状态。产品源码423条、当前两份测试另有8条，合计431条strict命中；F001–F423 为产品量化命中，B001–B062 为长条件候选，DUP01–DUP10 为固定主对照的重复块，均带路径与行号。

本轮隔离验证为普通321、数据库87、进程4、生产代理1，全部通过；合回原有输入后npm run check另通过328项普通测试、59份Markdown与527个本地链接，输入范围分别保留；新增9项视图/语音回归。新增/修改行覆盖 **86.07%**，达到80%；全源码行覆盖70.91%、core_engine 75.14%，均保留真实采样范围，不与旧71.65%直接比较。覆盖率先因Node原生采样器异常失败，换临时c8后完成；代理默认端口占用改用隔离端口后通过，未停止既有开发服务。

本轮新增源码与证据尚未提交，因此版本控制项及 G1 保留未通过；改动1919行，G2保留超过400行小批门槛。按教师 Skill 的“最多 3 轮”要求，三轮后剩余结构 Major 交由后续评审处理，结论仍为“重新编写并重新审查：未通过”，没有把CI通过当作全部质量项通过，没有代填人工签署或团队豁免。

证据：[前后扫描与源码摘要](../../2026-11-25/followup/scan.json)、[模块/依赖/密钥/TODO等](../../2026-11-25/followup/engineering-checks.json)、[覆盖率](../../2026-11-25/followup/coverage.json)、[原始低token探测](../../2026-11-25/followup/strict-duplication-probe.json)、[扫描截图](../../2026-11-25/followup/scan-report.png)。原9份输入文件在同步时保留，架构仅在其有效修改上补两处当前数量；源码扫描和回归排除这些原有输入。PR #54已于94e556f合并，随后49fc03d的他人修复不计为本轮原创工作。

# 附录 F v1.6 用户反馈的入口与文案整改

2026-11-26，用户提供配置页与岗位下拉截图，初步要求面试从岗位进入及清除开发遗留小字；初稿统一入口后，用户再次确认：导航栏进入时保留岗位下拉，从岗位库明确选岗后不在配置内改动。最终采用双入口，简历区继续精简。仅围绕UI-01/UI-02调整，不追加无关结构重构；全部最终修改及已还原文件见[质量报告附录H](code_quality.md#附录-h-v16-岗位入口与提示文案整改2026-11-26)。本表原0–6章与48项检查项目文字保留。

| 步骤 | 本次实际过程与证据 |
| --- | --- |
| S0–S1 | 以当前工作区为输入，保留前序未提交整改；核对岗位、配置、简历与恢复入口，阅读项目约束及Next本地路由文档。用户二次确认后修订验收：通用入口可选岗，明确岗位入口固定该岗位 |
| S2–S3 | 无job/空白job复用现有岗位列表与下拉，优先恢复原岗位；有job只读取对应模板并静态展示，重复参数回岗位库，无效明确岗位报错。初稿6份导航改动恢复原入口，已知岗位的重新面试入口继续携带岗位；精简简历及相邻页面重复/过时说明 |
| S4 | 新增[6项入口/展示用例](../../../../../tests/unit/interview-entry.test.ts)及[2项配置/恢复用例](../../../../../tests/unit/interview-setup.test.ts)，定向23/23通过；保留提交一致性校验的最终完整检查336/336、边界/类型/内容及隔离前端构建通过。[最终范围strict扫描](../../2026-11-26/interview-setup/scan.json)为0Error/25Warning，产品25、测试0，细分17长函数/6圈复杂度/2认知复杂度；ConfigurationForm仍285有效行/CC31。报告更新后最终文档59份/539链接复验通过，git diff --check无错误 |
| S5–S6 | 同步本表、质量报告、功能需求与原型入口。Edge核对导航入口保留原生岗位下拉，前端切广告SRE后阶段为校招且开始按钮可用；岗位详情携带job进入后固定岗位、岗位下拉数量为0。沿用提交前所选ID与目录的一致性校验。本次未保留新增用例先红记录，不声明严格TDD顺序 |

本次未提交/推送；未新增页面截图证据，也未重新执行全量strict、重复率或覆盖率采样。范围扫描包括已还原的6份导航文件，不能把局部告警当作全项目数字；最终源码SHA-256与逐文件/行号以本次scan.json为准。F001–F423、T001–T008、DUP01–DUP10、v1.5的86.07%覆盖率等仍绑定原附件快照。本次UI回归不能关闭结构告警、真实模型/设备、长期资源或团队人工签署等前序待办。


# 附录 G v1.7 后端重启与新增代码质量复核

本次按用户明确要求关闭原API/worker并按原配置重启，API3003、前端3000；直接健康与前端代理请求200，ready数据库和worker均为true。未修改运行配置，未启动真实面试、模型或媒体采集。对应工程证据见[本轮工程检查](../../2026-11-26/setup-review/engineering-checks.json)。

| 步骤 | 本次实际过程与证据 |
| --- | --- |
| S0–S1 | 以任务开始时不可变工作区副本为起点，评审原9份UI产品源码；保留原有改动与双入口行为。教师模板原48项文字与顺序已逐项比较，无缺项、增项或改写 |
| S2–S3 | UIQ01将原285行/CC31配置函数按状态、面板、摘要分职责，删除恒空command；UI03修正临时目录读取错误卸载表单导致未提交选择丢失。没有新增“岗位失效”业务或认定现有岗位不可用 |
| S4 静态与工程 | [正式strict扫描](../../2026-11-26/setup-review/scan.json)：起点9产品13条，结束12产品11条、3测试0条，Error均0；11条逐项列UIW01–UIW11。相关5个setup模块正式strict0告警、所有函数最高CC6；ConfigurationForm现11行/CC3。npm audit412依赖0漏洞，Gitleaks默认规则/完全脱敏15份源码与测试0命中 |
| S4 回归与覆盖 | 新增配置2项、展示/真实hook SSR7项；3份测试定向24/24，最终完整及c8各345/345、0跳过。185份TS边界/类型/内容及同盘隔离workspace webpack构建通过；最终文档59份/550个本地链接与git diff --check通过。[覆盖附件](../../2026-11-26/setup-review/coverage.json)：task-start插入行85.01%（380/447）；HEAD累计UI86.50%（538/622）含此前用户补丁；局部12产品源码整体44.46%（763/1716），三种分母分别记录 |
| S4 重复与模块 | 6行/50token/mild主检测0→0；[6行/1token探测](../../2026-11-26/setup-review/duplication-probe.json)为126→127重叠候选，尚未人工逐块判定，不认定strict零重复通过。完整源码模块图运行时环0，含类型边2组；2个Next生成类型文件在inventory外但实际存在，保留raw结果及解释，不列为产品缺失模块 |
| S5–S6 | [质量报告附录I](code_quality.md#附录-i-v17-后端重启与新增代码质量复核2026-11-26)按教师四任务记录前后对比、修正与限制；[可视扫描报告](../../2026-11-26/setup-review/scan-report.html)对应本次证据。本轮4产品/2测试有净修改，12产品/3测试为审查范围，不和前序文件数直接相加 |

本轮已确认问题已改，自动回归/编译及新增行覆盖通过；11条旧结构Major、低token重复人工判定、760行超过建议批量和未归档项仍未关闭，因此第6章继续为“代码质量较好：否；重新编写并验证：未完成；重新编写并重新审查：未通过”。结果列按Skill7.2规定枚举填写，自动检查事实放在说明列，不以自定义结果文字代替结论。

本次SSR使用真实Provider/hook，没有Mock被测对象；SSR不运行挂载effects和浏览器事件，目录失败再恢复的完整客户端交互、真实设备/模型及团队人工验收仍未实测。本轮未重新做Edge验收或生成新截图，v1.6的Edge和v1.5的截图仍只证明原版本与范围。旧全量423+8、v1.6局部25、本轮局部11不能直接比较为同口径全项目趋势。本次未提交/推送。


# 附录 H v1.8 远端同步与新增代码检查

S0–S1：按教师CodeQualitySkill保留原48项；fetch并快进4b08a0f→be648d9，三提交/36文件，远端428插入187删除。stash保存全部工作区，合回setup、controls及voice-interface三处冲突，备份保留。

S2–S3：保留本地双入口、简历精简和职责拆分，接入续时、10/14/18主问题预算、身份边界、语音隔离及精简操作；修正续时提示累计时长并拆分新增长函数。追加3个数据库用例（未到时长拒绝/两个截止同时延长及幂等/已作答续时重新排队不改答案）和1个SSR用例（当前题澄清/跳过）。迁移0012/0013在已有容器启动后成功应用。

S4：普通351项通过；先全量DB89项通过，再含最终新增用例的面试46项通过（重叠不相加）；前后端构建通过，前端使用同盘隔离webpack。c8合并采样178/197=90.36%；18产品strict0Error/109Warning，正式规则未放宽，RS001–RS109逐项列出。6行50token检测1个14行重复块；产品快照Gitleaks0命中，不代表全历史或.env。

S5–S6：同步两份报告及[本轮扫描](../../2026-11-26/remote-sync/scan.json)、[覆盖率](../../2026-11-26/remote-sync/coverage.json)、[验证明细](../../2026-11-26/remote-sync/checks.json)。本轮以同步前工作区为比较基线，不能把109与旧423+8/11直接比较。静态结构、重复和归档仍未全过，整体严格结论保持未通过；真实模型/媒体、人工签署及进程/代理专项未重跑，未提交或推送。
