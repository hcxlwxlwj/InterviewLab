/** Manual UI QA: real production Agent/providers, synthetic materials, isolated test database. */
import { spawn, type ChildProcess } from 'node:child_process';
import { createServer } from 'node:net';
import { randomBytes } from 'node:crypto';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
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

const origin = 'http://127.0.0.1:33600';
const apiOrigin = 'http://127.0.0.1:33601';
let phase = 'configuration';

async function assertPortFree(port: number) {
  await new Promise<void>((done, reject) => {
    const server = createServer();
    server.once('error', () => reject(new Error('Preview ports are already occupied')));
    server.listen(port, '127.0.0.1', () => server.close(() => done()));
  });
}

async function stopNext(next?: ChildProcess) {
  if (!next?.pid || next.exitCode !== null) return;
  if (process.platform !== 'win32') {
    next.kill('SIGTERM');
    return;
  }
  const stop = spawn('taskkill', ['/PID', String(next.pid), '/T', '/F'], {
    windowsHide: true,
    stdio: 'ignore',
  });
  await new Promise<void>((done) => {
    stop.once('exit', () => done());
    stop.once('error', () => done());
  });
}

async function main() {
  dotenv({ quiet: true });
  await assertPortFree(33600);
  await assertPortFree(33601);
  const databaseUrl = testDatabaseUrl();
  const config = loadConfig({
    ...process.env,
    NODE_ENV: 'test',
    DATABASE_URL: databaseUrl,
    AUTH_ENABLED: 'true',
    BETTER_AUTH_SECRET: randomBytes(32).toString('base64url'),
    PUBLIC_ORIGIN: origin,
    LOG_LEVEL: 'silent',
  });
  if (!config.LLM_API_KEY) throw new Error('Real model configuration is required');
  const db = createDatabase(config);
  let rt: ReturnType<typeof createInterviewRuntime> | undefined;
  let api: Awaited<ReturnType<typeof buildApp>> | undefined;
  let worker: Awaited<ReturnType<typeof startWorker>> | undefined;
  let next: ChildProcess | undefined;
  let closing = false;
  const close = async () => {
    if (closing) return;
    closing = true;
    await stopNext(next);
    await worker?.close();
    await api?.close();
    await rt?.close();
    await db.close();
  };
  process.on('SIGINT', () => void close().finally(() => process.exit(0)));
  process.on('SIGTERM', () => void close().finally(() => process.exit(0)));
  try {
    phase = 'database_migration';
    await migrateDatabase(db);
    phase = 'test_account';
    const email = `agent-ui-${Date.now()}@example.test`;
    const password = randomBytes(12).toString('base64url');
    const user = await createInvitedUser(db, {
      email,
      password,
      name: '真实 Agent · 界面验收账号',
    });
    phase = 'runtime';
    rt = createInterviewRuntime(db, config);
    await rt.materials.save(user.id, {
      kind: 'resume',
      title: '合成课程经历 · 界面验收',
      text: '',
      confirmed: true,
      structure: {
        ...emptyResumeTemplate(),
        projects: '我做了用于同学预约教室的课程系统，本人负责接口与冲突处理。',
        skills: 'Java、SQL和接口测试',
      },
    });
    phase = 'api';
    api = await buildApp({ database: db, config, logger: false });
    await api.listen({ host: '127.0.0.1', port: 33601 });
    phase = 'worker';
    worker = await startWorker(config, {
      database: db,
      handlers: rt.handlers,
      maintain: rt.maintain,
      isCancelled: rt.isCancelled,
    });
    phase = 'frontend';
    next = spawn(
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
        env: {
          ...process.env,
          NODE_ENV: 'development',
          BACKEND_ORIGIN: apiOrigin,
          PUBLIC_ORIGIN: origin,
        },
        windowsHide: true,
        stdio: 'ignore',
      },
    );
    let startupError = false;
    next.once('error', () => {
      startupError = true;
    });
    const deadline = Date.now() + 90000;
    let ready = false;
    while (!ready && Date.now() < deadline) {
      if (startupError || next.exitCode !== null) throw new Error('Preview frontend did not start');
      try {
        ready = (await fetch(origin, { signal: AbortSignal.timeout(2000) })).status < 500;
      } catch {
        /* Next is still starting. */
      }
      if (!ready) await delay(400);
    }
    if (!ready) throw new Error('Preview startup timed out');
    console.log(
      JSON.stringify({
        ready: true,
        origin,
        email,
        password,
        model: config.LLM_MODEL,
        note: 'Real Agent and real model calls; only account/materials are synthetic. Type stop to close.',
      }),
    );
    process.stdin.resume();
    process.stdin.on('data', (data) => {
      if (String(data).trim() === 'stop') void close().finally(() => process.exit(0));
    });
  } catch (error) {
    await close();
    throw error;
  }
}

void main().catch((error: unknown) => {
  console.error(
    JSON.stringify({
      phase,
      code:
        error && typeof error === 'object' && 'code' in error
          ? String(error.code)
          : 'preview_failed',
      type: error instanceof Error ? error.name : 'Error',
    }),
  );
  process.exitCode = 1;
});
