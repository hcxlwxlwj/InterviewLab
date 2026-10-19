# 个人工作区与岗位知识库实现

日期：2026-10-19。此文记录第二轮功能扩展，首轮视觉与验证记录继续保留在[实现说明](implementation.md)。

## 当前能力

- `/me` 为概览，左侧进入 `/me/resumes`、`/me/interviews`、`/me/saved-jobs`、`/me/preferences`。旧 `?tab=records|resumes|preferences` 自动转到对应入口。
- 文本简历支持新建、编辑、复制、重命名、默认、预览和删除；每份材料有独立经历及确认状态。复制生成新的简历和经历 ID，保存检查版本。PDF/DOCX 上传、解析和下载尚未接入。
- 目标岗位分为收藏的模板与个人 JD。可维护企业、原文、来源链接、备注和常用简历；模板复制后须显式保存，不写回公共内容。
- `/jobs` 支持岗位/技能搜索、九类方向、实习/校招筛选和收藏；36 个详情展示通用 JD、主题、平台整理题与来源。
- 配置支持模板或个人 JD，校验岗位、材料版本与关联。未知/撤回模板不能退回前端题目。产品和设计岗位不启用代码考核。
- 面试保存所用模板、JD、简历、经历、题目和来源快照；重练沿用原题与原材料。面试中不展示观察要点，结束后报告可展开通用准备要点；它们不是针对回答的自动评价。

个人数据为 `interviewlab-demo-v2` 的版本化 sessionStorage。首次迁移 v1 保留原记录、简历和偏好，恢复仍有效的样例经历关联，不恢复已删简历。重置同时清除旧状态、作答与代码草稿。存储失败后保留最新内存修改，提示临时保存，不伪称持久化成功。

## 公共内容与服务边界

内容见[岗位内容库](../../algorithm/content/README.md)：36 个当前模板、288 道主问题、288 条追问、72 个来源记录。模板 v2 将首稿中的通用 JD 句式改成具体岗位职责、基础要求与加分项；当前不是企业认证题库，也未经过专业评分校准。

公共岗位数据与用户合成示例分别标注 API 模式：`curated-public-content` 与 `synthetic-fixture`。岗位列表支持 search/category/stage/limit/cursor，默认每页20条；详情及来源只提供已发布模板。游标为当前过滤结果的偏移串，不是长期数据同步凭据。

新增分类、模板详情、来源、收藏及文本简历请求合同。真实写入仍返回 501 / capability_unavailable；新建 JD、收藏及文本简历 JSON 请求经过校验。没有真实认证，公开空列表不代表读取了某个真实用户的数据。

`localKnowledgeRetriever` 按岗位、阶段、主题、难度读取已发布内容。匹配不足返回空集合，不伪造引用或切换岗位。当前不连接向量数据库、模型或管理后台。后续私有持久化需替换数据客户端并建立服务端身份校验，不能把浏览器存储当数据库。

## 设计与验证

参考稿及精确提示词见[生图记录](extension-prompts.md)，使用内置 imagegen。沿用暖黄、浅橙与浅青；正文16px、辅助内容14–15px。没有引入图中的公司、薪资、头像、打卡或增长曲线。个人中心采用材料列表与记录表格，岗位库采用分类列表，详情以正文阅读为主。

自动检查覆盖岗位取题、内容完整性与来源、发布过滤、分页、版本迁移、复制、默认删除、收藏关联、JD版本、快照、容量不足及既有会话/评分空值规则。执行命令：

```powershell
npm run typecheck
npm run content:check
npm test
npm run build
python .github/scripts/check_repository.py
git diff --check
```

浏览器使用合成材料验证：创建和复制两份简历、编辑经历并确认、刷新恢复、收藏模板、复制为个人 JD、绑定简历、携带配置、切换简历清除旧选择、产品岗问答、暂停/跳过/结束、报告、单题重练与并列原文。另验证重命名与默认切换、收藏备注、无结果状态、未知岗位禁止开始、旧Tab跳转、Escape关闭和焦点恢复。重置与存储容量不足使用隔离单元状态验证，未清除用户原有标签页数据。

34项单元/接口测试、类型检查、内容校验、生产构建、仓库文档检查及diff空白检查通过。九个主要页面在1440、1024、390px下检查无页面级横向溢出；手机概览的表格已约束在滚动容器内。视口会扣除滚动条宽度，实际测量见[布局检查数据](screenshots/layout-audit-v3.json)。

| 页面 | 桌面 | 手机 |
| --- | --- | --- |
| 个人概览 | [截图](screenshots/personal-center-desktop-v3.jpg) | [截图](screenshots/personal-center-mobile-v3.jpg) |
| 简历库 | [截图](screenshots/resumes-desktop-v3.jpg) | [截图](screenshots/resumes-mobile-v3.jpg) |
| 简历编辑 | [截图](screenshots/resume-editor-desktop-v3.jpg) | [截图](screenshots/resume-editor-mobile-v3.jpg) |
| 岗位库 | [截图](screenshots/jobs-desktop-v3.jpg) | [截图](screenshots/jobs-mobile-v3.jpg) |
| 岗位详情 | [截图](screenshots/job-detail-desktop-v3.jpg) | [截图](screenshots/job-detail-mobile-v3.jpg) |
| 目标岗位 | [截图](screenshots/saved-jobs-desktop-v3.jpg) | [截图](screenshots/saved-jobs-mobile-v3.jpg) |
| 面试记录 | [截图](screenshots/interviews-desktop-v3.jpg) | [截图](screenshots/interviews-mobile-v3.jpg) |
| 配置联动 | [截图](screenshots/setup-desktop-v3.jpg) | [截图](screenshots/setup-mobile-v3.jpg) |
| 报告 | [截图](screenshots/report-desktop-v3.jpg) | [截图](screenshots/report-mobile-v3.jpg) |

本轮没有验证真实身份、云端持久化、向量检索或Agent学习效果。新增测试材料保留在当前标签页便于评审，原默认简历已恢复；历史记录名称按当时快照展示。

真实身份、云端文件、数据库、专业评分、实时语音、代码执行和后台审核发布仍未接入。
