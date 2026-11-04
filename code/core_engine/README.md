# 领域核心

只维护当前共享 DTO、岗位内容结构、面试题量与证据规则、简历结构、语音协议和报告规则。核心不依赖框架、Node 或外部内容文件。

- live-interview.ts、agent-workflow.ts、interview-agent.ts：当前面试、准备、规划、记忆与检索合同。
- domain/knowledge.ts、knowledge.ts：已发布岗位、原创问题及来源的结构化查询。
- foundation.ts：身份、任务、分页和错误合同。
- personal.ts、resume-template.ts：本人材料版本和确认后的简历结构。
- feedback-template.ts、report-rubric.ts：当前报告及历史报告的可读评分规则。
- voice.ts：共享媒体事件；configuration.ts 只维护显示标签。

已删除同步演示 Session、预设题单、假报告计算及 DataClient 端口。npm run boundaries:check 和 npm test 验证依赖边界及领域规则。
