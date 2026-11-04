import { extractPdf } from './pdf';
import { z } from 'zod';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import type { BackendModule } from '../contracts';
import type { MaterialsService } from './service';
import { unavailable } from '../../foundation/errors';
const input = z
  .object({
    kind: z.enum(['resume', 'experience']),
    title: z.string().trim().min(1).max(200),
    text: z.string().trim().max(100000),
    confirmed: z.boolean(),
    structure: z.object({full_name:z.string().max(15000),phone:z.string().max(15000),email:z.string().max(15000),city:z.string().max(15000),education:z.string().max(15000),skills:z.string().max(15000),projects:z.string().max(15000),internships:z.string().max(15000),awards:z.string().max(15000),summary:z.string().max(15000)}).optional(),
  })
  .strict();
const material = input.extend({
  id: z.string().uuid(),
  version: z.number().int().positive(),
  created_at: z.string(),
});
const params = z.object({ id: z.string().uuid() });
export function materialsModule(service?: MaterialsService): BackendModule {
  return {
    name: 'resumes',
    async register(instance, context) {
      const app = instance.withTypeProvider<ZodTypeProvider>();
      app.post(
        '/materials/import-pdf',
        {
          bodyLimit: 8 * 1024 * 1024,
          schema: {
            body: z
              .object({
                data: z
                  .string()
                  .min(1)
                  .max(7 * 1024 * 1024),
              })
              .strict(),
            response: { 200: z.object({ text: z.string() }) },
          },
        },
        async (request) => {
          await context.requireIdentity(request);
          return { text: await extractPdf(request.body.data) };
        },
      );
      const get = () => {
        if (!service) throw unavailable('Database');
        return service;
      };
      app.get('/materials', { schema: { response: { 200: z.array(material) } } }, async (request) =>
        get().list((await context.requireIdentity(request)).owner_id),
      );
      app.get(
        '/materials/:id/versions',
        { schema: { params, response: { 200: z.array(material) } } },
        async (request) =>
          get().versions((await context.requireIdentity(request)).owner_id, request.params.id),
      );
      app.post(
        '/materials',
        { schema: { body: input, response: { 200: material } } },
        async (request) =>
          get().save((await context.requireIdentity(request)).owner_id, request.body),
      );
      app.put(
        '/materials/:id',
        {
          schema: {
            params,
            body: input.extend({ expected_version: z.number().int().positive() }),
            response: { 200: material },
          },
        },
        async (request) =>
          get().save(
            (await context.requireIdentity(request)).owner_id,
            request.body,
            request.params.id,
            request.body.expected_version,
          ),
      );
      app.delete(
        '/materials/:id',
        { schema: { params, response: { 200: z.object({ success: z.boolean() }) } } },
        async (request) => {
          await get().remove((await context.requireIdentity(request)).owner_id, request.params.id);
          return { success: true };
        },
      );
    },
  };
}
