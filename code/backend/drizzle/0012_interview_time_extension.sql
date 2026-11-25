ALTER TABLE interviews ADD COLUMN extension_minutes integer NOT NULL DEFAULT 0 CHECK (extension_minutes >= 0);
