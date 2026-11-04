/** Real-model comparison using synthetic materials only. Never reads a user's saved resume. */
import { config as dotenv } from 'dotenv';
import { mkdir, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { JOBS } from '../../code/backend/src/content/index';
import {
  emptyResumeTemplate,
  type InterviewSnapshot,
  type InterviewTurn,
} from '@interviewlab/core';
import { createAllRoleKnowledge } from '../../code/backend/src/modules/knowledge/all-roles';
import { loadConfig } from '../../code/backend/src/foundation/config';
import { createWorkflowModels } from '../../code/backend/src/modules/interviews/workflow-models';
import { createInterviewAgent } from '../../code/backend/src/modules/interviews/agent';
import { newInterviewState } from '../../code/backend/src/modules/interviews/repository';
import { ServiceError } from '../../code/backend/src/foundation/errors';

const scenarios: Record<string, [string, string, string, string]> = {
  software: [
    '我做了用于同学预约教室的系统，本人负责接口和冲突处理。',
    'Java和SQL',
    '我用数据库唯一约束避免同一时间段重复预约。',
    '我写了两个并发请求的测试，检查成功数和数据库记录。',
  ],
  ai: [
    '我做了用于课程文本分类的实验，本人负责数据划分和训练脚本。',
    'Python和机器学习基础',
    '我先划分训练集和测试集，只用训练集拟合文本处理。',
    '我比较验证集上的分类指标，并抽查错误样本。',
  ],
  data: [
    '我做了用于分析课程选课记录的作业，本人负责清洗数据和SQL查询。',
    'SQL和Python',
    '我先检查缺失值和重复记录，再按课程统计人数。',
    '我抽样对照原始记录，检查聚合后的总数是否一致。',
  ],
  quality: [
    '我做了课程报名网站的测试作业，本人负责设计测试用例。',
    '接口测试和测试设计',
    '我先覆盖正常报名，再检查重复提交和输入为空。',
    '我独立准备测试数据，并把错误请求和预期结果保存下来。',
  ],
  infra: [
    '我做了课程网站的容器部署练习，本人负责配置服务资源。',
    '容器和Linux基础',
    '我设置了资源请求和限制，并观察高负载时的运行状态。',
    '我记录了CPU和内存变化，再逐步调整配置。',
  ],
  embedded: [
    '我做了用于展示温度的课程设备，本人负责采样任务。',
    'C语言和嵌入式基础',
    '我将采样和显示分成不同任务，通过队列传递数据。',
    '我记录采样间隔，并检查显示较慢时是否丢失数据。',
  ],
  game: [
    '我做了用于课程展示的单机3D小游戏，本人负责角色移动和碰撞检测。',
    'C++和游戏引擎基础',
    '我区分检测到接触和实际移动后的响应，没有做多人同步。',
    '我检查斜向移动和边角位置，记录出现穿透的条件。',
  ],
  product: [
    '我做了用于改进校园活动报名流程的课程项目，本人负责需求访谈。',
    '需求分析和原型',
    '我访谈了三位同学，发现他们不清楚报名结果在哪里查看。',
    '我用原型让同学完成任务，观察他们能否找到结果。',
  ],
  design: [
    '我做了校园活动报名界面设计，本人负责交互原型。',
    '交互设计和可访问性基础',
    '我调整信息层级，并提供键盘可以操作的交互路径。',
    '我让同学尝试完成报名，记录卡住的位置并修改原型。',
  ],
};
async function main() {
  dotenv({ quiet: true });
  const config = loadConfig({
    NODE_ENV: 'test',
    LLM_API_KEY: process.env.LLM_API_KEY,
    LLM_BASE_URL: process.env.LLM_BASE_URL,
    LLM_MODEL: process.env.LLM_MODEL ?? 'ecnu-plus',
    LLM_OUTPUT_MODE: 'json_schema',
  });
  if (!config.LLM_API_KEY) throw new Error('Real model key required');
  const limit = Number(process.argv.find((a) => a.startsWith('--cases='))?.split('=')[1] ?? 18);
  const knowledge = createAllRoleKnowledge(config),
    models = createWorkflowModels(
      config,
      fetch,
      process.argv.includes('--debug') ? (e) => console.log(JSON.stringify(e)) : () => {},
    );
  const graph = createInterviewAgent(config, process.argv.includes('--debug') ? (e) => console.log(JSON.stringify(e)) : () => {});
  const cases = Object.entries(scenarios)
    .flatMap(([family, scenario]) => [0, 1].map((variant) => ({ family, scenario, variant })))
    .filter(
      (c) =>
        !process.argv.some((a) => a.startsWith('--family=')) ||
        c.family === process.argv.find((a) => a.startsWith('--family='))?.split('=')[1],
    )
    .filter(
      (c) =>
        !process.argv.some((a) => a.startsWith('--variant=')) ||
        c.variant === Number(process.argv.find((a) => a.startsWith('--variant='))?.split('=')[1]),
    )
    .slice(0, limit);
  const records: object[] = [];
  const artifact = `tests/artifacts/agent-workflow-live-${Date.now()}.json`;
  async function retry<T>(call: (repair: boolean) => Promise<T>) {
    try {
      return await call(false);
    } catch {
      return call(true);
    }
  }
  try {
    for (const item of cases) {
      const job = JOBS.find((j) => j.category_id === item.family)!;
      const material = {
        id: randomUUID(),
        version: 1,
        kind: 'resume' as const,
        title: '合成评测材料',
        confirmed: true,
        text: '',
        created_at: new Date().toISOString(),
        structure: {
          ...emptyResumeTemplate(),
          projects: item.variant ? '' : item.scenario[0],
          skills: item.scenario[1],
        },
      };
      const state = newInterviewState('synthetic-live', {
        job: job.id,
        career_stage: job.stages[0],
        interview_type: item.variant
          ? 'mixed'
          : item.family === 'product'
            ? 'business_scenario'
            : 'project_deep_dive',
        difficulty: '基础',
        duration_minutes: 10,
        interviewer_style: '标准',
        interaction_mode: 'text_fallback',
      });
      const started = performance.now();
      let analysis: import('@interviewlab/core').ResumeAnalysis,
        plan: import('@interviewlab/core').InterviewPreparationPlan;
      try {
        analysis = await retry((repair) =>
          models.analyze(material, new AbortController().signal, repair),
        );
        const k = await knowledge.read(state.view.configuration);
        plan = await retry((repair) =>
          models.prepare(
            state.view.configuration,
            k,
            analysis,
            new AbortController().signal,
            repair,
          ),
        );
        const prepareMs = performance.now() - started;
        for (const runtime of ['graph'] as const) {
          const interview = {
            ...state.view,
            turns: [] as InterviewTurn[],
            status: 'in_progress' as const,
            started_at: new Date().toISOString(),
          };
          const snapshot: InterviewSnapshot = {
            model: config.LLM_MODEL,
            job_title: job.title,
            knowledge: k,
            prompt_version: 'interview-graph-v1',
            rubric_version: 'evidence-uncalibrated-v1',
            runtime_version: 'graph-v1',
            resume_analysis: analysis,
            preparation_plan: plan,
          };
          const answers = item.variant
            ? [
                `我学过${item.scenario[1]}，目前没有相关项目。`,
                '我目前只做过基础练习，还没有做过完整系统。',
                '我会先看官方资料，再做一个小练习检查理解。',
              ]
            : [item.scenario[0], item.scenario[2], item.scenario[3]];
          let memory = null as import('@interviewlab/core').InterviewMemory | null;
          let question = '请介绍你的学习背景和相关经历。';
          for (let round = 0; round < 3; round++) {
            interview.turns.push({
              id: randomUUID(),
              text: question,
              topic: '经历',
              purpose: '了解本人行动',
              knowledge_question_id: null,
              source_refs: [],
              evidence_refs: [],
              main_question_index: round + 1,
              follow_up_index: 0,
              generation_id: randomUUID(),
              presented_at: null,
              answer_status: 'answered',
              answer_text: answers[round],
              revision: 1,
              input_mode: 'text_fallback',
              answered_at: new Date().toISOString(),
              stage: round === 0 ? 'introduction' : 'experience',
            });
            const begin = performance.now();
            let first: number | undefined;
            let attempts = 0;
            try {
              const result = await retry(async (repair) => {
                attempts++;
                return graph.advance(
                  interview,
                  snapshot,
                  false,
                  new AbortController().signal,
                  repair,
                  {
                    memory,
                    retrieval: {
                      release: k.content_version,
                      chunks: [],
                      mode: 'empty',
                      missing_reason: '此对照仅测模型与规划，向量检索另行评测',
                    },
                    preview: async (p) => {
                      if (p.text) first ??= performance.now() - begin;
                    },
                  },
                );
              });
              memory = result.memory ?? memory;
              question = result.question?.text ?? '';
              records.push({
                family: item.family,
                variant: item.variant,
                runtime,
                round,
                answer: answers[round],
                question,
                action: result.action,
                attempts,
                prepare_ms: prepareMs,
                first_ms: first ?? null,
                complete_ms: performance.now() - begin,
                semantic_review: null,
              });
              if (result.action === 'finish') break;
            } catch (error) {
              records.push({
                family: item.family,
                variant: item.variant,
                runtime,
                round,
                attempts,
                error: error instanceof ServiceError ? error.code : 'failed',
                complete_ms: performance.now() - begin,
              });
              break;
            }
          }
        }
      } catch (error) {
        records.push({
          family: item.family,
          variant: item.variant,
          stage: 'preparation',
          error: error instanceof ServiceError ? error.code : 'failed',
          error_type: error instanceof Error ? error.name : 'unknown',
          issues:
            typeof error === 'object' && error && 'issues' in error
              ? (error.issues as { path: unknown; code: string }[]).map((i) => ({
                  path: i.path,
                  code: i.code,
                }))
              : undefined,
        });
      }
      console.log(JSON.stringify({ family: item.family, variant: item.variant, completed: true }));
      await mkdir('tests/artifacts', { recursive: true });
      await writeFile(
        artifact,
        JSON.stringify(
          {
            limitations: '合成脚本固定回答；未测真实语音；独立人工审查待完成；此对照不包含向量检索',
            records,
          },
          null,
          2,
        ),
      );
    }
  } finally {
    await knowledge.close();
  }
  const quantile = (a: number[], q: number) =>
    a.length
      ? [...a].sort((a, b) => a - b)[Math.min(a.length - 1, Math.ceil(a.length * q) - 1)]
      : null;
  const summaries = ['graph'].map((runtime) => {
    const rows = records as { runtime?: string; error?: string; complete_ms?: number }[];
    const selected = rows.filter((r) => r.runtime === runtime);
    return {
      runtime,
      rounds: selected.length,
      failures: selected.filter((r) => r.error).length,
      p95_ms: quantile(
        selected.map((r) => r.complete_ms ?? 0),
        0.95,
      ),
    };
  });
  console.log(JSON.stringify({ artifact, summaries }));
  if (records.some((r) => 'error' in r)) process.exitCode = 1;
}
main().catch(() => {
  console.error('Synthetic live evaluation failed; private configuration suppressed');
  process.exitCode = 1;
});
