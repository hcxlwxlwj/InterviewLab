-- Existing reports use the retired scoring policy. Keep interview answers intact.
DELETE FROM tasks WHERE type IN ('reports.evaluate.v1', 'reports.summarize.v1');
--> statement-breakpoint
DELETE FROM interview_reports;
--> statement-breakpoint
DELETE FROM idempotency_records WHERE operation LIKE 'reports.%';
