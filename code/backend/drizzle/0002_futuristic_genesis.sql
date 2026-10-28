CREATE TABLE "interview_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"interview_id" uuid NOT NULL,
	"type" text NOT NULL,
	"turn_id" uuid,
	"content" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "interview_turns" (
	"id" uuid PRIMARY KEY NOT NULL,
	"interview_id" uuid NOT NULL,
	"question" jsonb NOT NULL,
	"generation_id" uuid NOT NULL,
	"main_question_index" integer NOT NULL,
	"follow_up_index" integer NOT NULL,
	"presented_at" timestamp with time zone,
	"answer_status" text DEFAULT 'waiting' NOT NULL,
	"answer_text" text,
	"revision" integer DEFAULT 0 NOT NULL,
	"answered_at" timestamp with time zone,
	CONSTRAINT "interview_turn_budget" CHECK (main_question_index BETWEEN 1 AND 6 AND follow_up_index BETWEEN 0 AND 2),
	CONSTRAINT "interview_turn_answer_status" CHECK (answer_status IN ('waiting','answered','skipped'))
);
--> statement-breakpoint
CREATE TABLE "interviews" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"status" text DEFAULT 'ready' NOT NULL,
	"configuration" jsonb NOT NULL,
	"snapshot" jsonb,
	"plan" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"generation_id" uuid,
	"generation_kind" text,
	"generation_status" text DEFAULT 'idle' NOT NULL,
	"task_id" uuid,
	"clarification" text,
	"parent_interview_id" uuid,
	"parent_turn_id" uuid,
	"parent_revision" integer,
	"retry_question" jsonb,
	"retry_goal" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"end_reason" text,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "interviews_status" CHECK (status IN ('draft','ready','in_progress','paused','ending','completed','failed'))
);
--> statement-breakpoint
CREATE TABLE "interview_comparisons" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"original_interview_id" uuid NOT NULL,
	"retry_interview_id" uuid NOT NULL,
	"input_digest" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"task_id" uuid,
	"input" jsonb NOT NULL,
	"result" jsonb
);
--> statement-breakpoint
CREATE TABLE "interview_reports" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"interview_id" uuid NOT NULL,
	"input_digest" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"result" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "report_evaluations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"report_id" uuid NOT NULL,
	"turn_id" uuid NOT NULL,
	"task_id" uuid,
	"result" jsonb
);
--> statement-breakpoint
ALTER TABLE "interview_events" ADD CONSTRAINT "interview_events_interview_id_interviews_id_fk" FOREIGN KEY ("interview_id") REFERENCES "public"."interviews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interview_turns" ADD CONSTRAINT "interview_turns_interview_id_interviews_id_fk" FOREIGN KEY ("interview_id") REFERENCES "public"."interviews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_evaluations" ADD CONSTRAINT "report_evaluations_report_id_interview_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."interview_reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "interview_turn_position" ON "interview_turns" USING btree ("interview_id","main_question_index","follow_up_index");--> statement-breakpoint
CREATE INDEX "interview_turn_parent" ON "interview_turns" USING btree ("interview_id");--> statement-breakpoint
CREATE INDEX "interviews_owner_created" ON "interviews" USING btree ("owner_id","created_at","id");--> statement-breakpoint
CREATE INDEX "interviews_deadline" ON "interviews" USING btree ("status","started_at");--> statement-breakpoint
CREATE UNIQUE INDEX "comparison_input" ON "interview_comparisons" USING btree ("owner_id","input_digest");--> statement-breakpoint
CREATE UNIQUE INDEX "interview_report_source" ON "interview_reports" USING btree ("interview_id");--> statement-breakpoint
CREATE INDEX "interview_report_owner" ON "interview_reports" USING btree ("owner_id");--> statement-breakpoint
CREATE UNIQUE INDEX "report_evaluation_turn" ON "report_evaluations" USING btree ("report_id","turn_id");