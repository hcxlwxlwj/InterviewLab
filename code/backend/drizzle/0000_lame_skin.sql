CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"action" text NOT NULL,
	"resource_id" text NOT NULL,
	"request_id" text NOT NULL,
	"outcome" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "idempotency_records" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"operation" text NOT NULL,
	"key" text NOT NULL,
	"input_digest" text NOT NULL,
	"response" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "outbox_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"task_id" uuid NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "outbox_status_check" CHECK (status IN ('pending','published'))
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"type" text NOT NULL,
	"key" text NOT NULL,
	"input_digest" text NOT NULL,
	"payload" jsonb NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 2 NOT NULL,
	"execution_token" uuid,
	"lease_until" timestamp with time zone,
	"result_ref" jsonb,
	"error_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tasks_status_check" CHECK (status IN ('queued','running','succeeded','failed','cancelled')),
	CONSTRAINT "tasks_attempts_check" CHECK (attempts >= 0 AND max_attempts BETWEEN 1 AND 5)
);
--> statement-breakpoint
CREATE TABLE "worker_heartbeats" (
	"id" uuid PRIMARY KEY NOT NULL,
	"supported_types" jsonb NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "outbox_events" ADD CONSTRAINT "outbox_events_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_resource_idx" ON "audit_events" USING btree ("resource_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idempotency_scope_key" ON "idempotency_records" USING btree ("owner_id","operation","key");--> statement-breakpoint
CREATE UNIQUE INDEX "outbox_task_unique" ON "outbox_events" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "outbox_pending_idx" ON "outbox_events" USING btree ("status","next_attempt_at");--> statement-breakpoint
CREATE UNIQUE INDEX "tasks_business_key" ON "tasks" USING btree ("owner_id","type","key");--> statement-breakpoint
CREATE INDEX "tasks_status_idx" ON "tasks" USING btree ("status");--> statement-breakpoint
CREATE INDEX "worker_last_seen_idx" ON "worker_heartbeats" USING btree ("last_seen_at");