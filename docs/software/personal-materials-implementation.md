# 账号设置与简历经历：本次实现与验收边界

源码位置：accounts/settings.ts、resumes/service.ts、resumes/routes.ts、前端 materials-workspace.tsx。

## 已实现

- 沿用 Better Auth 身份、同源写入保护和统一 HTTP 客户端，无新增登录系统。
- GET/PUT /api/v1/me/settings：显示名（个人资料独立字段，不修改认证姓名）、简介、目标岗位、练习时长、默认简历指针。默认简历经 resumes 服务验证属于本人且最新版本已确认。
- GET/POST /api/v1/materials；PUT/DELETE /materials/:id；GET /materials/:id/versions。简历和经历分类保存，编辑追加不可变版本，以 expected_version 检测并发冲突。
- 私有读取及删除均检查 owner_id；不存在和他人资源均返回 404。
- 文本文件导入、人工编辑确认、历史只读查看、软删除。编辑正文自动取消确认；服务端允许用户显式确认。
- 新迁移 0005_personal_materials。不改既有迁移。

## 启动

在此项目根目录配置现有 .env（参考 .env.example），安装 Node.js 24 与 npm 后运行 npm ci、npm run db:migrate。分别启动 npm run dev:api 和 npm run dev，注册登录后访问 /me/resumes 与 /me/preferences。

## 必须说明的未完成项

当前是第一阶段实现，不代表截图全部需求已完成。尚未接入 PDF/DOCX 原始文件私有存储及解析、结构化经历候选提取、独立经历与简历关联选择、材料配额和分页。文本导入只保存文本内容，不保存原始文件。默认简历与练习偏好已可维护，但面试配置尚未消费它们；尚未实现 ResumesService.readConfirmed 适配到现有面试快照，因此不会声称面试已使用这些材料。个人中心仍沿用认证姓名，独立显示名用于设置资料。

新表目前以参数化 SQL 访问，尚需补 Drizzle schema 与快照后再运行 db:generate；不要把本次手写迁移视为已完成 ORM schema 同步。

## 验证状态

当前机器未找到 node/npm，未能执行 npm run check、npm run build:backend 或浏览器测试；数据库测试也未执行。提交前必须安装依赖并通过这些检查，使用独立 interviewlab_test 数据库执行 test:db。

人工验收：A 账号创建待确认简历→确认→设为默认→编辑产生 v2→检查 v1 保留；B 账号访问 A 的材料与版本应 404；同时用同一 expected_version 更新应一次成功一次 409；删除后列表与历史不可读，默认指针读取应归零。退出登录后所有私有接口应拒绝访问；缺少可信 Origin 的写请求应被公共保护拒绝。

## 本轮更新

注册密码改为 9–20 字符，旧账号登录兼容原长度。PDF/TXT 导入最大 5MB，PDF 最多 30 页；PDF 在内存中提取候选文字，原始文件不持久化，扫描 PDF 不提供 OCR。提取结果经用户核对后保存。依赖新增 pdf-parse 2.4.5。Docker 配置见 compose.personal.yaml，使用 .env.personal 提供随机认证密钥（禁止提交）。已验证实际 PDF 提取、材料版本及默认设置流程，类型检查和后端构建通过。
