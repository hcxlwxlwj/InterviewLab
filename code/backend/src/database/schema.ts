import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import type { TaskStatus, VersionRef } from '@interviewlab/core';

export const tasks = pgTable(
  'tasks',
  {
    id: uuid().primaryKey(),
    owner_id: text().notNull(),
    type: text().notNull(),
    key: text().notNull(),
    input_digest: text().notNull(),
    payload: jsonb().$type<unknown>().notNull(),
    status: text().$type<TaskStatus>().notNull().default('queued'),
    attempts: integer().notNull().default(0),
    max_attempts: integer().notNull().default(2),
    execution_token: uuid(),
    lease_until: timestamp({ withTimezone: true }),
    result_ref: jsonb().$type<VersionRef>(),
    error_code: text(),
    created_at: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('tasks_business_key').on(table.owner_id, table.type, table.key),
    index('tasks_status_idx').on(table.status),
    check(
      'tasks_status_check',
      sql.raw("status IN ('queued','running','succeeded','failed','cancelled')"),
    ),
    check('tasks_attempts_check', sql.raw('attempts >= 0 AND max_attempts BETWEEN 1 AND 5')),
  ],
);

export const outboxEvents = pgTable(
  'outbox_events',
  {
    id: uuid().primaryKey(),
    task_id: uuid()
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    status: text().notNull().default('pending'),
    attempts: integer().notNull().default(0),
    next_attempt_at: timestamp({ withTimezone: true }).notNull().defaultNow(),
    published_at: timestamp({ withTimezone: true }),
    created_at: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('outbox_task_unique').on(table.task_id),
    index('outbox_pending_idx').on(table.status, table.next_attempt_at),
    check('outbox_status_check', sql.raw("status IN ('pending','published')")),
  ],
);

export const idempotencyRecords = pgTable(
  'idempotency_records',
  {
    id: uuid().primaryKey(),
    owner_id: text().notNull(),
    operation: text().notNull(),
    key: text().notNull(),
    input_digest: text().notNull(),
    response: jsonb().$type<unknown>().notNull(),
    created_at: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('idempotency_scope_key').on(table.owner_id, table.operation, table.key)],
);

export const auditEvents = pgTable(
  'audit_events',
  {
    id: uuid().primaryKey(),
    owner_id: text().notNull(),
    action: text().notNull(),
    resource_id: text().notNull(),
    request_id: text().notNull(),
    outcome: text().notNull(),
    created_at: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('audit_resource_idx').on(table.resource_id, table.created_at)],
);

export const workerHeartbeats = pgTable(
  'worker_heartbeats',
  {
    id: uuid().primaryKey(),
    supported_types: jsonb().$type<string[]>().notNull(),
    started_at: timestamp({ withTimezone: true }).notNull().defaultNow(),
    last_seen_at: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('worker_last_seen_idx').on(table.last_seen_at)],
);
