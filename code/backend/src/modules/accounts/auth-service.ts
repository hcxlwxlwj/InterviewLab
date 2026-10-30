import { betterAuth } from 'better-auth/minimal';
import { drizzleAdapter } from '@better-auth/drizzle-adapter';
import type { AuthSession, SignInInput, SignUpInput } from '@interviewlab/core';
import { eq } from 'drizzle-orm';
import type { FastifyRequest } from 'fastify';
import type { IdentityProvider } from '../../foundation/auth';
import type { BackendConfig } from '../../foundation/config';
import type { Database } from '../../database/connection';
import { ServiceError } from '../../foundation/errors';
import { authAccount, authRateLimit, authSession, authUser, authVerification } from './auth-schema';

export function createAuthService(database: Database, config: BackendConfig) {
  if (!config.AUTH_ENABLED || !config.BETTER_AUTH_SECRET)
    throw new Error('Authentication is not configured');
  const auth = betterAuth({
    appName: 'InterviewLab',
    baseURL: config.PUBLIC_ORIGIN,
    basePath: '/api/v1/auth',
    secret: config.BETTER_AUTH_SECRET,
    database: drizzleAdapter(database.db, {
      provider: 'pg',
      transaction: true,
      schema: {
        user: authUser,
        session: authSession,
        account: authAccount,
        verification: authVerification,
        rateLimit: authRateLimit,
      },
    }),
    emailAndPassword: {
      enabled: true,
      disableSignUp: false,
      autoSignIn: true,
      minPasswordLength: 12,
      maxPasswordLength: 128,
    },
    trustedOrigins: [config.PUBLIC_ORIGIN],
    user: {
      additionalFields: {
        role: {
          type: ['student', 'content_maintainer', 'operator'],
          defaultValue: 'student',
          input: false,
        },
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      disableSessionRefresh: true,
      cookieCache: { enabled: false },
    },
    advanced: {
      cookiePrefix: 'interviewlab',
      useSecureCookies: config.PUBLIC_ORIGIN.startsWith('https://'),
      defaultCookieAttributes: { httpOnly: true, sameSite: 'lax', path: '/' },
      ipAddress: { ipAddressHeaders: ['x-interviewlab-client-ip'] },
    },
    rateLimit: {
      enabled: true,
      storage: 'database',
      window: 60,
      max: 100,
      customRules: {
        '/sign-in/email': { window: 60, max: 10 },
        '/sign-up/email': { window: 60, max: 5 },
      },
    },
    // Provider failures may contain private data. Our HTTP layer logs only a safe error type.
    logger: { disabled: true },
    telemetry: { enabled: false },
  });
  const session = async (headers: FastifyRequest['headers']): Promise<AuthSession | null> => {
    const cookieHeaders = new Headers();
    if (headers.cookie) cookieHeaders.set('cookie', headers.cookie);
    try {
      const result = await auth.api.getSession({
        headers: cookieHeaders,
        query: { disableCookieCache: true },
      });
      if (!result) return null;
      return {
        user: { id: result.user.id, name: result.user.name, email: result.user.email },
        roles: [result.user.role],
        expires_at: result.session.expiresAt.toISOString(),
      };
    } catch {
      throw new ServiceError(
        'dependency_unavailable',
        503,
        'Authentication is temporarily unavailable',
        true,
      );
    }
  };
  const invoke = async (
    path: 'sign-in/email' | 'sign-up/email' | 'sign-out',
    request: FastifyRequest,
    body: unknown,
  ) => {
    const headers = new Headers({
      'content-type': 'application/json',
      'x-interviewlab-client-ip': request.ip,
    });
    if (request.headers.cookie) headers.set('cookie', request.headers.cookie);
    if (request.headers.origin) headers.set('origin', request.headers.origin);
    let response: Response;
    try {
      response = await auth.handler(
        new Request(`${config.PUBLIC_ORIGIN}/api/v1/auth/${path}`, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        }),
      );
    } catch {
      throw new ServiceError(
        'dependency_unavailable',
        503,
        'Authentication is temporarily unavailable',
        true,
      );
    }
    if (!response.ok) {
      const status = response.status;
      if (path === 'sign-up/email' && status === 422) {
        // Concurrent signups can hit the unique constraint inside Better Auth's transaction.
        const result = (await response.json().catch(() => null)) as { code?: string } | null;
        if (result?.code === 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL')
          throw new ServiceError('email_already_exists', 409, '该邮箱已注册，请登录。');
        if (result?.code === 'FAILED_TO_CREATE_USER') {
          try {
            const existing = await database.db
              .select({ id: authUser.id })
              .from(authUser)
              .where(eq(authUser.email, (body as SignUpInput).email))
              .limit(1);
            if (existing.length)
              throw new ServiceError('email_already_exists', 409, '该邮箱已注册，请登录。');
          } catch (error) {
            if (error instanceof ServiceError) throw error;
          }
          throw new ServiceError(
            'dependency_unavailable',
            503,
            '注册暂时不可用，请稍后重试。',
            true,
          );
        }
      }
      if (status === 401)
        throw new ServiceError('unauthorized', 401, 'Email or password is incorrect');
      if (status === 429)
        throw new ServiceError('rate_limited', 429, 'Too many attempts; try again later', true);
      if (status === 403)
        throw new ServiceError('forbidden', 403, 'Authentication request forbidden');
      if (status >= 500)
        throw new ServiceError(
          'dependency_unavailable',
          503,
          'Authentication is temporarily unavailable',
          true,
        );
      throw new ServiceError('unsupported_input', 400, 'Invalid authentication request');
    }
    // Never return Better Auth's token-bearing JSON to the browser.
    return response.headers.getSetCookie();
  };
  return {
    session,
    authenticate: async (headers) => {
      const current = await session(headers);
      return current ? { owner_id: current.user.id, roles: current.roles } : null;
    },
    signIn: (request: FastifyRequest, input: SignInInput) =>
      invoke('sign-in/email', request, input),
    signUp: (request: FastifyRequest, input: SignUpInput) =>
      invoke('sign-up/email', request, input),
    signOut: (request: FastifyRequest) => invoke('sign-out', request, {}),
  } satisfies IdentityProvider & Record<string, unknown>;
}
export type AuthService = ReturnType<typeof createAuthService>;
