# 软件设计

更新：2026-10-25。这里只维护架构、数据、接口、工程边界和原型；功能行为及验收分别维护在 requirements 的[功能规格](../requirements/functional_spec.md)与[用户故事](../requirements/user_stories.md)。

| 正文 | 内容 |
| --- | --- |
| [系统架构](architecture.md) | 当前 Next.js 原型与独立 Fastify 目标、六模块、API/worker、事务及四阶段 |
| [账号与访问管理](account-management.md) | 注册登录、页面弹窗、真实数据隔离、配置与验收限制 |
| [数据与接口](data_and_interfaces.md) | 新 HTTP/实时合同、旧路径迁移、数据归属、版本/任务、权限和删除 |
| [真实文字面试接入](interview-agent-implementation.md) | ecnu-plus 配置、Agent/知识接口、面试/报告/重练、可靠性与验收边界 |
| [工程目录](repository_structure.md) | 课程目录、代码职责、依赖与后续接入位置 |
| [原型设计](prototype/README.md) | 页面、交互和状态 |
| [首轮实现记录](prototype/implementation.md) | 设计参考、本地运行和阶段截图 |
| [个人中心/岗位库扩展](prototype/library-expansion.md) | 后续页面、1000 个岗位内容及原型验证 |

当前公开岗位、独立后端和真实文字面试/报告/重练均可运行，ecnu-plus 真实效果需密钥配置后单独验收。其他规划业务不表示已实现，详见文字面试接入。成员从[后端 README](../../code/backend/README.md)开始接入。原 modules 文档已按性质并入需求、算法及本目录接口合同，不另保留副本。
