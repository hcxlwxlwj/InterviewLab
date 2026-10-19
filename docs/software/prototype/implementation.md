# 首轮高保真原型与工程骨架

日期：2026-10-19。当前为本地交互演示，真实产品规格仍见[六界面说明](README.md)及[数据合同](../data_and_interfaces.md)。

本页保留首轮实现与验证记录。个人中心、多简历、岗位库和内容维护的后续实现见[扩展记录](library-expansion.md)，不再以本页首轮三分区为当前个人中心结构。

## 已实现与未接入

五个主页面与嵌入代码工作区已建立：产品首页、面试配置、双栏面试、报告、个人中心。文字演示可完成配置、预设问题与追问、暂停、跳过、结束、逐题回看、单题重练及原新回答对照。个人中心提供筛选、简历样例预览与命名、默认选择、偏好和演示重置。

- 用户作答只用于流程演示，不自动生成专业评分或能力提升结论。81 分等固定评分仅属于标注的合成示例。
- 默认目标配置为语音；当前开始按钮明确切换到 `text_fallback`，所有实际回合如实记录文字输入。无任何设备权限申请或音视频采集。
- 代码区支持 C++、Python、Java 高亮、独立草稿和演示提交；运行只返回未接入说明，没有编译、测试通过或静态评审结果。
- 没有真实身份、数据库、LLM、ASR、TTS、镜头观测、真实简历上传/下载、代码执行、PDF 导出及后台任务服务。
- 所有记录使用版本化 `sessionStorage`，限同源同标签页，刷新恢复、关闭标签页后清除；不可作为私有持久化或鉴权方案。存储不可用时说明仅临时保留。
- 重置清除新增会话、偏好、作答与代码草稿，恢复初始样例。删除会话同时移除对应草稿并解除重练来源关联。

## 运行与结构

在仓库根目录使用 Node.js 24 / npm 11：

```powershell
npm ci
npm run dev
```

浏览 [http://127.0.0.1:3000](http://127.0.0.1:3000)，使用同一标签页完成体验。不要在运行开发服务时对同一目录执行生产构建；检查生产模式时先停止开发服务，再 `npm run build`、`npm start`。

| 工作区 | 职责 |
| --- | --- |
| `@interviewlab/web` | Next.js 16.4.2 / React 19.3.1 页面、Tailwind 4 主题、shadcn 风格 Button、Radix Dialog、CodeMirror、演示客户端 |
| `@interviewlab/backend` | Web Request/Response 路由分发、Zod 会话校验、服务与认证边界、合成接口、统一错误 |
| `@interviewlab/core` | DTO、确定性会话规则、四维评分空值策略、供应商/存储适配接口及合成样例 |

`/api/v1/health` 列出骨架能力和接口目录。可读取岗位模板、简历样例、经历、偏好、记录和 `sample-interview` 会话/报告；所有响应标注 `X-InterviewLab-Mode: synthetic-fixture` 并禁用缓存。非合成资源返回 404，同源业务写入返回 501 / `capability_unavailable`，跨源或无 Origin 写入返回 403。真实服务未接入，不能据此宣称私有资源权限验收已完成。

前端演示通过统一 `DataClient` 与 `DemoState` 保存，不直接调用尚未实现的业务写入 API。后续接入真实服务时替换适配器并建立验证身份，不能把浏览器提供的 owner 当作身份。

## 视觉与生成素材

用户最终选择暖黄与浅橙作为主视觉，替换了前一版深蓝主色计划。实际采用：淡黄/奶油白页面、白色内容、浅橙主要按钮、浅青辅助选中态，深蓝仅用于文字和图标。主要按钮深色文字对浅橙背景约 5.6:1；辅助文字经过加深，图标与状态不只依赖颜色。

主模块始终以原规格为准。没有从生成图引入课程、订阅、排行榜、连续打卡、推荐岗位或真实语音评分；图中的录音、上传等只作视觉参考，未实现能力不作为可用功能展示。

使用内置 imagegen 生成，未使用 CLI/API 密钥。每个主页面动手前已有对应参考图；提示词集见[生成提示词](design-prompts.md)。用户参考截图未复制进仓库。

| 素材 | 文件 | 用途 |
| --- | --- | --- |
| 首页参考 | [home.png](references/home.png) | 暖黄主视觉、浅橙按钮、横向导航与岗位入口 |
| 配置参考 | [setup.png](references/setup.png) | 分区表单与右侧摘要 |
| 面试与代码参考 | [interview.png](references/interview.png) | 双栏布局、作答区和嵌入代码区 |
| 报告参考 | [report.png](references/report.png) | 原文依据、四维及未观察状态 |
| 个人中心参考 | [personal-center.png](references/personal-center.png) | 记录表格与简历/偏好分区 |
| 首页插画 | [study-desk.png](../../../code/frontend/public/images/study-desk.png) | 仅首页使用的无字书桌插画；不把整张界面生图作为网页截图背景 |

### 第二轮视觉优化

用户指出首版辅助小字过多、字体不一致，以及首页插画缩在圆角卡片中，与参考稿的大图构图不同。本轮保留全部功能模块，调整如下：

- 首屏改为横向铺满的场景图，不再把图片放入单独小卡片；电脑屏幕用 HTML 展示现有面试界面的静态预览。新版背景为 [interview-hero-wide.png](../../../code/frontend/public/images/interview-hero-wide.png)，旧版插画保留但已不再引用。
- 删除首页重复的眉题、勾选标签和引导语，移除配置分区中重复解释标题的句子，报告评分说明改为可展开内容；没有删除评分范围或演示标记。
- 正文与作答输入采用 16px，表单标题 17px，辅助内容通常 14–15px；不再用 8–12px 承载主要说明。大屏首页标题约 61px。
- 使用本地的 [interviewlab-sans.woff2](../../../code/frontend/public/fonts/interviewlab-sans.woff2)，基于 [Google Fonts 官方 Noto Sans SC](https://github.com/google/fonts/tree/main/ofl/notosanssc) 制作包含常用简体中文和界面字符的变量字体子集，字体族已改名。许可见 [OFL.txt](../../../code/frontend/public/fonts/OFL.txt)。运行时不向字体 CDN 请求；罕见字符使用系统后备字体。
- 手机页面保留完整字号，面试控制条保持在顶部；检查 390px 和 1024px 下的页面级溢出。

新版实测截图：[首页桌面](screenshots/home-desktop-v2.jpg)、[首页手机](screenshots/home-mobile-v2.jpg)、[配置](screenshots/setup-desktop-v2.jpg)、[报告](screenshots/report-desktop-v2.jpg)、[个人中心](screenshots/personal-center-desktop-v2.jpg)。旧截图保留，用于比较此次调整。

网站信息组织参考[面试鸭作者公开页面](https://www.cnblogs.com/yupi/p/18360765)，会话与复盘布局参考用户提供的截图，并补充查看 [Teal](https://www.tealhq.com/tools/ai-interview-practice) 与 [Linear](https://linear.app/docs/my-issues)。未复制这些网站的标识或素材。

## 验证记录

- TypeScript 类型检查、23 项单元/接口测试及 Next.js 生产构建通过；CI 新增同样的应用检查。
- 测试覆盖：主问题与追问预算、空回答/跳过、幂等提交、暂停计时与 12 分钟硬上限、终态、报告独立生成、未观察维度/零回答、合成引用定位、材料过滤、默认简历删除、偏好快照、重练来源删除、草稿重置、损坏存储与未接入 API。
- 使用浏览器真实点击验证：配置进入面试、简历切换清空旧经历、暂停禁用作答、刷新保留草稿并提交、代码草稿记录、结束时提交未保存回答、报告不伪评分、重练及原新回答对照、个人中心命名/偏好与刷新、筛选空态、无简历、零回答、报告失败预览及重试。
- 检查 1440px 桌面、1024px 平板及 390px 手机布局；各主页面无页面级横向溢出。手机记录表格在容器内横向滚动。手机报告依次展示评分摘要、逐题内容、独立表达观测。
- 上述验证是确定性交互和骨架验证，不是实时语音、供应商、真实性、隐私生产部署或学习效果评测。

实测截图使用合成输入：

| 页面 | 桌面 | 手机 |
| --- | --- | --- |
| 首页 | [桌面](screenshots/home-desktop.jpg) | [手机](screenshots/home-mobile.jpg) |
| 配置 | [桌面](screenshots/setup-desktop.jpg) | [手机](screenshots/setup-mobile.jpg) |
| 面试 | [桌面](screenshots/interview-desktop.jpg) | [手机](screenshots/interview-mobile.jpg) |
| 报告 | [桌面](screenshots/report-desktop.jpg) | [手机](screenshots/report-mobile.jpg) |
| 个人中心 | [桌面](screenshots/personal-center-desktop.jpg) | [手机](screenshots/personal-center-mobile.jpg) |
| 代码 / 重练 | [代码](screenshots/code-desktop.jpg) | [回答对照](screenshots/comparison-desktop.jpg) |

源码已按职责拆分，当前位置见[工程目录与职责](../repository_structure.md)；本页保留首轮实现记录。
