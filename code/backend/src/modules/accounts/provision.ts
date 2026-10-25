import { randomUUID } from 'node:crypto';
import { hashPassword } from 'better-auth/crypto';
import { z } from 'zod';
import type { Database } from '../../database/connection';
import { auditEvents } from '../../database/schema';
import { authAccount, authUser } from './auth-schema';

const invitationSchema = z.strictObject({
  email: z
    .email()
    .max(254)
    .transform((email) => email.toLowerCase()),
  name: z.string().trim().min(1).max(100),
  password: z.string().min(12).max(128),
  role: z.enum(['student', 'content_maintainer', 'operator']).default('student'),
});
/** Local administrative command only. Never register this operation as a public route. */
export async function createInvitedUser(
  database: Database,
  input: z.input<typeof invitationSchema>,
) {
  const value = invitationSchema.parse(input);
  const password = await hashPassword(value.password);
  const id = randomUUID();
  await database.transaction(async (tx) => {
    await tx.db
      .insert(authUser)
      .values({ id, email: value.email, name: value.name, role: value.role });
    await tx.db
      .insert(authAccount)
      .values({ id: randomUUID(), userId: id, accountId: id, providerId: 'credential', password });
    await tx.db
      .insert(auditEvents)
      .values({
        id: randomUUID(),
        owner_id: 'local-administrator',
        action: 'accounts.invite',
        resource_id: id,
        request_id: randomUUID(),
        outcome: 'succeeded',
      });
  });
  return { id, email: value.email, name: value.name, role: value.role };
}
