# 软件设计

版本：v0.2 · 日期：2026-10-15 · 状态：待实现设计，本轮不搭建前端。

本目录是架构、接口、模块和原型正文的唯一维护位置。

| 正文 | 内容 |
| --- | --- |
| [总体架构](architecture.md) | 模块化单体、业务编排、任务、适配层、隔离代码执行与部署 |
| [数据与接口](data_and_interfaces.md) | 简历库、经历、实时回合、原作答/识别纠错、音视频观测、临时复盘媒体、报告与删除 |
| [原型说明](prototype/README.md) | 首页、配置、双栏面试、代码面板、报告和个人中心 |
| [功能需求](../requirements/functional_spec.md) | 范围和需求编号 |
| [评测方案](../algorithm/evaluation.md) | 合成案例、接口与恢复验证、试用对照 |

## 模块设计

| 模块 | 正文 |
| --- | --- |
| 01 岗位与 JD | [岗位理解](modules/01-job-understanding.md) |
| 02 简历库与事实 | [个人材料](modules/02-personal-materials.md) |
| 03 配置与重点经历 | [面试配置](modules/03-interview-configuration.md) |
| 05 面试编排 | [模拟面试](modules/05-mock-interview.md) |
| 06 实时语音与可选镜头 | [语音与表达观测](modules/06-voice-and-speech.md) |
| 07 面后分析 | [分析报告](modules/07-feedback-report.md) |
| 08 定向重练 | [重练与对比](modules/08-retry-and-progress.md) |
| 09 内容和运维 | [运行维护](modules/09-content-and-operations.md) |
| 10 可选代码题 | [代码考核](modules/10-code-assessment.md) |
| 11 个人数据入口 | [个人中心](modules/11-personal-center.md) |

实时口头面试为目标主线，文本替代可独立完成；表达反馈集中在面后，摄像头与短期复盘媒体均默认关闭。原04教学模式取消，旧路径保留[退出说明](../modules/04-guided-practice.md)。代码与测试目录目前仍为空骨架，文档中的接口不是可调用服务。
