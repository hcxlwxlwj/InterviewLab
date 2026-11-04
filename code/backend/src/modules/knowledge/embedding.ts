import { z } from 'zod';
import type { BackendConfig } from '../../foundation/config';
import { ServiceError } from '../../foundation/errors';

export async function embed(
  config: BackendConfig,
  input: string[],
  signal?: AbortSignal,
): Promise<number[][]> {
  if (!config.LLM_API_KEY) throw new ServiceError('capability_unavailable', 501, '向量模型未配置');
  if (input.join('').length > 6000) throw new Error('Embedding batch too large');
  const res = await fetch(`${config.LLM_BASE_URL!.replace(/\/$/, '')}/embeddings`, {
    method: 'POST',
    redirect: 'error',
    signal: AbortSignal.any([AbortSignal.timeout(10000), ...(signal ? [signal] : [])]),
    headers: { authorization: `Bearer ${config.LLM_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({ model: config.EMBEDDING_MODEL, input, encoding_format: 'float' }),
  });
  if (!res.ok) throw new ServiceError('embedding_error', 502, '向量服务不可用', true);
  const raw = await res.text();
  if (raw.length > 2000000) throw new Error('Oversized embedding');
  const result = z
    .object({
      data: z
        .array(
          z.object({
            index: z.number().int().nonnegative(),
            embedding: z.array(z.number().finite()).length(1024),
          }),
        )
        .length(input.length),
    })
    .parse(JSON.parse(raw));
  const ordered = result.data.sort((a, b) => a.index - b.index);
  if (ordered.some((x, i) => x.index !== i || !x.embedding.some((n) => n !== 0)))
    throw new Error('Invalid embedding indices');
  return ordered.map((x) => x.embedding);
}
