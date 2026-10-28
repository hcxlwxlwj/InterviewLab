import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  uniqueIndex,
  check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import type {
  InterviewConfig,
  InterviewSnapshot,
  InterviewQuestion,
  InterviewMemory,
  InterviewRetrieval,
} from '@interviewlab/core';

export const interviews = pgTable(
  'interviews',
  {
    id: uuid().primaryKey(),
    owner_id: text().notNull(),
    version: integer().notNull().default(1),
    status: text().notNull().default('ready'),
    configuration: jsonb().$type<InterviewConfig>().notNull(),
    snapshot: jsonb().$type<InterviewSnapshot>(),
    agent_memory: jsonb().$type<InterviewMemory>(),
    plan: jsonb().$type<string[]>().notNull().default([]),
    generation_id: uuid(),
    generation_kind: text(),
    generation_status: text().notNull().default('idle'),
    task_id: uuid(),
    clarification: text(),
    parent_interview_id: uuid(),
    parent_turn_id: uuid(),
    parent_revision: integer(),
    retry_question: jsonb().$type<InterviewQuestion>(),
    retry_goal: text(),
    created_at: timestamp({ withTimezone: true }).notNull().defaultNow(),
    started_at: timestamp({ withTimezone: true }),
    ended_at: timestamp({ withTimezone: true }),
    end_reason: text(),
    deleted_at: timestamp({ withTimezone: true }),
  },
  (t) => [
    index('interviews_owner_created').on(t.owner_id, t.created_at, t.id),
    index('interviews_deadline').on(t.status, t.started_at),
    check(
      'interviews_status',
      sql.raw("status IN ('draft','ready','in_progress','paused','ending','completed','failed')"),
    ),
  ],
);
export const interviewTurns = pgTable(
  'interview_turns',
  {
    id: uuid().primaryKey(),
    interview_id: uuid()
      .notNull()
      .references(() => interviews.id, { onDelete: 'cascade' }),
    question: jsonb().$type<InterviewQuestion>().notNull(),
    knowledge_context: jsonb().$type<InterviewRetrieval>(),
    generation_id: uuid().notNull(),
    main_question_index: integer().notNull(),
    follow_up_index: integer().notNull(),
    presented_at: timestamp({ withTimezone: true }),
    answer_status: text().notNull().default('waiting'),
    answer_text: text(),
    revision: integer().notNull().default(0),
    answered_at: timestamp({ withTimezone: true }),
  },
  (t) => [
    uniqueIndex('interview_turn_position').on(
      t.interview_id,
      t.main_question_index,
      t.follow_up_index,
    ),
    index('interview_turn_parent').on(t.interview_id),
    check(
      'interview_turn_budget',
      sql.raw('main_question_index BETWEEN 1 AND 6 AND follow_up_index BETWEEN 0 AND 2'),
    ),
    check(
      'interview_turn_answer_status',
      sql.raw("answer_status IN ('waiting','answered','skipped')"),
    ),
  ],
);
export const interviewEvents = pgTable('interview_events', {
  id: uuid().primaryKey(),
  interview_id: uuid()
    .notNull()
    .references(() => interviews.id, { onDelete: 'cascade' }),
  type: text().notNull(),
  turn_id: uuid(),
  content: text(),
  created_at: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const interviewGenerationStreams = pgTable('interview_generation_streams', {
  interview_id: uuid()
    .primaryKey()
    .references(() => interviews.id, { onDelete: 'cascade' }),
  generation_id: uuid().notNull(),
  execution_token: uuid().notNull(),
  acknowledgement: text().notNull().default(''),
  text: text().notNull().default(''),
  updated_at: timestamp({ withTimezone: true }).notNull().defaultNow(),
});
