/** Agent 架构约束：核对五部分入口、中文文件说明及共享工作流的取消与校验边界。 */
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import type { InterviewKnowledgeRuntime, InterviewRetrieval } from '@interviewlab/core';
import { checkedGraph } from '../../code/backend/src/foundation/agent/graph';
import { createInterviewKnowledgeTools } from '../../code/backend/src/modules/interviews/agent/core/tools';

const backend = resolve(dirname(fileURLToPath(import.meta.url)), '../../code/backend/src');
const agentDirectories = ['interviews', 'reports'].map((name) =>
  join(backend, 'modules', name, 'agent'),
);

function sources(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? sources(path) : entry.name.endsWith('.ts') ? [path] : [];
  });
}

test('both Agents expose the five template components and a populated knowledge directory', () => {
  for (const directory of agentDirectories) {
    for (const component of ['planner', 'tools', 'agent', 'memory', 'guardrails']) {
      assert.ok(statSync(join(directory, 'core', `${component}.ts`)).isFile());
    }
    assert.ok(sources(join(directory, 'knowledge')).length > 0);
  }
});

test('Agent sources begin with a Chinese purpose comment and retain LangChain/LangGraph', () => {
  const files = [
    ...agentDirectories.flatMap(sources),
    ...sources(join(backend, 'foundation', 'agent')),
    join(backend, 'modules', 'agent-runtime.ts'),
  ];
  for (const path of files) {
    const source = readFileSync(path, 'utf8');
    const openingComment = source.match(/^\uFEFF?\s*(\/\*[\s\S]*?\*\/|\/\/[^\r\n]*)/);
    assert.ok(openingComment && /[\u4e00-\u9fff]/.test(openingComment[1]), path);
  }
  assert.match(
    readFileSync(join(backend, 'foundation', 'agent', 'graph.ts'), 'utf8'),
    /from ['"]@langchain\/langgraph['"]/,
  );
  assert.match(
    readFileSync(join(backend, 'foundation', 'agent', 'model.ts'), 'utf8'),
    /from ['"]@langchain\/openai['"]/,
  );
});

test('shared Agent graph returns only validated output and traces no input or model content', async () => {
  const events: string[] = [];
  const logs: object[] = [];
  const result = await checkedGraph(
    'synthetic_agent',
    { private_answer: 'private-answer-must-not-enter-logs' },
    {
      prepare: (input) => {
        events.push('prepare');
        return { answer: input.private_answer };
      },
      generate: async (context) => {
        events.push('generate');
        return { text: context.answer };
      },
      validate: (raw, context) => {
        events.push('validate');
        assert.deepEqual(raw, { text: context.answer });
        return { checked: true };
      },
    },
    new AbortController().signal,
    (entry) => logs.push(entry),
  );
  assert.deepEqual(events, ['prepare', 'generate', 'validate']);
  assert.deepEqual(result, { checked: true });
  assert.equal(logs.length, 3);
  assert.ok(logs.every((entry) => !JSON.stringify(entry).includes('private-answer')));
});

test('Agent graph rejects cancellation before model execution or after a late model result', async () => {
  for (const cancelBeforeStart of [true, false]) {
    const controller = new AbortController();
    let modelCalls = 0;
    let validated = false;
    if (cancelBeforeStart) controller.abort();
    await assert.rejects(
      checkedGraph(
        'synthetic_cancelled_agent',
        null,
        {
          prepare: () => null,
          generate: async () => {
            modelCalls++;
            controller.abort();
            return 'late-model-result';
          },
          validate: () => {
            validated = true;
            return 'must-not-publish';
          },
        },
        controller.signal,
      ),
    );
    assert.equal(modelCalls, cancelBeforeStart ? 0 : 1);
    assert.equal(validated, false);
  }
});

test('interview retrieval tool preserves the frozen knowledge, answer and cancellation boundary', async () => {
  const controller = new AbortController();
  const knowledge = {
    content_version: 'synthetic-frozen-release',
    questions: [],
    sources: [],
    missing_reason: null,
  };
  const args: Parameters<InterviewKnowledgeRuntime['context']> = [
    {
      job: 'backend',
      career_stage: 'internship',
      interview_type: 'technical_qa',
      difficulty: '基础',
      duration_minutes: 10,
      interviewer_style: '标准',
      interaction_mode: 'text_fallback',
    },
    knowledge,
    null,
    '私有回答，只能传给当前检索',
    controller.signal,
  ];
  const retrieval: InterviewRetrieval = {
    release: knowledge.content_version,
    chunks: [],
    missing_reason: 'synthetic-empty',
    mode: 'empty',
  };
  let calls = 0;
  const runtime: InterviewKnowledgeRuntime = {
    enabled: true,
    read: async () => knowledge,
    profiles: async () => ({ version: 'synthetic', default_type: 'technical_qa', profiles: [] }),
    prefetch: () => {},
    async context(...received) {
      calls++;
      assert.equal(this, runtime);
      received.forEach((value, index) => assert.equal(value, args[index]));
      received[4].throwIfAborted();
      return retrieval;
    },
  };
  const entries: object[] = [];
  const tool = createInterviewKnowledgeTools(runtime, (entry) =>
    entries.push(entry),
  ).retrieve_context;
  assert.equal(await tool.invoke(...args), retrieval);
  const cancellation = new Error('synthetic-cancellation');
  controller.abort(cancellation);
  await assert.rejects(tool.invoke(...args), (error) => error === cancellation);
  assert.equal(calls, 2);
  assert.equal(JSON.stringify(entries).includes(args[3]), false);
});
