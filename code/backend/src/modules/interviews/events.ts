import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import type { ModuleContext } from '../contracts';
import type { LiveInterviewsService } from './service';
import { interviewConfigSchema } from './schemas';
import { errorSchema } from '../../foundation/schemas';
export function registerInterviewEvents(
  app: FastifyInstance,
  context: ModuleContext,
  ready: () => LiveInterviewsService,
) {
  app.get(
    '/interview-profiles',
    {
      schema: {
        tags: ['interviews'],
        querystring: interviewConfigSchema.pick({ job: true, career_stage: true }),
        response: {
          200: z.object({
            version: z.string(),
            default_type: z.string(),
            profiles: z.array(
              z.object({
                id: z.string(),
                version: z.string(),
                type: z.string(),
                label: z.string(),
                goals: z.array(z.string()),
              }),
            ),
          }),
          401: errorSchema,
          503: errorSchema,
        },
      },
    },
    async (request) => {
      const query = request.query as { job: string; career_stage: 'internship' | 'campus' };
      return (
        (await ready().profiles(query)) ?? {
          version: 'legacy-v2',
          default_type: 'technical_qa',
          profiles: [],
        }
      );
    },
  );
  app.get<{ Params: { id: string }; Querystring: { generation_id: string } }>(
    '/interviews/:id/events',
    {
      schema: {
        tags: ['interviews'],
        params: z.object({ id: z.uuid() }),
        querystring: z.object({ generation_id: z.uuid() }),
        response: { 401: errorSchema, 404: errorSchema },
      },
    },
    async (request, reply) => {
      const service = ready();
      const initial = await context.requireIdentity(request);
      await service.read(initial, request.params.id);
      let closed = false,
        working = false,
        dirty = false,
        unsubscribe: (() => void) | undefined;
      let heartbeat: ReturnType<typeof setInterval> | undefined;
      let last = '';
      const close = () => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        unsubscribe?.();
        if (!reply.raw.writableEnded) reply.raw.end();
      };
      const send = (type: string, value: unknown) => {
        if (closed || reply.raw.destroyed) return;
        const ok = reply.raw.write(`event: ${type}\ndata: ${JSON.stringify(value)}\n\n`);
        if (!ok) close();
      };
      const refresh = async () => {
        if (working) {
          dirty = true;
          return;
        }
        working = true;
        try {
          do {
            dirty = false;
            if (closed) return;
            const identity = await context.requireIdentity(request);
            if (identity.owner_id !== initial.owner_id) {
              send('invalidated', {});
              close();
              return;
            }
            const view = await service.read(identity, request.params.id);
            if (
              view.generation_id !== request.query.generation_id ||
              view.status !== 'in_progress'
            ) {
              send('invalidated', {});
              close();
              return;
            }
            if (view.generation_status === 'failed') {
              send('failed', {});
              close();
              return;
            }
            if (view.generation_status !== 'pending') {
              send('committed', { interview: view });
              close();
              return;
            }
            const preview = await service.streams.read(view.id, request.query.generation_id);
            if (preview) {
              const value = JSON.stringify(preview);
              if (last !== value) {
                last = value;
                send('question_delta', { generation_id: view.generation_id, ...preview });
              }
            }
          } while (dirty && !closed);
        } catch {
          send('invalidated', {});
          close();
        } finally {
          working = false;
        }
      };
      unsubscribe = await service.streams.subscribe(request.params.id, () => {
        void refresh();
      });
      if (reply.raw.destroyed) {
        unsubscribe();
        return;
      }
      reply.hijack();
      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-store, no-transform',
        'X-Accel-Buffering': 'no',
        Connection: 'keep-alive',
        'X-Content-Type-Options': 'nosniff',
        'X-Request-Id': request.id,
      });
      reply.raw.on('close', close);
      send('status', { generation_id: request.query.generation_id, state: 'pending' });
      heartbeat = setInterval(() => {
        void refresh().then(() => {
          if (!closed) reply.raw.write(': heartbeat\n\n');
        });
      }, 5000);
      await refresh();
    },
  );
}
