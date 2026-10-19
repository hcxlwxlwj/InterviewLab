# 软件设计

更新：2026-10-19。这里只维护架构、数据、接口、工程边界和原型；功能行为及验收分别维护在 requirements 的[功能规格](../requirements/functional_spec.md)与[用户故事](../requirements/user_stories.md)。

| 正文 | 内容 |
| --- | --- |
| [系统架构](architecture.md) | 当前 Next.js 原型与独立 Fastify 目标、六模块、API/worker、事务及四阶段 |
| [数据与接口](data_and_interfaces.md) | 新 HTTP/实时合同、旧路径迁移、数据归属、版本/任务、权限和删除 |
| [工程目录](repository_structure.md) | 课程目录、代码职责、依赖与后续接入位置 |
| [原型设计](prototype/README.md) | 页面、交互和状态 |
| [首轮实现记录](prototype/implementation.md) | 设计参考、本地运行和阶段截图 |
| [个人中心/岗位库扩展](prototype/library-expansion.md) | 后续页面、36 个岗位内容及原型验证 |

当前文字原型可运行，真实服务尚未接入；本轮只修改设计文档，未生成 OpenAPI 或迁移代码。目标架构与接口清单不表示全部业务能力已实现。原 modules 文档已按性质并入需求、算法及本目录接口合同，不另保留副本。
