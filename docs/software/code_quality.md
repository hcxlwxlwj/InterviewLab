# 代码质量记录

## 已有检查

仓库 CI 已运行模块依赖检查、TypeScript 检查、内容校验、单元与集成测试、前后端构建，并用独立 PostgreSQL 执行数据库、进程和代理测试。与本次同步基线文件内容一致的提交 `bb545a3` 对应的 PR 检查成功。[工作流](../../.github/workflows/repository-check.yml) · [实际运行记录](https://github.com/hcxlwxlwj/InterviewLab/actions/runs/42815967950)

## 覆盖率基线

2026-11-16，在同步后的 `f10d7e1` 上以普通测试采样，286 项全部通过。

```sh
node --import tsx --test --experimental-test-coverage --test-coverage-include="code/**/*.ts" --test-coverage-include="code/**/*.tsx" "tests/unit/*.test.ts" "tests/integration/*.test.ts"
```

| 范围 | 行覆盖 |
| --- | ---: |
| 本次纳入统计的文件 | 71.65% |
| 面试服务 | 25.26% |
| 面试准备 | 30.67% |
| 动态出题 | 95.27% |
| 语音会话 | 92.28% |
| 报告服务 | 26.64% |
| 报告聚合 | 99.69% |

采样未包含独立数据库、进程及浏览器代理测试。已存在的数据库用例覆盖准备、状态推进和报告失败恢复，详见[测试用例索引](../../tests/README.md#核心用例索引)。课件要求核心逻辑至少 60%，仍需以包含独立数据库回归的核心模块范围重新统计。

## 待验证

课件第 174 页要求静态扫描基线、问题和异味数量、圈复杂度、重复率及修复前后对比。当前工作流未配置该类扫描，本次也没有扫描或重构结果。面试推进与报告分析可作为首轮检查范围，具体修复点由扫描结果与代码复核确定。
