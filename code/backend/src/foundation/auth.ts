import type { RequestIdentity } from '@interviewlab/core';
import type { FastifyRequest } from 'fastify';
import { ServiceError, unavailable } from './errors';

/** Better Auth integration belongs here; arbitrary request headers never establish identity. */
export interface IdentityProvider {
  authenticate(headers: FastifyRequest['headers']): Promise<RequestIdentity | null>;
}
export async function requireIdentity(request: FastifyRequest, provider?: IdentityProvider) {
  if (!provider) throw unavailable('Authentication');
  const identity = await provider.authenticate(request.headers);
  if (!identity) throw new ServiceError('unauthorized', 401, 'Sign in required');
  return identity;
}
export function requireSameOrigin(request: FastifyRequest, trustedOrigin: string) {
  if (request.headers.origin !== trustedOrigin)
    throw new ServiceError('forbidden', 403, 'Same-origin request required');
}
