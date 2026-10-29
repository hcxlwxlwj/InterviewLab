/** Loopback interview development (--interview-dev), or disposable browser QA. */
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { config as dotenv } from 'dotenv';
import { loadConfig } from '../../code/backend/src/foundation/config';
import { createDatabase } from '../../code/backend/src/database/connection';
import { migrateDatabase } from '../../code/backend/src/database/migrate';
import { createInvitedUser } from '../../code/backend/src/modules/accounts/provision';
import { buildApp } from '../../code/backend/src/server/app';
import { createInterviewRuntime } from '../../code/backend/src/modules/interview-runtime';
import { startWorker } from '../../code/backend/src/tasks/worker';

async function main() {
  dotenv({ quiet: true });
  const interviewDev = process.argv.includes('--interview-dev');
  if (interviewDev && process.env.NODE_ENV === 'production')
    throw new Error('Interview development mode is unavailable in production');
  const realModel = interviewDev || process.env.INTERVIEW_PREVIEW_REAL_MODEL === '1';
  const url = interviewDev ? process.env.INTERVIEW_DEV_DATABASE_URL : process.env.TEST_DATABASE_URL;
  const databaseName = url ? new URL(url).pathname.slice(1) : '';
  if (
    !url ||
    !(interviewDev ? /^interviewlab_dev[a-z0-9_]*$/ : /^interviewlab_test[a-z0-9_]*$/).test(
      databaseName,
    )
  )
    throw new Error('Dedicated interview development or test database required');
  const config = loadConfig({
    NODE_ENV: 'test',
    KNOWLEDGE_DATABASE_URL: interviewDev ? process.env.KNOWLEDGE_DATABASE_URL : undefined,
    KNOWLEDGE_PREVIEW: interviewDev ? process.env.KNOWLEDGE_PREVIEW : 'false',
    LOG_LEVEL: 'silent',
    DATABASE_URL: url,
    AUTH_ENABLED: interviewDev ? 'false' : 'true',
    BETTER_AUTH_SECRET: randomBytes(32).toString('base64url'),
    PUBLIC_ORIGIN: 'http://127.0.0.1:33600',
    LLM_BASE_URL: realModel ? process.env.LLM_BASE_URL : 'http://127.0.0.1:35041/v1',
    LLM_API_KEY: realModel ? process.env.LLM_API_KEY : 'controlled-model-test-only',
    LLM_MODEL: realModel ? (process.env.LLM_MODEL ?? 'ecnu-plus') : 'ecnu-plus',
    LLM_OUTPUT_MODE: realModel ? process.env.LLM_OUTPUT_MODE : 'json_object',
  });
  if (realModel && !config.LLM_API_KEY) throw new Error('Real model key is required');
  const model = createServer(async (req, res) => {
    try {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const payload = JSON.parse(Buffer.concat(chunks).toString());
      const { task, input } = JSON.parse(payload.messages[1].content);
      if (payload.model !== 'ecnu-plus' || req.url !== '/v1/chat/completions')
        throw new Error('Unexpected model protocol');
      const base = {
        stage: 'experience',
        acknowledgement: '我们继续聊聊你提到的经历。',
        text: '请介绍一个你参与的项目，说明你本人负责的部分。',
        topic: '个人职责',
        purpose: '了解个人贡献',
        knowledge_question_id: null,
        source_refs: [],
        evidence_refs: [],
      };
      let value: unknown;
      if (task === 'plan') {
        const q = input.snapshot.knowledge.questions[0];
        value = {
          topics: ['个人贡献', '验证过程'],
          question:
            input.configuration.interview_type === 'technical_qa' && q
              ? {
                  ...base,
                  text: q.text,
                  topic: q.topic,
                  purpose: q.intent,
                  knowledge_question_id: q.id,
                  source_refs: q.source_refs,
                }
              : base,
        };
      } else if (task === 'advance') {
        const last = input.history.at(-1);
        value = input.clarify
          ? {
              action: 'clarify',
              question: null,
              clarification: '请说明你本人采取了哪些行动，不需要介绍所有团队成员的工作。',
            }
          : last.follow_up_index < 2 && last.answer_status === 'answered'
            ? {
                action: 'follow_up',
                question: {
                  ...base,
                  text:
                    last.follow_up_index === 0
                      ? '你提到的这部分工作，是怎样验证其结果的？'
                      : '你怎样确认这些验证结果符合预期？',
                  evidence_refs: [
                    { turn_id: last.id, revision: last.revision, quote: last.answer_text },
                  ],
                },
                clarification: null,
              }
            : { action: 'finish', question: null, clarification: null };
      } else if (task === 'evaluate') {
        const t = input.turn;
        value = {
          turn_id: t.id,
          revision: t.revision,
          strengths: [
            {
              text: '本次回答给出了明确的个人行动陈述。',
              evidence_refs: [{ turn_id: t.id, revision: t.revision, quote: t.answer_text }],
            },
          ],
          gaps: [],
          reference_points: ['结合实际过程说明验证方法，不补造数据。'],
          retry_goal: '补充验证过程和边界条件',
          dimensions: ['logical_expression'],
          limitations: ['受控测试模型输出，仅验证产品流程。', '经历内容来自用户当场陈述。'],
        };
      } else if (task === 'summarize') {
        const evaluations = input.evaluations;
        value = {
          overview: evaluations[0].strengths[0],
          strengths: evaluations
            .slice(0, 3)
            .flatMap((e: { strengths: unknown[] }) => e.strengths.slice(0, 1)),
          improvements: [],
          dimension_assessments: {
            technical_knowledge: null,
            project_communication: null,
            logical_expression: { text: '本次合成回答说明了个人行动。', level: 3 },
          },
          limitations: ['受控测试模型仅验证界面流程，不代表实际分析质量。'],
        };
      } else if (task === 'compare')
        value = {
          changes: [
            {
              text: '两次回答都给出了可定位陈述，请结合重练目标检查变化。',
              evidence_refs: [
                {
                  turn_id: input.original.turn_id,
                  revision: input.original.revision,
                  quote: input.original.text,
                },
                {
                  turn_id: input.retry.turn_id,
                  revision: input.retry.revision,
                  quote: input.retry.text,
                },
              ],
            },
          ],
          remaining_gaps: [],
          limitations: ['受控测试模型不代表 ecnu-plus 的实际效果。'],
        };
      else throw new Error('Unsupported task');
      await new Promise((r) => setTimeout(r, 200));
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(
        JSON.stringify({
          choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(value) } }],
        }),
      );
    } catch {
      res.writeHead(400);
      res.end('{}');
    }
  });
  if (!realModel) await new Promise<void>((done) => model.listen(35041, '127.0.0.1', done));
  const database = createDatabase(config);
  await migrateDatabase(database);
  const email = process.env.INTERVIEW_PREVIEW_EMAIL ?? `browser-${randomUUID()}@example.test`;
  // Synthetic password only for this disposable local test account; never used in production.
  const existing =
    !interviewDev && process.env.INTERVIEW_PREVIEW_EMAIL
      ? (
          await database.pool.query<{ id: string }>(
            'SELECT id FROM auth_users WHERE email=$1 AND name=$2',
            [email, '文字闭环浏览器测试'],
          )
        ).rows[0]
      : undefined;
  if (!interviewDev && process.env.INTERVIEW_PREVIEW_EMAIL && !existing)
    throw new Error('Requested synthetic preview account does not exist');
  const user = interviewDev
    ? { id: 'interview-dev-local' }
    : (existing ??
      (await createInvitedUser(database, {
        email,
        password: 'Browser-test-only-2026!',
        name: '文字闭环浏览器测试',
      })));
  const interview = interviewDev ? { onFinalize: async () => {} } : undefined;
  const runtime = createInterviewRuntime(database, config, interview);
  const api = await buildApp({
    config,
    database,
    logger: false,
    interview,
    identity: interviewDev
      ? { authenticate: async () => ({ owner_id: user.id, roles: ['student'] }) }
      : undefined,
  });
  await api.listen({ host: '127.0.0.1', port: 33601 });
  const worker = await startWorker(config, {
    database,
    handlers: runtime.handlers,
    maintain: runtime.maintain,
    isCancelled: runtime.isCancelled,
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
      env: {
        ...process.env,
        BACKEND_ORIGIN: 'http://127.0.0.1:33601',
        NODE_ENV: 'development',
        INTERVIEW_DEV_OWNER_ID: interviewDev ? user.id : '',
      },
      windowsHide: true,
      stdio: 'ignore',
    },
  );
  console.info(
    JSON.stringify({
      preview: 'http://127.0.0.1:33600',
      ...(interviewDev
        ? {
            mode: 'interview-development',
            identity: 'server-injected-local',
            login_required: false,
          }
        : { email }),
      model: realModel ? config.LLM_MODEL : 'controlled-protocol-test-only',
    }),
  );
  let closing = false;
  async function close() {
    if (closing) return;
    closing = true;
    next.kill();
    await worker.close();
    await runtime.close();
    await api.close();
    if (!realModel) model.close();
    if (!interviewDev) {
      const owned = (
        await database.pool.query<{ id: string }>('SELECT id FROM interviews WHERE owner_id=$1', [
          user.id,
        ])
      ).rows;
      for (const row of owned) {
        const v = await runtime.interviews.read({ owner_id: user.id, roles: [] }, row.id);
        await runtime.interviews.delete(
          { owner_id: user.id, roles: [] },
          row.id,
          { version: v.version },
          randomUUID(),
        );
      }
      await database.pool.query('DELETE FROM idempotency_records WHERE owner_id=$1', [user.id]);
      await database.pool.query('DELETE FROM audit_events WHERE resource_id=$1', [user.id]);
      await database.pool.query('DELETE FROM auth_users WHERE id=$1', [user.id]);
    }
    await database.close();
    process.exit(0);
  }
  process.on('SIGINT', () => void close());
  process.on('SIGTERM', () => void close());
  process.stdin.resume();
  process.stdin.on('data', (data) => {
    if (String(data).trim() === 'stop') void close();
  });
}
void main().catch(() => {
  console.error('Synthetic preview failed; check test database and available local ports.');
  process.exitCode = 1;
});
