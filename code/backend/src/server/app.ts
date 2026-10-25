import { randomUUID } from 'node:crypto';
import Fastify from 'fastify';
import swagger from '@fastify/swagger';
import {
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { CapabilityView } from '@interviewlab/core';
import { loadConfig, type BackendConfig } from '../foundation/config';
import { installErrorHandler, unavailable } from '../foundation/errors';
import { requireIdentity, type IdentityProvider } from '../foundation/auth';
import { createDatabase, type Database } from '../database/connection';
import { errorSchema, taskViewSchema } from '../foundation/schemas';
import { createTaskService } from '../tasks/service';
import { publicCatalogRepository } from '../modules/jobs/repository';
import { createJobsService } from '../modules/jobs/service';
import { jobsModule } from '../modules/jobs/routes';
import { validateModules, type BackendModule, type ServiceRegistry } from '../modules/contracts';

export interface ApplicationOptions {
  config?: BackendConfig;
  database?: Database;
  identity?: IdentityProvider;
  services?: ServiceRegistry;
  modules?: BackendModule[];
  logger?: boolean;
}
export async function buildApp(options: ApplicationOptions = {}) {
  const config = options.config ?? loadConfig();
  const database = options.database ?? (config.DATABASE_URL ? createDatabase(config) : undefined);
  const identity = options.identity ?? options.services?.accounts;
  const app = Fastify({
    logger:
      options.logger === false
        ? false
        : {
            level: config.LOG_LEVEL,
            redact: ['req.headers.authorization', 'req.headers.cookie', 'res.headers.set-cookie'],
            serializers: {
              req: (request) => ({ method: request.method, path: request.url?.split('?')[0] }),
            },
          },
    bodyLimit: config.BODY_LIMIT_BYTES,
    requestTimeout: 30000,
    genReqId: () => randomUUID(),
    // Do not trust arbitrary client request IDs or forwarded headers.
    trustProxy: false,
  });
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  installErrorHandler(app);
  app.addHook('onRequest', async (_request, reply) => {
    reply.header('X-InterviewLab-Mode', 'backend-foundation');
    reply.header('Cache-Control', 'no-store');
    reply.header('X-Content-Type-Options', 'nosniff');
  });
  app.addHook('onSend', async (request, reply) => {
    reply.header('X-Request-Id', request.id);
  });
  if (database && !options.database) app.addHook('onClose', () => database.close());

  try {
    await app.register(swagger, {
      openapi: {
        openapi: '3.0.3',
        info: {
          title: 'InterviewLab Backend',
          version: '0.2.0',
          description:
            'Implemented foundation routes only. Synthetic prototype routes are separate.',
        },
      },
      transform: jsonSchemaTransform,
    });
    const modules = [
      jobsModule(createJobsService(publicCatalogRepository)),
      ...(options.modules ?? []),
    ];
    validateModules(modules);
    await app.register(
      async (instance) => {
        const api = instance.withTypeProvider<ZodTypeProvider>();
        const readiness = () =>
          database?.ready(config.WORKER_STALE_MS) ??
          Promise.resolve({ database: false, worker: false });
        api.get(
          '/health',
          {
            schema: {
              tags: ['runtime'],
              response: { 200: z.object({ status: z.literal('ok') }) },
            },
          },
          async () => ({ status: 'ok' as const }),
        );
        const readinessSchema = z.object({
          status: z.enum(['ready', 'not_ready']),
          database: z.boolean(),
          worker: z.boolean(),
        });
        api.get(
          '/health/ready',
          {
            schema: {
              tags: ['runtime'],
              response: { 200: readinessSchema, 503: readinessSchema },
            },
          },
          async (_request, reply) => {
            const result = await readiness();
            const ready = result.database && result.worker;
            return reply
              .code(ready ? 200 : 503)
              .send({ status: ready ? 'ready' : 'not_ready', ...result });
          },
        );
        const capabilitySchema = z.object({
          database: z.boolean(),
          worker: z.boolean(),
          authentication: z.boolean(),
          llm: z.boolean(),
          private_storage: z.boolean(),
        }) satisfies z.ZodType<CapabilityView>;
        api.get(
          '/capabilities',
          { schema: { tags: ['runtime'], response: { 200: capabilitySchema } } },
          async () => ({
            ...(await readiness()),
            authentication: Boolean(identity),
            llm: false,
            private_storage: false,
          }),
        );
        api.get(
          '/tasks/:id',
          {
            schema: {
              tags: ['tasks'],
              params: z.object({ id: z.string().uuid() }),
              response: {
                200: taskViewSchema,
                400: errorSchema,
                401: errorSchema,
                404: errorSchema,
                501: errorSchema,
              },
            },
          },
          async (request) => {
            const principal = await requireIdentity(request, identity);
            if (!database) throw unavailable('Database');
            return createTaskService(database).get(principal, request.params.id);
          },
        );
        // The API factory registers only supplied module implementations.
        for (const module of modules) {
          await instance.register(async (scope) => module.register(scope));
        }
        if (config.NODE_ENV === 'development') {
          api.get('/openapi.json', { schema: { hide: true } }, async () => app.swagger());
        }
      },
      { prefix: '/api/v1' },
    );
    await app.ready();
    return app;
  } catch (error) {
    await app.close();
    throw error;
  }
}
