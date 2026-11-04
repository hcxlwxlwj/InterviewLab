ALTER TABLE interviews ADD COLUMN preparation jsonb;
--> statement-breakpoint
CREATE TABLE resume_analyses (
 id uuid PRIMARY KEY, owner_id text NOT NULL,
 material_id uuid NOT NULL REFERENCES resume_materials(id), material_version integer NOT NULL,
 input_digest text NOT NULL, model text NOT NULL, prompt_version text NOT NULL,
 task_id uuid NOT NULL, result jsonb,
 CONSTRAINT resume_analysis_version CHECK (material_version>0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX resume_analysis_source ON resume_analyses(owner_id,material_id,material_version,input_digest,model,prompt_version);
