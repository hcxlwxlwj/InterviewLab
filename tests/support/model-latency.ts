import { config as dotenv } from 'dotenv';
import { loadConfig } from '../../code/backend/src/foundation/config';
async function main() {
  dotenv({ quiet: true });
  const config = loadConfig();
  if (!config.LLM_API_KEY) throw new Error('Missing local key');
  const started = performance.now();
  const response = await fetch(`${config.LLM_BASE_URL}/chat/completions`, {
    method: 'POST',
    signal: AbortSignal.timeout(30000),
    headers: { authorization: `Bearer ${config.LLM_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      model: config.LLM_MODEL,
      stream: true,
      thinking: { type: 'disabled' },
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'latency_probe',
          strict: true,
          schema: {
            type: 'object',
            properties: { question: { type: 'string' } },
            required: ['question'],
            additionalProperties: false,
          },
        },
      },
      messages: [
        { role: 'system', content: '你是面试官。仅输出 JSON，question 是一个简短追问。' },
        {
          role: 'user',
          content:
            '我负责 React 页面，用缓存减少了接口请求，但没有测过加载时间。请针对这个回答追问一个问题。',
        },
      ],
    }),
  });
  if (!response.ok) throw new Error(`Provider HTTP ${response.status}`);
  let first: number | null = null,
    data = '',
    text = '';
  const decoder = new TextDecoder();
  const reader = response.body!.getReader();
  while (true) {
    const part = await reader.read();
    if (part.done) break;
    const bytes = part.value;
    data += decoder.decode(bytes, { stream: true });
    let at: number;
    while ((at = data.indexOf('\n')) >= 0) {
      const line = data.slice(0, at).trim();
      data = data.slice(at + 1);
      if (!line.startsWith('data:') || line.slice(5).trim() === '[DONE]') continue;
      const part = JSON.parse(line.slice(5));
      const delta = part.choices?.[0]?.delta?.content;
      if (delta) {
        first ??= performance.now() - started;
        text += delta;
      }
    }
  }
  const value = JSON.parse(text);
  console.log(
    JSON.stringify({
      model: config.LLM_MODEL,
      first_token_ms: Math.round(first ?? -1),
      total_ms: Math.round(performance.now() - started),
      valid_json: typeof value.question === 'string',
      question: value.question,
    }),
  );
  const embStart = performance.now();
  const emb = await fetch(`${config.LLM_BASE_URL}/embeddings`, {
    method: 'POST',
    signal: AbortSignal.timeout(10000),
    headers: { authorization: `Bearer ${config.LLM_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      model: 'ecnu-embedding-small',
      input: ['React 状态和副作用', '用户需求和结果验证'],
    }),
  });
  if (!emb.ok) throw new Error(`Embedding HTTP ${emb.status}`);
  const vectors = (await emb.json()) as { data: { embedding: number[] }[] };
  console.log(
    JSON.stringify({
      embedding_model: 'ecnu-embedding-small',
      duration_ms: Math.round(performance.now() - embStart),
      dimensions: vectors.data.map((x) => x.embedding.length),
      finite: vectors.data.every((x) => x.embedding.every(Number.isFinite)),
    }),
  );
}
main().catch(() => {
  console.error('Provider probe failed (details suppressed)');
  process.exitCode = 1;
});
