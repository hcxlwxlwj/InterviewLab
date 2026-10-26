import type { AuthSession } from '@interviewlab/core';

/** Only the loopback interview launcher supplies this server-side development identity. */
export function interviewDevelopmentSession(
  env: Record<string, string | undefined>,
): AuthSession | undefined {
  const owner = env.INTERVIEW_DEV_OWNER_ID?.trim();
  if (env.NODE_ENV !== 'development' || !owner) return undefined;
  return {
    user: { id: owner, name: '面试流程联调', email: 'local@interview.invalid' },
    roles: ['student'],
    expires_at: new Date(Date.now() + 86400000).toISOString(),
  };
}
