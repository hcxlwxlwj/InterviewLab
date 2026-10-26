import { z } from 'zod';
import type { BackendModule } from '../contracts';
import type { LiveReportsService } from './service';
import { idParams, privateErrors, writeHeaders } from '../interviews/routes';
import { comparisonBody, comparisonSchema, reportSchema, versionBody } from '../interviews/schemas';
import { ServiceError } from '../../foundation/errors';

export function reportsModule(service?: LiveReportsService): BackendModule {
  return {
    name: 'reports',
    async register(app, context) {
      app.addHook('preHandler', async (request) => {
        await context.requireIdentity(request);
      });
      const ready = () => {
        if (!service) throw new ServiceError('capability_unavailable', 501, '报告数据库尚未接入');
        return service;
      };
      app.get<{ Params: { id: string } }>(
        '/interviews/:id/report',
        {
          schema: {
            tags: ['reports'],
            params: idParams,
            response: { 200: reportSchema, ...privateErrors },
          },
        },
        async (request) => ready().get(await context.requireIdentity(request), request.params.id),
      );
      app.post<{ Params: { id: string }; Body: { version: number } }>(
        '/interviews/:id/report',
        {
          schema: {
            tags: ['reports'],
            params: idParams,
            headers: writeHeaders,
            body: versionBody,
            response: { 200: reportSchema, 202: reportSchema, ...privateErrors },
          },
        },
        async (request, reply) => {
          const result = await ready().request(
            await context.requireIdentity(request),
            request.params.id,
            request.body,
            request.headers['idempotency-key'] as string,
          );
          return reply
            .code(['pending', 'generating'].includes(result.status) ? 202 : 200)
            .send(result);
        },
      );
      app.post<{ Body: z.infer<typeof comparisonBody> }>(
        '/comparisons',
        {
          schema: {
            tags: ['reports'],
            headers: writeHeaders,
            body: comparisonBody,
            response: { 202: comparisonSchema, ...privateErrors },
          },
        },
        async (request, reply) =>
          reply
            .code(202)
            .send(
              await ready().createComparison(
                await context.requireIdentity(request),
                request.body,
                request.headers['idempotency-key'] as string,
              ),
            ),
      );
      app.get<{ Params: { id: string } }>(
        '/comparisons/:id',
        {
          schema: {
            tags: ['reports'],
            params: idParams,
            response: { 200: comparisonSchema, ...privateErrors },
          },
        },
        async (request) =>
          ready().getComparison(await context.requireIdentity(request), request.params.id),
      );
      app.post<{ Params: { id: string }; Body: { version: number } }>(
        '/comparisons/:id/retry',
        {
          schema: {
            tags: ['reports'],
            params: idParams,
            headers: writeHeaders,
            body: versionBody,
            response: { 202: comparisonSchema, ...privateErrors },
          },
        },
        async (request, reply) =>
          reply
            .code(202)
            .send(
              await ready().retryComparison(
                await context.requireIdentity(request),
                request.params.id,
                request.body,
                request.headers['idempotency-key'] as string,
              ),
            ),
      );
    },
  };
}
