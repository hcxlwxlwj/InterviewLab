import test from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import { validatorCompiler, serializerCompiler } from 'fastify-type-provider-zod';
import WebSocket from 'ws';
import { registerVoiceRoutes } from '../../code/backend/src/modules/interviews/voice/routes';
import type { LiveInterviewsService } from '../../code/backend/src/modules/interviews/service';
import { loadConfig } from '../../code/backend/src/foundation/config';
import { installErrorHandler, ServiceError } from '../../code/backend/src/foundation/errors';
import { voiceFixture, waitFor } from '../support/voice-fixture';

test('real voice WebSocket enforces cookie identity, resource ownership, Origin, bounded frames and cancellation', async (t) => {
  const f = voiceFixture();
  const app = Fastify();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  installErrorHandler(app);
  await app.register(websocket, { options: { maxPayload: 16384 } });
  await app.register(
    async (scope) => {
      registerVoiceRoutes(
        scope,
        {
          async requireIdentity(request) {
            if (request.headers.cookie === 'session=owner')
              return { owner_id: 'voice-owner', roles: [] };
            if (request.headers.cookie === 'session=other')
              return { owner_id: 'other-owner', roles: [] };
            throw new ServiceError('unauthorized', 401, 'Sign in required');
          },
          requireRole() {},
        },
        () => f.service as LiveInterviewsService,
        {
          config: loadConfig({ VOICE_ENABLED: 'true', LOG_LEVEL: 'silent' }),
          provider: f.provider,
        },
      );
    },
    { prefix: '/api/v1' },
  );
  const address = await app.listen({ host: '127.0.0.1', port: 0 });
  t.after(() => app.close());
  const path = `/api/v1/interviews/${f.id}/voice`;
  assert.equal((await app.inject(path + '/capabilities')).statusCode, 401);
  assert.equal(
    (await app.inject({ url: path + '/capabilities', headers: { cookie: 'session=other' } }))
      .statusCode,
    404,
  );
  const capable = await app.inject({
    url: path + '/capabilities',
    headers: { cookie: 'session=owner' },
  });
  assert.equal(capable.json().available, true);
  async function rejected(headers: Record<string, string>, expected: number) {
    await new Promise<void>((resolve, reject) => {
      const socket = new WebSocket(address.replace('http:', 'ws:') + path, { headers });
      socket.on('error', () => {});
      socket.on('unexpected-response', (_request, response) => {
        try {
          assert.equal(response.statusCode, expected);
          response.resume();
          socket.terminate();
          resolve();
        } catch (error) {
          socket.terminate();
          reject(error);
        }
      });
      socket.on('open', () => {
        socket.terminate();
        reject(new Error('Unauthorized upgrade succeeded'));
      });
    });
  }
  await rejected({ origin: 'https://untrusted.invalid', cookie: 'session=owner' }, 403);
  await rejected({ origin: 'http://127.0.0.1:3000' }, 401);
  await rejected({ origin: 'http://127.0.0.1:3000', cookie: 'session=other' }, 404);
  const events: { type: string }[] = [];
  const socket = new WebSocket(address.replace('http:', 'ws:') + path, {
    headers: { origin: 'http://127.0.0.1:3000', cookie: 'session=owner' },
  });
  t.after(() => socket.terminate());
  socket.on('message', (raw) => events.push(JSON.parse(raw.toString())));
  await waitFor(() => events.some((e) => e.type === 'ready'));
  socket.send(Buffer.alloc(6400));
  await waitFor(() => f.metrics().audioBytes === 6400);
  socket.send(JSON.stringify({ type: 'speech_start' }));
  await waitFor(() => f.speeches[0].signal.aborted);
  const closed = new Promise<number>((resolve) => socket.on('close', resolve));
  socket.send(
    JSON.stringify({ type: 'playback', speech_id: 'invalid', played_ms: -1, interrupted: true }),
  );
  assert.equal(await closed, 1008);
  assert.ok(f.metrics().closes > 0);
});
