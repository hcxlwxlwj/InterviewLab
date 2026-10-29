import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import type { InterviewEvaluation, InterviewReport, InterviewComparison } from '@interviewlab/core';

export const interviewReports = pgTable(
  'interview_reports',
  {
    id: uuid().primaryKey(),
    owner_id: text().notNull(),
    interview_id: uuid().notNull(),
    input_digest: text().notNull(),
    version: integer().notNull().default(1),
    status: text().notNull().default('pending'),
    result: jsonb().$type<InterviewReport>(),
    summary_task_id: uuid(),
    summary_input_digest: text(),
    created_at: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('interview_report_source').on(t.interview_id),
    index('interview_report_owner').on(t.owner_id),
  ],
);
export const reportEvaluations = pgTable(
  'report_evaluations',
  {
    id: uuid().primaryKey(),
    report_id: uuid()
      .notNull()
      .references(() => interviewReports.id, { onDelete: 'cascade' }),
    turn_id: uuid().notNull(),
    task_id: uuid(),
    result: jsonb().$type<InterviewEvaluation>(),
  },
  (t) => [uniqueIndex('report_evaluation_turn').on(t.report_id, t.turn_id)],
);
export const interviewComparisons = pgTable(
  'interview_comparisons',
  {
    id: uuid().primaryKey(),
    owner_id: text().notNull(),
    original_interview_id: uuid().notNull(),
    retry_interview_id: uuid().notNull(),
    input_digest: text().notNull(),
    version: integer().notNull().default(1),
    status: text().notNull().default('pending'),
    task_id: uuid(),
    input: jsonb().$type<InterviewComparison>().notNull(),
    result: jsonb().$type<InterviewComparison>(),
  },
  (t) => [uniqueIndex('comparison_input').on(t.owner_id, t.input_digest)],
);
