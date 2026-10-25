import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import type { MemberRole } from '@interviewlab/core';

const date = (name: string) => timestamp(name, { withTimezone: true }).notNull().defaultNow();
export const authUser = pgTable(
  'auth_users',
  {
    id: text().primaryKey(),
    name: text().notNull(),
    email: text().notNull().unique(),
    emailVerified: boolean('email_verified').notNull().default(false),
    image: text(),
    role: text().$type<MemberRole>().notNull().default('student'),
    createdAt: date('created_at'),
    updatedAt: date('updated_at'),
  },
  () => [check('auth_role_check', sql.raw("role IN ('student','content_maintainer','operator')"))],
);
export const authSession = pgTable(
  'auth_sessions',
  {
    id: text().primaryKey(),
    token: text().notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => authUser.id, { onDelete: 'cascade' }),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    createdAt: date('created_at'),
    updatedAt: date('updated_at'),
  },
  (table) => [index('auth_session_user_idx').on(table.userId)],
);
export const authAccount = pgTable(
  'auth_accounts',
  {
    id: text().primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => authUser.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
    scope: text(),
    password: text(),
    createdAt: date('created_at'),
    updatedAt: date('updated_at'),
  },
  (table) => [
    index('auth_account_user_idx').on(table.userId),
    uniqueIndex('auth_account_provider_key').on(table.providerId, table.accountId),
  ],
);
export const authVerification = pgTable(
  'auth_verifications',
  {
    id: text().primaryKey(),
    identifier: text().notNull(),
    value: text().notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: date('created_at'),
    updatedAt: date('updated_at'),
  },
  (table) => [index('auth_verification_identifier_idx').on(table.identifier)],
);
export const authRateLimit = pgTable('auth_rate_limits', {
  id: text().primaryKey(),
  key: text().notNull().unique(),
  count: integer().notNull(),
  lastRequest: bigint('last_request', { mode: 'number' }).notNull(),
});
