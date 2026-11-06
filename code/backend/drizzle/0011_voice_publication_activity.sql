ALTER TABLE interviews ADD COLUMN voice_activity jsonb NOT NULL DEFAULT '{}'::jsonb;
