# 公开内容适配

唯一公开子入口为 `@interviewlab/backend/content`。index.ts 读取已发布岗位、来源、原创问题及专业资料，领域核心接收显式数据。私有简历和回答不通过该入口导出。

旧演示数据及 content/demo 子入口已删除。运行 npm run content:check 验证 1000 岗位与 8000 原创问题。全岗位向量检索和嵌入位于 modules/knowledge；数据版本、审核及覆盖边界见[内容说明](../../../../docs/algorithm/content/README.md)。
