/** Disposable graph-runtime UI QA. Synthetic account/materials, isolated database, no external model or media. */
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { resolve } from 'node:path';
import { config as dotenv } from 'dotenv';
import { emptyResumeTemplate } from '@interviewlab/core';
import { loadConfig } from '../../code/backend/src/foundation/config';
import { createDatabase } from '../../code/backend/src/database/connection';
import { migrateDatabase } from '../../code/backend/src/database/migrate';
import { createInvitedUser } from '../../code/backend/src/modules/accounts/provision';
import { createInterviewRuntime } from '../../code/backend/src/modules/interview-runtime';
import { buildApp } from '../../code/backend/src/server/app';
import { startWorker } from '../../code/backend/src/tasks/worker';
import { testDatabaseUrl } from './test-database';

async function main() {
  dotenv({ quiet: true });
  const server = createServer(async (req, res) => {
    const parts: Buffer[] = [];
    for await (const chunk of req) parts.push(Buffer.from(chunk));
    const payload = JSON.parse(Buffer.concat(parts).toString()),
      input = JSON.parse(payload.messages[1].content);
    let value: unknown;
    if (payload.stream) {
      const goals = input.goal_options as string[],
        anchors = input.anchors as unknown[];
      const used = input.memory?.asked_intents?.length ?? 0;
      const questions = [
        '你如何检查接口发生冲突时的结果？',
        '你当时为什么选择这个处理方式？',
        '如果重新做这个项目，你会优先改进什么？',
      ];
      value = {
        a: payload.response_format.json_schema.schema.properties.a.enum.includes('f') ? 'f' : 'n',
        g: Math.min(used, goals.length - 1),
        e: anchors.length ? 0 : null,
        o: 1,
        q: questions[Math.min(used, 2)],
        s: [],
        r: input.confirmed_resume?.facts.length ? [0] : [],
      };
      res.writeHead(200, { 'content-type': 'text/event-stream' });
      res.end(
        `data: ${JSON.stringify({ id: 'qa', object: 'chat.completion.chunk', choices: [{ index: 0, delta: { role: 'assistant', content: JSON.stringify(value) }, finish_reason: null }] })}\n\ndata: ${JSON.stringify({ id: 'qa', object: 'chat.completion.chunk', choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] })}\n\ndata: [DONE]\n\n`,
      );
      return;
    }
    if (Array.isArray(input.input))
      value = {
        facts: input.input.length ? [{ kind: 'experience', anchor: 0 }] : [],
        clarification_points: [],
      };
    else
      value = {
        goals: [
          {
            goal: input.input.goals[0],
            focus: '了解本人行动及验证过程',
            evidence_indices: input.input.resume?.facts.length ? [0] : [],
          },
        ],
        limitations: ['受控界面验收，不代表真实模型质量'],
      };
    res.setHeader('content-type', 'application/json');
    res.end(
      JSON.stringify({
        id: 'qa',
        object: 'chat.completion',
        model: 'ecnu-plus',
        choices: [
          {
            index: 0,
            finish_reason: 'stop',
            message: { role: 'assistant', content: JSON.stringify(value) },
          },
        ],
      }),
    );
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const config = loadConfig({
    NODE_ENV: 'test',
    DATABASE_URL: testDatabaseUrl(),
    AUTH_ENABLED: 'true',
    BETTER_AUTH_SECRET: randomBytes(32).toString('base64url'),
    PUBLIC_ORIGIN: 'http://127.0.0.1:33600',
    LLM_API_KEY: 'synthetic-model-only',
    LLM_BASE_URL: `http://127.0.0.1:${(server.address() as { port: number }).port}`,
    LOG_LEVEL: 'silent',
  });
  const db = createDatabase(config);
  await migrateDatabase(db);
  const email = 'agent-preview@example.test',
    password = 'Agent-test-2026!';
  const user = await createInvitedUser(db, { email, password, name: 'Agent合成验收账号' });
  const rt = createInterviewRuntime(db, config, { onFinalize: async () => {} });
  await rt.materials.save(user.id, {
    kind: 'resume',
    title: '课程预约系统 · 合成验收',
    text: '',
    confirmed: true,
    structure: {
      ...emptyResumeTemplate(),
      projects: '我做了用于同学预约教室的课程系统，本人负责接口和冲突处理。',
      skills: 'Java、SQL',
    },
  });
  const api = await buildApp({
    database: db,
    config,
    logger: false,
    interview: { onFinalize: async () => {} },
  });
  await api.listen({ host: '127.0.0.1', port: 33601 });
  const worker = await startWorker(config, {
    database: db,
    handlers: rt.handlers,
    maintain: rt.maintain,
    isCancelled: rt.isCancelled,
  });
  const next = spawn(
    process.execPath,
    [
      resolve('node_modules/next/dist/bin/next'),
      'dev',
      '--hostname',
      '127.0.0.1',
      '--port',
      '33600',
    ],
    {
      cwd: resolve('code/frontend'),
      env: { ...process.env, BACKEND_ORIGIN: 'http://127.0.0.1:33601', NODE_ENV: 'development' },
      windowsHide: true,
      stdio: 'ignore',
    },
  );
  console.log('Synthetic agent preview ready at http://127.0.0.1:33600. Type stop to close.');
  let closing = false;
  const close = async () => {
    if (closing) return;
    closing = true;
    next.kill();
    await worker.close();
    await api.close();
    await rt.close();
    server.close();
    await db.close();
    process.exit(0);
  };
  process.on('SIGINT', () => void close());
  process.on('SIGTERM', () => void close());
  process.stdin.resume();
  process.stdin.on('data', (data) => {
    if (String(data).trim() === 'stop') void close();
  });
}
main().catch(() => {
  console.error('Synthetic preview failed; check dedicated test database and free local ports.');
  process.exitCode = 1;
});
