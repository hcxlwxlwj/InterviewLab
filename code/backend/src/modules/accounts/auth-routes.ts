import { z } from 'zod';
import type { AuthSession, SignInInput, SignUpInput } from '@interviewlab/core';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { errorSchema } from '../../foundation/schemas';
import { unavailable } from '../../foundation/errors';
import type { AuthService } from './auth-service';

const sessionSchema = z.object({
  user: z.object({ id: z.string(), name: z.string(), email: z.email() }),
  roles: z.array(z.enum(['student', 'content_maintainer', 'operator'])),
  expires_at: z.iso.datetime(),
}) satisfies z.ZodType<AuthSession>;
export const signInSchema = z.strictObject({
  email: z
    .email()
    .max(254)
    .transform((email) => email.toLowerCase()),
  password: z.string().min(1).max(128),
  rememberMe: z.boolean().optional(),
}) satisfies z.ZodType<SignInInput>;
export const signUpSchema = z.strictObject({
  name: z.string().trim().min(1).max(100),
  email: z
    .email()
    .max(254)
    .transform((email) => email.toLowerCase()),
  password: z.string().min(12).max(128),
}) satisfies z.ZodType<SignUpInput>;

export async function registerAuthRoutes(instance: FastifyInstance, auth?: AuthService) {
  const app = instance.withTypeProvider<ZodTypeProvider>();
  const errors = {
    400: errorSchema,
    401: errorSchema,
    403: errorSchema,
    409: errorSchema,
    429: errorSchema,
    501: errorSchema,
    503: errorSchema,
  };
  app.get(
    '/auth/session',
    {
      schema: {
        tags: ['authentication'],
        response: { 200: sessionSchema.nullable(), 501: errorSchema, 503: errorSchema },
      },
    },
    async (request) => {
      if (!auth) throw unavailable('Authentication');
      return auth.session(request.headers);
    },
  );
  app.post(
    '/auth/sign-up/email',
    {
      schema: {
        tags: ['authentication'],
        body: signUpSchema,
        response: { 200: z.object({ success: z.literal(true) }), ...errors },
      },
    },
    async (request, reply) => {
      if (!auth) throw unavailable('Authentication');
      const cookies = await auth.signUp(request, request.body);
      if (cookies.length) reply.header('set-cookie', cookies);
      return { success: true as const };
    },
  );
  app.post(
    '/auth/sign-in/email',
    {
      schema: {
        tags: ['authentication'],
        body: signInSchema,
        response: { 200: z.object({ success: z.literal(true) }), ...errors },
      },
    },
    async (request, reply) => {
      if (!auth) throw unavailable('Authentication');
      const cookies = await auth.signIn(request, request.body);
      if (cookies.length) reply.header('set-cookie', cookies);
      return { success: true as const };
    },
  );
  app.post(
    '/auth/sign-out',
    {
      schema: {
        tags: ['authentication'],
        body: z.strictObject({}),
        response: { 200: z.object({ success: z.literal(true) }), ...errors },
      },
    },
    async (request, reply) => {
      if (!auth) throw unavailable('Authentication');
      const cookies = await auth.signOut(request);
      if (cookies.length) reply.header('set-cookie', cookies);
      return { success: true as const };
    },
  );
}
