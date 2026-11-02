import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import type { VoiceCapabilities, VoiceClientEvent } from '@interviewlab/core';
import { requireSameOrigin } from '../../../foundation/auth';
import { ServiceError } from '../../../foundation/errors';
import { errorSchema } from '../../../foundation/schemas';
import type { BackendConfig } from '../../../foundation/config';
import type { ModuleContext } from '../../contracts';
import type { LiveInterviewsService } from '../service';
import { createVolcengineVoice, type VoiceProvider } from './volcengine';
import { InterviewVoiceSession } from './session';

export interface VoiceOptions {
  config: BackendConfig;
  provider?: VoiceProvider;
}
const controlSchema = z.discriminatedUnion('type', [
  z
    .object({
      type: z.enum(['speech_start', 'speech_end', 'commit', 'interrupt', 'repeat', 'ping']),
    })
    .strict(),
  z.object({ type: z.literal('hold'), enabled: z.boolean() }).strict(),
  z
    .object({
      type: z.literal('playback'),
      speech_id: z.uuid(),
      played_ms: z.number().min(0).max(120000),
      interrupted: z.boolean(),
    })
    .strict(),
]);
export function registerVoiceRoutes(
  app: FastifyInstance,
  context: ModuleContext,
  ready: () => LiveInterviewsService,
  options: VoiceOptions,
) {
  const { config } = options;
  const provider = options.provider ?? createVolcengineVoice(config);
  const sessions = new Map<string, { close: () => void }>();
  app.addHook('onClose', async () => {
    for (const session of sessions.values()) session.close();
    sessions.clear();
  });
  const capabilities = (): VoiceCapabilities => ({
    available: config.VOICE_ENABLED && provider.available,
    reason: !config.VOICE_ENABLED
      ? '实时语音尚未开启，请先配置火山引擎语音服务。'
      : !provider.available
        ? '语音服务尚未配置完整，请配置 ASR 和 TTS 密钥后重启后端。'
        : null,
    input_sample_rate: 16000,
    output_sample_rate: 24000,
    silence_ms: config.VOICE_SILENCE_MS,
  });
  const params = z.object({ id: z.uuid() });
  app.get<{ Params: { id: string } }>(
    '/interviews/:id/voice/capabilities',
    {
      schema: {
        tags: ['interviews'],
        params,
        response: {
          200: z.object({
            available: z.boolean(),
            reason: z.string().nullable(),
            input_sample_rate: z.literal(16000),
            output_sample_rate: z.literal(24000),
            silence_ms: z.number(),
          }),
          401: errorSchema,
          404: errorSchema,
          501: errorSchema,
        },
      },
    },
    async (request) => {
      await ready().read(await context.requireIdentity(request), request.params.id);
      return capabilities();
    },
  );
  app.get<{ Params: { id: string } }>(
    '/interviews/:id/voice',
    {
      websocket: true,
      schema: { hide: true, params },
      preValidation: async (request) => {
        requireSameOrigin(request, config.PUBLIC_ORIGIN);
        const principal = await context.requireIdentity(request);
        await ready().read(principal, request.params.id);
        if (!capabilities().available)
          throw new ServiceError('capability_unavailable', 501, capabilities().reason!);
      },
    },
    (socket, request) => {
      let bufferedBytes = 0,
        windowStart = Date.now(),
        windowBytes = 0,
        windowControls = 0;
      const identity = () => context.requireIdentity(request);
      const session = new InterviewVoiceSession(
        request.params.id,
        identity,
        ready(),
        provider,
        config.VOICE_SILENCE_MS,
        (event) => {
          if (socket.readyState !== 1) return;
          if (socket.bufferedAmount > 2 * 1024 * 1024) {
            session.close();
            socket.close(1013, 'Audio consumer too slow');
            return;
          }
          socket.send(JSON.stringify(event));
        },
        () => socket.close(1000, 'Voice session ended'),
      );
      let key = '';
      socket.on('message', (data, binary) => {
        try {
          if (Date.now() - windowStart > 1000) {
            windowStart = Date.now();
            windowBytes = 0;
            windowControls = 0;
          }
          if (binary) {
            if (Date.now() - windowStart > 1000) {
              windowStart = Date.now();
              windowBytes = 0;
            }
            const pcm = Buffer.from(data as Buffer);
            windowBytes += pcm.byteLength;
            bufferedBytes += pcm.byteLength;
            if (windowBytes > 96000 || bufferedBytes > 32 * 1024 * 1024) throw new Error();
            session.audio(pcm);
          } else {
            if (++windowControls > 60) throw new Error();
            if (Buffer.byteLength(data.toString()) > 1024) throw new Error();
            const event = controlSchema.parse(JSON.parse(data.toString())) as VoiceClientEvent;
            session.control(event);
          }
        } catch {
          session.close();
          socket.close(1008, 'Invalid voice message');
        }
      });
      socket.on('close', () => {
        session.close();
        if (sessions.get(key)?.close === close) sessions.delete(key);
      });
      socket.on('error', () => session.close());
      const close = () => {
        session.close();
        socket.close(1000, 'Replaced voice connection');
      };
      void identity()
        .then(async (principal) => {
          if (socket.readyState !== 1) return;
          key = `${principal.owner_id}:${request.params.id}`;
          sessions.get(key)?.close();
          sessions.set(key, { close });
          await session.start();
        })
        .catch(() => {
          if (socket.readyState === 1)
            socket.send(
              JSON.stringify({
                type: 'error',
                code: 'voice_connect_failed',
                message: '无法连接语音服务，请检查语音配置并重新连接。',
                retryable: true,
              }),
            );
          session.close();
          socket.close(1011, 'Voice connection failed');
        });
    },
  );
}
