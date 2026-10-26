import { z } from 'zod';
import type { Interview, RequestIdentity } from '@interviewlab/core';
import type { BackendModule } from '../contracts';
import { errorSchema, pageSchema } from '../../foundation/schemas';
import type { LiveInterviewsService } from './service';
import * as s from './schemas';
import { registerInterviewEvents } from './events';
import { ServiceError } from '../../foundation/errors';

export const privateErrors = {
  400: errorSchema,
  401: errorSchema,
  403: errorSchema,
  404: errorSchema,
  409: errorSchema,
  501: errorSchema,
  503: errorSchema,
};
export const idParams = z.object({ id: z.string().uuid() });
export const writeHeaders = z
  .object({ 'idempotency-key': z.string().min(1).max(128) })
  .passthrough();
export function interviewsModule(service?: LiveInterviewsService): BackendModule {
  return {
    name: 'interviews',
    async register(app, context) {
      app.addHook('preHandler', async (request) => {
        await context.requireIdentity(request);
      });
      const ready = () => {
        if (!service) throw new ServiceError('capability_unavailable', 501, '面试数据库尚未接入');
        return service;
      };
      registerInterviewEvents(app, context, ready);
      app.get<{ Querystring: { limit: number; cursor?: string; job?: string; status?: string } }>(
        '/interviews',
        {
          schema: {
            tags: ['interviews'],
            querystring: z.object({
              limit: z.coerce.number().int().min(1).max(50).default(20),
              cursor: z.string().max(2000).optional(),
              job: z.string().max(100).optional(),
              status: z
                .enum(['draft', 'ready', 'in_progress', 'paused', 'ending', 'completed', 'failed'])
                .optional(),
            }),
            response: { 200: pageSchema(s.interviewSchema), ...privateErrors },
          },
        },
        async (request) => ready().list(await context.requireIdentity(request), request.query),
      );
      app.post<{ Body: z.infer<typeof s.interviewConfigSchema> }>(
        '/interviews',
        {
          schema: {
            tags: ['interviews'],
            body: s.interviewConfigSchema,
            headers: writeHeaders,
            response: { 201: s.interviewSchema, ...privateErrors },
          },
        },
        async (request, reply) =>
          reply
            .code(201)
            .send(
              await ready().create(
                await context.requireIdentity(request),
                request.body,
                request.headers['idempotency-key'] as string,
              ),
            ),
      );
      app.get<{ Params: { id: string } }>(
        '/interviews/:id',
        {
          schema: {
            tags: ['interviews'],
            params: idParams,
            response: { 200: s.interviewSchema, ...privateErrors },
          },
        },
        async (request) => ready().read(await context.requireIdentity(request), request.params.id),
      );
      function command<B>(
        path: string,
        body: z.ZodType<B>,
        run: (identity: RequestIdentity, id: string, body: B, key: string) => Promise<Interview>,
        method: 'post' | 'patch' = 'post',
      ) {
        app.route<{ Params: { id: string }; Body: B }>({
          method: method.toUpperCase() as 'POST' | 'PATCH',
          url: `/interviews/:id${path}`,
          schema: {
            tags: ['interviews'],
            params: idParams,
            body,
            headers: writeHeaders,
            response: { 200: s.interviewSchema, 202: s.interviewSchema, ...privateErrors },
          },
          handler: async (request, reply) => {
            const principal = await context.requireIdentity(request);
            ready();
            const result = await run(
              principal,
              request.params.id,
              request.body as B,
              request.headers['idempotency-key'] as string,
            );
            return reply.code(result.generation_status === 'pending' ? 202 : 200).send(result);
          },
        });
      }
      command(
        '',
        s.versionBody.extend({ configuration: s.interviewConfigSchema }),
        (...args) => ready().patch(...args),
        'patch',
      );
      command('/start', s.versionBody, (...args) => ready().start(...args));
      command('/pause', s.versionBody, (...args) => ready().pause(...args));
      command('/resume', s.versionBody, (...args) => ready().resume(...args));
      command('/finish', s.finishBody, (...args) => ready().finish(...args));
      command('/generation/retry', s.retryGenerationBody, (...args) =>
        ready().retryGeneration(...args),
      );
      app.get<{ Params: { id: string }; Querystring: { limit: number; cursor?: string } }>(
        '/interviews/:id/turns',
        {
          schema: {
            tags: ['interviews'],
            params: idParams,
            querystring: z.object({
              limit: z.coerce.number().int().min(1).max(50).default(20),
              cursor: z.string().max(1000).optional(),
            }),
            response: { 200: pageSchema(s.turnSchema), ...privateErrors },
          },
        },
        async (request) => {
          const interview = await ready().read(
            await context.requireIdentity(request),
            request.params.id,
          );
          let index = 0;
          if (request.query.cursor) {
            try {
              const c = JSON.parse(Buffer.from(request.query.cursor, 'base64url').toString());
              if (
                c.id !== interview.id ||
                c.version !== interview.version ||
                !Number.isInteger(c.index) ||
                c.index < 0 ||
                c.index > interview.turns.length
              )
                throw new Error();
              index = c.index;
            } catch {
              throw new ServiceError('unsupported_input', 400, '回合游标无效或已过期');
            }
          }
          const items = interview.turns.slice(index, index + request.query.limit);
          const next = index + items.length;
          return {
            items,
            next_cursor:
              next < interview.turns.length
                ? Buffer.from(
                    JSON.stringify({ id: interview.id, version: interview.version, index: next }),
                  ).toString('base64url')
                : null,
          };
        },
      );
      function turnCommand<B>(
        path: string,
        body: z.ZodType<B>,
        run: (
          identity: RequestIdentity,
          id: string,
          turnId: string,
          body: B,
          key: string,
        ) => Promise<Interview>,
      ) {
        app.post<{ Params: { id: string; turn_id: string }; Body: B }>(
          `/interviews/:id/turns/:turn_id/${path}`,
          {
            schema: {
              tags: ['interviews'],
              params: idParams.extend({ turn_id: z.string().uuid() }),
              body,
              headers: writeHeaders,
              response: { 200: s.interviewSchema, 202: s.interviewSchema, ...privateErrors },
            },
          },
          async (request, reply) => {
            const principal = await context.requireIdentity(request);
            ready();
            const result = await run(
              principal,
              request.params.id,
              request.params.turn_id,
              request.body as B,
              request.headers['idempotency-key'] as string,
            );
            return reply.code(result.generation_status === 'pending' ? 202 : 200).send(result);
          },
        );
      }
      turnCommand('answer', s.answerBody, (...args) => ready().answer(...args));
      turnCommand('actions', s.actionBody, (...args) => ready().action(...args));
      turnCommand('presented', s.versionBody, (...args) => ready().presented(...args));
      app.post<{ Params: { id: string }; Body: z.infer<typeof s.retryBody> }>(
        '/interviews/:id/retries',
        {
          schema: {
            tags: ['interviews'],
            params: idParams,
            body: s.retryBody,
            headers: writeHeaders,
            response: { 201: s.interviewSchema, ...privateErrors },
          },
        },
        async (request, reply) =>
          reply
            .code(201)
            .send(
              await ready().createRetry(
                await context.requireIdentity(request),
                request.params.id,
                request.body,
                request.headers['idempotency-key'] as string,
              ),
            ),
      );
      app.delete<{ Params: { id: string }; Body: { version: number } }>(
        '/interviews/:id',
        {
          schema: {
            tags: ['interviews'],
            params: idParams,
            body: s.versionBody,
            headers: writeHeaders,
            response: { ...privateErrors },
          },
        },
        async (request, reply) => {
          await ready().delete(
            await context.requireIdentity(request),
            request.params.id,
            request.body,
            request.headers['idempotency-key'] as string,
          );
          return reply.code(204).send();
        },
      );
    },
  };
}
