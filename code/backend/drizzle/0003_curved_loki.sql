CREATE TABLE "interview_generation_streams" (
	"interview_id" uuid PRIMARY KEY NOT NULL,
	"generation_id" uuid NOT NULL,
	"execution_token" uuid NOT NULL,
	"acknowledgement" text DEFAULT '' NOT NULL,
	"text" text DEFAULT '' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "interview_turns" ADD COLUMN "knowledge_context" jsonb;--> statement-breakpoint
ALTER TABLE "interviews" ADD COLUMN "agent_memory" jsonb;--> statement-breakpoint
ALTER TABLE "interview_generation_streams" ADD CONSTRAINT "interview_generation_streams_interview_id_interviews_id_fk" FOREIGN KEY ("interview_id") REFERENCES "public"."interviews"("id") ON DELETE cascade ON UPDATE no action;