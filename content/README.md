# 岗位与面试内容库

更新：2026-10-19。当前36个模板（v2）、288道平台整理主问题、每题1条追问、72条来源记录。当前是面向实习/校招的准备资料，不是实时招聘职位库、企业真题认证或经专家校准的评分标准。

## 文件与维护

- `jobs.json`：当前模板、职责/基础/加分项、6–10个主题、8道主问题及观察要点。当前版本覆盖36个方向，分类可以扩展。
- `categories.json`：方向注册表。兼容旧frontend/backend/algorithm/testing；岗位ID稳定，标题可改，不能让未知ID默认进入前端。
- `sources.json`：招聘或官方资料的URL、用途、可访问性、获取与核对日期。usage=reference_only；保留链接，不镜像整篇文章或复制企业JD全文。
- `research/sources-2026-10-19.json`：检索词、初选路径和核对记录。聚合页含无关职位，只有相关职责用于原创归纳；search_index表示只能读取检索摘要，不能声称查阅了全文。
- `archive/`：已用过的模板与来源首稿留档，默认检索不会读取。

开发模式通过 `npm run dev` 预览内容变化。生产模式下内容随构建打包，修改后需停止当前服务、执行 `npm run build` 并重新 `npm start`，不能把改动JSON说成实时发布。

运行 `npm run content:check` 检查ID、主题/问题数量、来源引用、发布字段与复核期限，并列出到期项。检查只验证结构，不能替代事实与专业内容审核。

维护顺序：登记资料与适用阶段 → 创建draft → 编辑原创JD和问题 → 核对来源/边界并转reviewed → 检查通过后发布published。未通过的条目保持草稿；撤回改retired。已发布正文不原地改写：先保留archive并增加version，审核后更新当前模板。通过代码评审记录编辑者、审核者和修改原因；本轮没有真实后台、审核身份或自动发布服务，source_crosscheck_not_expert_calibration仅表示本轮资料交叉核对。

AI类及AI产品每30天复核，其他每90天复核。过期项列入维护清单，不自动伪装成最近更新。搜索引擎抓取时间与我们核对日期不同；原页面可能变动，不保证仍在招。实习与校招职责从相关条目和基础知识归纳，不把社招年限、特定学历或大厂系统规模改成学生通用门槛。

## 检索与Agent接入

本地KnowledgeRetriever按岗位、阶段、主题、难度过滤published内容，返回来源与版本；不足返回空集合。未来可换成PostgreSQL/pgvector实现。发布/撤回只影响新会话，历史面试和重练使用已冻结的模板、个人JD、材料、题目与来源。知识正文一律是资料，不能提供工具权限或覆盖系统指令。

来源用于岗位需求与知识主题参考。问题、追问、观察要点均为平台编写，观察要点是准备和内容审阅方向，不是完整标准答案，也不是对用户回答的自动评分。后续接Agent前应安排专业人员复核与回归样例，特别是产品、设计等非代码岗位；不直接套用代码评分标准。

个人简历、企业JD和回答只存在个人数据客户端，不写回公共内容。当前API提供公共只读内容与写入骨架，管理后台、认证、数据库、嵌入及模型均未接入。

## 来源索引

每行链接对应当前模板的岗位参考与官方主题参考；详情页保留同样的可追溯入口。

| 岗位 | 招聘参考 | 官方知识参考 | 下次复核 |
| --- | --- | --- | --- |
| 前端开发工程师 | [BOSS直聘](https://www.zhipin.com/zhaopin/e0f6df2d28fa0d091HJ82t66GA~~/) | [developer.mozilla.org](https://developer.mozilla.org/zh-CN/docs/Learn_web_development) | 2027-01-17 |
| Java 后端工程师 | [BOSS直聘](https://www.zhipin.com/zhaopin/a05a8f15280defa31HN-0tm-/) | [docs.spring.io](https://docs.spring.io/spring-framework/reference/data-access/transaction.html) | 2027-01-17 |
| Python 后端工程师 | [BOSS直聘](https://www.zhipin.com/zhaopin/ffb764c03bfae13c1nJy29m_GQ~~/) | [docs.python.org](https://docs.python.org/3/library/asyncio.html) | 2027-01-17 |
| Go 后端工程师 | [BOSS直聘](https://www.zhipin.com/zhaopin/39481b897da2f3790nd93N-0GQ~~/) | [go.dev](https://go.dev/doc/effective_go) | 2027-01-17 |
| C++ 开发工程师 | [BOSS直聘](https://m.zhipin.com/zhaopin/e29b1014a65beaf303R82tS-GA~~/) | [isocpp.github.io](https://isocpp.github.io/CppCoreGuidelines/CppCoreGuidelines) | 2027-01-17 |
| 全栈开发工程师 | [BOSS直聘](https://www.zhipin.com/zhaopin/b72358bed4e5aed33n1-290~/) | [developer.mozilla.org](https://developer.mozilla.org/en-US/docs/Learn_web_development/Extensions/Server-side/First_steps) | 2027-01-17 |
| Android 开发工程师 | [BOSS直聘](https://www.zhipin.com/zhaopin/4f578d09f58dd6220nV-39W6EQ~~/) | [developer.android.com](https://developer.android.com/guide/components/activities/activity-lifecycle) | 2027-01-17 |
| iOS 开发工程师 | [BOSS直聘](https://www.zhipin.com/zhaopin/7b651b3711b8aa4403B529i5/) | [docs.swift.org](https://docs.swift.org/swift-book/documentation/the-swift-programming-language/automaticreferencecounting/) | 2027-01-17 |
| 大模型应用工程师（RAG / Agent） | [BOSS直聘](https://m.zhipin.com/zhaopin/e820fb028e56ea1f1nV-0tW5Fw~~/) | [docs.langchain.com](https://docs.langchain.com/oss/python/langchain/retrieval) | 2026-11-18 |
| 大模型训练与微调工程师 | [BOSS直聘](https://www.zhipin.com/zhaopin/4ec5411eac795e171nB72Nm_EQ~~/) | [huggingface.co](https://huggingface.co/docs/peft/conceptual_guides/lora) | 2026-11-18 |
| 机器学习工程师 | [BOSS直聘](https://www.zhipin.com/zhaopin/e60719cfe87014641nd-2925Eg~~/) | [scikit-learn.org](https://scikit-learn.org/stable/common_pitfalls.html) | 2026-11-18 |
| NLP 算法工程师 | [BOSS直聘](https://www.zhipin.com/zhaopin/f081cbbd3e0a6a4303J-0t-_/) | [huggingface.co](https://huggingface.co/docs/transformers/tasks/token_classification) | 2026-11-18 |
| 计算机视觉工程师 | [BOSS直聘](https://www.zhipin.com/zhaopin/ab3bd10fa33d145b1nN-3du9Fg~~/) | [docs.pytorch.org](https://docs.pytorch.org/tutorials/intermediate/torchvision_tutorial.html) | 2026-11-18 |
| 语音算法工程师 | [BOSS直聘](https://m.zhipin.com/zhaopin/9cdbc8c12d37b6d633Z40t-0/) | [huggingface.co](https://huggingface.co/docs/transformers/tasks/asr) | 2026-11-18 |
| 搜索推荐算法工程师 | [BOSS直聘](https://www.zhipin.com/zhaopin/4bafe80faa937cf333Zz09m-/) | [www.tensorflow.org](https://www.tensorflow.org/recommenders/examples/basic_retrieval) | 2026-11-18 |
| AI Infra 工程师 | [BOSS直聘](https://m.zhipin.com/zhaopin/fa952394dc0eaae83nBz3N67/) | [docs.nvidia.com](https://docs.nvidia.com/deeplearning/triton-inference-server/user-guide/docs/user_guide/model_configuration.html) | 2026-11-18 |
| 数据分析师 | [BOSS直聘](https://www.zhipin.com/zhaopin/e5633341db1458c01nFz3d68Fg~~/) | [pandas.pydata.org](https://pandas.pydata.org/docs/user_guide/groupby.html) | 2027-01-17 |
| 数据开发工程师 | [BOSS直聘](https://www.zhipin.com/zhaopin/b6948a2fa2c7263a1nd909y4Fg~~/) | [spark.apache.org](https://spark.apache.org/docs/latest/structured-streaming-programming-guide.html) | 2027-01-17 |
| 数据仓库工程师 | [BOSS直聘](https://www.zhipin.com/zhaopin/b6948a2fa2c7263a1nd909y4Fg~~/) | [hive.apache.org](https://hive.apache.org/docs/latest/language/languagemanual-ddl/) | 2027-01-17 |
| 数据库工程师 | [BOSS直聘](https://www.zhipin.com/zhaopin/ec7f128da920e8131nB_2NS-GQ~~/) | [www.postgresql.org](https://www.postgresql.org/docs/current/transaction-iso.html) | 2027-01-17 |
| 软件测试工程师 | [BOSS直聘](https://m.zhipin.com/zhaopin/fb8dead2d86c9c8a1n1-3tu7FA~~/) | [playwright.dev](https://playwright.dev/docs/test-assertions) | 2027-01-17 |
| 测试开发工程师 | [BOSS直聘](https://www.zhipin.com/zhaopin/4651a219fdd8cd3b1Xdy3NS8/) | [playwright.dev](https://playwright.dev/docs/best-practices) | 2027-01-17 |
| 云原生 / DevOps 工程师 | [BOSS直聘](https://www.zhipin.com/zhaopin/5ed758a30c309d920Hd939q7/) | [kubernetes.io](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/) | 2027-01-17 |
| 运维 / SRE 工程师 | [BOSS直聘](https://m.zhipin.com/zhaopin/e5ffd61c6db06f8b3nR42tW7/) | [sre.google](https://sre.google/sre-book/service-level-objectives/) | 2027-01-17 |
| 网络工程师 | [BOSS直聘](https://www.zhipin.com/zhaopin/e1215bf9bb31c3ef0HR_2d-1/) | [www.rfc-editor.org](https://www.rfc-editor.org/rfc/rfc9293.html) | 2027-01-17 |
| 网络安全工程师 | [BOSS直聘](https://m.zhipin.com/zhaopin/28d3ee9c38c8b2af3nZ42Nu8/) | [owasp.org](https://owasp.org/www-project-web-security-testing-guide/) | 2027-01-17 |
| 嵌入式软件工程师 | [BOSS直聘](https://www.zhipin.com/zhaopin/98562c99e8b753551nJ63925Fw~~/) | [docs.zephyrproject.org](https://docs.zephyrproject.org/latest/kernel/services/interrupts.html) | 2027-01-17 |
| 机器人软件工程师 | [BOSS直聘](https://www.zhipin.com/zhaopin/ed396bc91a423bb01HJy0ti_EA~~/) | [design.ros2.org](https://design.ros2.org/articles/qos.html) | 2027-01-17 |
| 游戏客户端工程师 | [BOSS直聘](https://www.zhipin.com/zhaopin/4829d0cfc46f7a370HN439y_/) | [docs.unity3d.com](https://docs.unity3d.com/Manual/ExecutionOrder.html) | 2027-01-17 |
| 游戏服务端工程师 | [BOSS直聘](https://www.zhipin.com/zhaopin/bf3c608a2586bf8f1nB-2di7EA~~/) | [heroiclabs.com](https://heroiclabs.com/docs/nakama/concepts/multiplayer/authoritative/) | 2027-01-17 |
| 产品经理 | [BOSS直聘](https://www.zhipin.com/zhaopin/37fcb696df3d4c8d0nZ93Nm5Eg~~/) | [www.atlassian.com](https://www.atlassian.com/agile/product-management/requirements) | 2027-01-17 |
| AI 产品经理 | [BOSS直聘](https://www.zhipin.com/zhaopin/0e5920648e2c95dc33Fz3Nq-/) | [Microsoft Research](https://www.microsoft.com/en-us/research/publication/guidelines-for-human-ai-interaction/) | 2026-11-18 |
| 数据产品经理 | [BOSS直聘](https://m.zhipin.com/zhaopin/81db6ac845cdcca20nB80tW0Eg~~/) | [learn.microsoft.com](https://learn.microsoft.com/en-us/purview/concept-data-products) | 2027-01-17 |
| 平台 / B 端产品经理 | [BOSS直聘](https://www.zhipin.com/zhaopin/125848c881ce00be1nZ93t-7EA~~/) | [backstage.io](https://backstage.io/docs/features/software-catalog/) | 2027-01-17 |
| 交互 / UX 设计师 | [BOSS直聘](https://www.zhipin.com/zhaopin/d99b774e573555e81XNz29m9/) | [W3C](https://www.w3.org/WAI/fundamentals/accessibility-usability-inclusion/) | 2027-01-17 |
| 解决方案工程师 | [BOSS直聘](https://m.zhipin.com/zhaopin/cebcab3c0156b08d031y2du5FQ~~/) | [docs.aws.amazon.com](https://docs.aws.amazon.com/wellarchitected/latest/framework/welcome.html) | 2027-01-17 |
