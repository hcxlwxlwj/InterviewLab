import { config as dotenv } from 'dotenv';
import { mkdir, writeFile } from 'node:fs/promises';
import { loadConfig } from '../../code/backend/src/foundation/config';
import {
  createKnowledgeService,
  readKnowledgeSeed,
} from '../../code/backend/src/modules/knowledge/service';
async function main() {
  dotenv({ quiet: true });
  const service = createKnowledgeService(loadConfig({ ...process.env, KNOWLEDGE_PREVIEW: 'true' }));
  const seed = await readKnowledgeSeed();
  const results: object[] = [];
  const positives = [
    ['多个组件共享表单值，状态应该放在哪里', '重复保存同一数据怎么避免不同步'],
    ['提交表单失败后保留用户输入', '重复点击保存时如何显示提交状态'],
    ['计算出来的值需要额外放到状态里吗', '状态字段互相矛盾要如何组织'],
    ['useEffect 为什么要写依赖和清理', '组件和外部系统同步的生命周期'],
    ['搜索请求先发后返回覆盖新结果', '切换条件后怎么忽略旧请求'],
    ['AbortController 取消后还更新页面', '页面卸载时如何处理尚未完成请求'],
    ['Fetch 遇到 HTTP 404 会直接抛异常吗', '请求失败与网络断开怎么区分'],
    ['SSE 响应被拆成半条消息怎么处理', '流式中文跨片段字节如何解码'],
    ['异步回调为什么拿到旧的变量', 'JavaScript 闭包和词法环境'],
    ['Promise 并行请求异常如何传播', 'async await 的依赖顺序和清理'],
    ['缓存后请求减少如何证明页面变快', '用户等待时间测量需要控制哪些条件'],
    ['模态弹窗键盘焦点如何恢复', 'dialog 的可访问名称和键盘操作'],
    ['如何证明一个功能解决用户需求', '用户想完成的任务和功能列表的区别'],
    ['项目截止前如何选择优先做的需求', '人手有限时如何比较方案取舍'],
    ['请求次数下降不等于任务完成更快', '如何定义与用户结果相关的指标'],
    ['用原型和访谈验证需求假设', '需求变化后怎样验证和调整方案'],
    ['为什么选择前端岗位，有哪些实际探索', '还在探索方向时如何表达岗位动机'],
    ['小组分歧时自己具体采取什么行动', '团队成果里如何厘清本人的职责'],
    ['收到反馈后如何检查学习是否有变化', '从问题到改进再到验证的学习经历'],
    ['没有实习经历时面试如何换问题', '什么信息不足时应该标记为未观察'],
  ];
  const negatives = [
    ['明天天气和降雨概率', '红烧排骨食谱'],
    ['火星卫星轨道参数', '唐代诗词作者生平'],
    ['外汇期权定价交易', '晶体衍射布拉格定律'],
    ['观赏植物浇水频率', '芭蕾舞足尖动作'],
    ['海洋潮汐月球引力', '吉他弦乐调音技巧'],
  ].flat();
  try {
    for (let split = 0; split < 2; split++) {
      for (let i = 0; i < 20; i++) {
        const c = seed.cards[i],
          config = {
            job: 'frontend',
            career_stage: 'internship' as const,
            interview_type: c.types[0],
            difficulty: '基础' as const,
            duration_minutes: 5 as const,
            interviewer_style: '标准' as const,
            interaction_mode: 'text_fallback' as const,
          };
        const knowledge = await service.read(config);
        const result = await service.search(config, knowledge, c.goals, positives[i][split]);
        results.push({
          split: split ? 'test' : 'development',
          kind: 'positive',
          query: positives[i][split],
          expected: c.id,
          hit: result.chunks.some((x) => x.card_id === c.id),
          ids: result.chunks.map((x) => x.card_id),
        });
      }
      for (let i = 0; i < 10; i++) {
        const config = {
          job: 'frontend',
          career_stage: 'internship' as const,
          interview_type: 'mixed' as const,
          difficulty: '基础' as const,
          duration_minutes: 5 as const,
          interviewer_style: '标准' as const,
          interaction_mode: 'text_fallback' as const,
        };
        const knowledge = await service.read(config);
        const query = split ? negatives[i] + '的详细介绍' : negatives[i];
        const result = await service.search(
          config,
          knowledge,
          seed.competencies.map((x) => x.id),
          query,
        );
        results.push({
          split: split ? 'test' : 'development',
          kind: 'negative',
          query,
          hit: result.chunks.length === 0,
          ids: result.chunks.map((x) => x.card_id),
        });
      }
    }
    const values = results as { split: string; kind: string; hit: boolean }[];
    const summary = Object.fromEntries(
      ['development', 'test'].map((split) => [
        split,
        {
          positive_hits: values.filter((x) => x.split === split && x.kind === 'positive' && x.hit)
            .length,
          negative_empty: values.filter((x) => x.split === split && x.kind === 'negative' && x.hit)
            .length,
        },
      ]),
    );
    await mkdir('tests/artifacts', { recursive: true });
    await writeFile(
      'tests/artifacts/knowledge-results.json',
      JSON.stringify({ summary, results }, null, 2),
    );
    console.log(JSON.stringify(summary));
    if (summary.test.positive_hits < 18 || summary.test.negative_empty < 9) process.exitCode = 1;
  } finally {
    await service.close();
  }
}
main().catch(() => {
  console.error('Knowledge evaluation failed (private provider details suppressed)');
  process.exitCode = 1;
});
