import { ChatOpenAI, type ChatOpenAICallOptions } from '@langchain/openai';
import { SystemMessage, HumanMessage } from '@langchain/core/messages';
import type { BackendConfig } from '../../foundation/config';
import { ServiceError } from '../../foundation/errors';

/** LangChain transport with the existing bounded JSON/SSE contract at its boundary.
 * This lets historical validators and report schemas remain unchanged. No SDK retries. */
export function langChainFetch(config: BackendConfig, fetcher: typeof fetch = fetch): typeof fetch {
  return async (_url, init) => {
    const body = JSON.parse(String(init?.body));
    const signal = init?.signal ?? undefined;
    const model = new ChatOpenAI({
      apiKey: config.LLM_API_KEY || 'unconfigured',
      model: body.model,
      configuration: {
        baseURL: config.LLM_BASE_URL,
        fetch: (url, options) => fetcher(url, { ...options, redirect: 'error' }),
      },
      maxRetries: 0,
      timeout: config.LLM_TIMEOUT_MS,
      useResponsesApi: false,
      temperature: body.temperature,
      maxTokens: body.max_tokens,
      modelKwargs: body.thinking ? { thinking: body.thinking } : {},
      streamUsage: true,
    });
    const messages = (body.messages as { role: string; content: string }[]).map((m) =>
      m.role === 'system' ? new SystemMessage(m.content) : new HumanMessage(m.content),
    );
    const options: ChatOpenAICallOptions = { signal, response_format: body.response_format };
    const encoder = new TextEncoder();
    const usage = (u: { input_tokens?: number; output_tokens?: number } | undefined) =>
      u
        ? { prompt_tokens: u.input_tokens ?? 0, completion_tokens: u.output_tokens ?? 0 }
        : undefined;
    try {
      if (!body.stream) {
        const response = await model.invoke(messages, options);
        const content = typeof response.content === 'string' ? response.content : '';
        if (content.length > 65536) throw new Error('Oversized model output');
        return new Response(
          JSON.stringify({
            choices: [
              {
                message: { content },
                finish_reason: response.response_metadata.finish_reason ?? null,
              },
            ],
            usage: usage(response.usage_metadata),
          }),
          { headers: { 'content-type': 'application/json' } },
        );
      }
      const chunks = await model.stream(messages, options);
      const iterator = chunks[Symbol.asyncIterator]();
      let size = 0;
      const stream = new ReadableStream<Uint8Array>({
        async pull(controller) {
          try {
            const part = await iterator.next();
            if (part.done) {
              controller.enqueue(encoder.encode('data: [DONE]\n\n'));
              controller.close();
              return;
            }
            const value = part.value;
            const text = typeof value.content === 'string' ? value.content : '';
            size += text.length;
            if (size > 65536) throw new Error('Oversized model output');
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ choices: [{ delta: { content: text }, finish_reason: value.response_metadata.finish_reason ?? null }], usage: usage(value.usage_metadata) })}\n\n`,
              ),
            );
          } catch {
            await iterator.return?.();
            controller.error(
              new ServiceError(
                signal?.aborted ? 'task_cancelled' : 'provider_error',
                502,
                '模型流不可用',
                true,
              ),
            );
          }
        },
        async cancel() {
          await iterator.return?.();
        },
      });
      return new Response(stream, { headers: { 'content-type': 'text/event-stream' } });
    } catch {
      throw new ServiceError(
        signal?.aborted ? 'task_cancelled' : 'provider_error',
        502,
        '模型服务不可用',
        true,
      );
    }
  };
}
