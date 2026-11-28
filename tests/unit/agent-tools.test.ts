/** 验证 Agent 工具轨迹不泄露私有输入或输出，并保留业务错误及取消信号。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { defineAgentTool } from '../../code/backend/src/foundation/agent/tools';

const definition = {
  name: 'test_evidence',
  description: '受控测试工具',
  parameters: ['answer', 'signal'],
};

test('tool forwards input and cancellation signal but only logs sanitized metadata', async () => {
  const entries: object[] = [];
  const controller = new AbortController();
  const result = { quote: '仅供本人阅读的回答原文' };
  const tool = defineAgentTool(
    definition,
    async (answer: string, signal: AbortSignal) => {
      assert.equal(answer, '私有简历与回答');
      assert.equal(signal, controller.signal);
      return result;
    },
    (entry) => entries.push(entry),
  );
  assert.equal(await tool.invoke('私有简历与回答', controller.signal), result);
  assert.equal(entries.length, 1);
  assert.deepEqual(Object.keys(entries[0]).sort(), ['duration_ms', 'status', 'tool']);
  assert.equal((entries[0] as { status: string }).status, 'ok');
  assert.equal(JSON.stringify(entries).includes('私有'), false);
  assert.equal(JSON.stringify(entries).includes(result.quote), false);
});

test('failed or cancelled tool preserves the original error and logs no provider message', async () => {
  const entries: object[] = [];
  const controller = new AbortController();
  const reason = new Error('含私有供应商请求信息的取消原因');
  controller.abort(reason);
  const tool = defineAgentTool(
    definition,
    async (_answer: string, signal: AbortSignal) => {
      signal.throwIfAborted();
      return 'unreachable';
    },
    (entry) => entries.push(entry),
  );
  await assert.rejects(tool.invoke('私有输入', controller.signal), (error) => error === reason);
  assert.equal(entries.length, 1);
  assert.equal((entries[0] as { status: string }).status, 'error');
  assert.equal(JSON.stringify(entries).includes(reason.message), false);
});
