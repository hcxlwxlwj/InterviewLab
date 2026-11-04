# 软件设计文档

保留远端原有主文档，按责任组织，不按子功能继续拆文件。

- [系统架构](architecture.md)：保留原六层结构、章节编号、表格及绘图样式，更新实际组件和边界。
- [数据与接口](data_and_interfaces.md)：当前/目标合同、业务与知识 ER、字段、状态、事务、权限、删除及 HTTP/SSE/WS。
- [Agent 接入](interview-agent-implementation.md)：模型与框架分工、简历/准备/单轮工作流、准备状态及发布控制。
- [动态面试](interview-agent-v3.md)：流式问题、受限动作、私有记忆、经历/话题边界和取消；保留有日期的历史验证。
- [个人材料](personal-materials-implementation.md)：导入、核对、版本、个人设置与派生分析。
- [实时语音与视频](voice-interview.md)：ASR/TTS、端点、打断、默认设备与本机视频房间。
- [账号管理](account-management.md)：认证、页面访问与会话变化。
- [运行指南](development.md)：统一维护启动、知识构建发布、验证与回退命令。
- [工程目录](repository_structure.md)、[原型](prototype/README.md)：源码归属及界面设计证据。

算法细节和质量记录分别见[知识与 Agent](../algorithm/knowledge_and_agent.md)、[评测](../algorithm/evaluation.md)，不在多份软件文档复制参数和结果。
