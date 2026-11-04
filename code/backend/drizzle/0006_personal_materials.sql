CREATE TABLE IF NOT EXISTS account_settings (
 owner_id text PRIMARY KEY, data jsonb NOT NULL
);
CREATE TABLE IF NOT EXISTS resume_materials (
 id uuid PRIMARY KEY, owner_id text NOT NULL, kind text NOT NULL CHECK (kind IN ('resume','experience')), deleted boolean NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS resume_material_owner ON resume_materials(owner_id);
CREATE TABLE IF NOT EXISTS resume_material_versions (
 id uuid NOT NULL REFERENCES resume_materials(id), version integer NOT NULL CHECK(version > 0), data jsonb NOT NULL,
 PRIMARY KEY(id, version)
);
