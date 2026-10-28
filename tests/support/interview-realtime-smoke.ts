import { config as dotenv } from 'dotenv';
import { Pool } from 'pg';
import { mkdir, writeFile } from 'node:fs/promises';
import { loadConfig } from '../../code/backend/src/foundation/config';
import { createDatabase } from '../../code/backend/src/database/connection';
import { migrateDatabase } from '../../code/backend/src/database/migrate';
import { createInterviewRuntime } from '../../code/backend/src/modules/interview-runtime';
import { buildApp } from '../../code/backend/src/server/app';
import { startWorker } from '../../code/backend/src/tasks/worker';
import type { Interview, InterviewConfig } from '@interviewlab/core';
async function main() {
  dotenv({ quiet: true });
  const source = process.env.INTERVIEW_DEV_DATABASE_URL;
  if (!source) throw new Error('Local database configuration required');
  const url = new URL(source);
  url.pathname = '/interviewlab_test_realtime';
  const adminUrl = new URL(source);
  adminUrl.pathname = '/postgres';
  const admin = new Pool({ connectionString: adminUrl.toString() });
  try {
    const exists = await admin.query(
      "SELECT 1 FROM pg_database WHERE datname='interviewlab_test_realtime'",
    );
    if (!exists.rowCount) await admin.query('CREATE DATABASE interviewlab_test_realtime');
  } finally {
    await admin.end();
  }
  const config = loadConfig({
    ...process.env,
    NODE_ENV: 'test',
    DATABASE_URL: url.toString(),
    AUTH_ENABLED: 'false',
    PUBLIC_ORIGIN: 'http://127.0.0.1:33701',
    LOG_LEVEL: 'silent',
    KNOWLEDGE_PREVIEW: 'true',
  });
  const database = createDatabase(config);
  await migrateDatabase(database);
  const metrics: Record<string, unknown>[] = [];
  const logs: object[] = [];
  const runtime = createInterviewRuntime(database, config, {
    onFinalize: async () => {},
    log: (e) => {
      logs.push(e);
      console.log(JSON.stringify(e));
    },
  });
  const app = await buildApp({
    config,
    database,
    logger: false,
    identity: { authenticate: async () => ({ owner_id: 'realtime-smoke', roles: ['student'] }) },
    interview: { onFinalize: async () => {} },
  });
  await app.listen({ host: '127.0.0.1', port: 33701 });
  const worker = await startWorker(config, {
    database,
    handlers: runtime.handlers,
    maintain: runtime.maintain,
    isCancelled: runtime.isCancelled,
  });
  const base = 'http://127.0.0.1:33701/api/v1';
  const req = async (path: string, body?: unknown): Promise<Interview> => {
    const res = await fetch(base + path, {
      method: body ? 'POST' : 'GET',
      headers: {
        origin: config.PUBLIC_ORIGIN,
        'content-type': 'application/json',
        'idempotency-key': crypto.randomUUID(),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const v = await res.json();
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${JSON.stringify(v)}`);
    return v as Interview;
  };
  const target = Number(process.argv.find((x) => x.startsWith('--rounds='))?.split('=')[1] ?? 32);
  const types = (process.argv
    .find((x) => x.startsWith('--types='))
    ?.split('=')[1]
    ?.split(',') ?? [
    'technical_qa',
    'business_scenario',
    'hr',
    'mixed',
  ]) as InterviewConfig['interview_type'][];
  try {
    for (let count = 0; metrics.length < target; count++) {
      const type = types[count % types.length];
      let view = await req('/interviews', {
        job: 'frontend',
        career_stage: 'internship',
        interview_type: type,
        difficulty: '基础',
        duration_minutes: 10,
        interviewer_style: '标准',
        interaction_mode: 'text_fallback',
      });
      view = await req(`/interviews/${view.id}/start`, { version: view.version });
      for (
        let i = 0;
        i < (process.argv.includes('--sparse') ? 4 : 3) &&
        view.status === 'in_progress' &&
        metrics.length < target;
        i++
      ) {
        // Give question-presented prefetch a realistic opportunity without including candidate think-time in latency.
        await new Promise((r) => setTimeout(r, 400));
        const turn = view.turns.at(-1)!;
        const answers = process.argv.includes('--participation')
          ? [
              '我不配合',
              '我学过HTML和CSS，做过一个个人介绍静态网页，自己负责页面结构和样式。',
              '我用语义化标签组织内容，用Flex布局排列介绍和作品区域，之后在浏览器中调整窄屏显示。',
            ]
          : process.argv.includes('--refusal')
            ? ['你好', '不方便', '我学过HTML和CSS。']
            : process.argv.includes('--beginner')
              ? ['你好', '我没有做过前端项目', '我学过HTML和CSS，做过简单的静态页面练习。']
              : process.argv.includes('--sparse')
                ? [
                    '我是XXX，我做过很多项目',
                    '一个3D小游戏',
                    '玩家控制小球躲避障碍到达终点，是个单机闯关游戏。',
                    '我独立完成，主要负责角色移动、碰撞检测和关卡逻辑，用 Unity 实现。',
                  ]
                : [
                    '我是计算机专业大三学生，做过一个 React 课程选课页面。我负责表单和接口交互，小组共两人。我们把重复请求缓存在页面里，主要想减少用户等待，但当时没有测过优化前后的加载时间。我喜欢把用户操作做得清楚，也在学习如何验证优化效果。',
                    '这次我负责的是表单提交和重复请求处理。我先用浏览器网络面板检查请求，再在同一网络条件下手动重复操作了十次，记录了请求次数。没有做正式用户研究，也没有测页面整体耗时，所以只能说请求减少，不能说用户一定觉得更快。',
                    '组员原先希望一次加上很多筛选功能，我担心课程截止前做不完。我和他把核心选课任务列出来，先用可点击原型让三位同学尝试，发现错误提示更影响完成任务，于是先调整提示和保留失败输入。三个人的反馈不能代表全部用户，下一步我会扩大测试并记录任务耗时。',
                  ];
        const start = performance.now();
        view = await req(`/interviews/${view.id}/turns/${turn.id}/answer`, {
          version: view.version,
          text: answers[i],
        });
        const saved = performance.now() - start;
        let first: number | null = null;
        let previewText = '',
          terminal = false;
        if (view.generation_status === 'pending') {
          const res = await fetch(
            `${base}/interviews/${view.id}/events?generation_id=${view.generation_id}`,
            { signal: AbortSignal.timeout(65000) },
          );
          if (!res.ok) throw new Error(`SSE ${res.status}`);
          const reader = res.body!.getReader(),
            decoder = new TextDecoder();
          let buffer = '';
          try {
            while (!terminal) {
              const part = await reader.read();
              if (part.done) break;
              buffer += decoder.decode(part.value, { stream: true });
              let at: number;
              while ((at = buffer.indexOf('\n\n')) >= 0) {
                const frame = buffer.slice(0, at);
                buffer = buffer.slice(at + 2);
                const event = frame
                  .split('\n')
                  .find((x) => x.startsWith('event:'))
                  ?.slice(6)
                  .trim();
                const data = frame
                  .split('\n')
                  .find((x) => x.startsWith('data:'))
                  ?.slice(5);
                if (!data) continue;
                const payload = JSON.parse(data);
                if (event === 'question_delta' && (payload.text || payload.acknowledgement)) {
                  first ??= performance.now() - start;
                  previewText = payload.text;
                }
                if (event === 'committed') {
                  view = payload.interview;
                  terminal = true;
                }
                if (event === 'failed') {
                  view = await req(`/interviews/${view.id}`);
                  terminal = true;
                }
                if (event === 'invalidated') {
                  view = await req(`/interviews/${view.id}`);
                  terminal = true;
                }
              }
            }
          } finally {
            await reader.cancel();
          }
        }
        const row = {
          type,
          interview_id: view.id,
          round: i + 1,
          saved_ms: Math.round(saved),
          first_content_ms: first === null ? null : Math.round(first),
          complete_ms: Math.round(performance.now() - start),
          preview_received: !!previewText,
          next_question: view.turns.at(-1)?.text,
          status: view.status,
          generation_status: view.generation_status,
        };
        metrics.push(row);
        console.log(JSON.stringify(row));
        if (view.generation_status === 'failed') break;
      }
      if (view.status === 'in_progress')
        await req(`/interviews/${view.id}/finish`, {
          version: view.version,
          reason: 'user_finished',
        });
    }
    const quantile = (key: string, p: number) => {
      const values = metrics
        .map((x) => x[key])
        .filter((x): x is number => typeof x === 'number')
        .sort((a, b) => a - b);
      return values[Math.ceil(values.length * p) - 1] ?? null;
    };
    const summary = {
      rounds: metrics.length,
      failed_generations: metrics.filter((x) => x.generation_status === 'failed').length,
      saved_p95: quantile('saved_ms', 0.95),
      first_p50: quantile('first_content_ms', 0.5),
      first_p95: quantile('first_content_ms', 0.95),
      complete_p95: quantile('complete_ms', 0.95),
    };
    const memory = await database.pool.query(
      "SELECT count(*)::int AS count FROM interviews WHERE owner_id='realtime-smoke' AND agent_memory IS NOT NULL",
    );
    const retrieval = await database.pool.query(
      'SELECT count(*)::int AS count FROM interview_turns WHERE knowledge_context IS NOT NULL',
    );
    await mkdir('tests/artifacts', { recursive: true });
    const resultPath = `tests/artifacts/realtime-${Date.now()}-${metrics.length}.json`;
    await writeFile(
      resultPath,
      JSON.stringify(
        {
          summary,
          memory_records: memory.rows[0].count,
          retrieved_turns: retrieval.rows[0].count,
          metrics,
          logs,
        },
        null,
        2,
      ),
    );
    console.log(JSON.stringify(summary));
  } finally {
    await worker.close();
    await app.close();
    await runtime.close();
    await database.close();
  }
}
main().catch((e) => {
  console.error(e instanceof Error ? e.message : 'Realtime validation failed');
  process.exitCode = 1;
});
