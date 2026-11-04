-- Additive all-role index. The original frontend release tables remain untouched.
CREATE EXTENSION IF NOT EXISTS vector;
CREATE TABLE IF NOT EXISTS knowledge_v2_releases (
 id text PRIMARY KEY, checksum text NOT NULL, manifest jsonb NOT NULL,
 status text NOT NULL CHECK(status IN ('building','draft','published','retired')),
 active boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS knowledge_v2_active ON knowledge_v2_releases(active) WHERE active;
CREATE TABLE IF NOT EXISTS knowledge_v2_vectors (
 hash text NOT NULL, model text NOT NULL, embedding vector(1024) NOT NULL,
 PRIMARY KEY(hash,model)
);
CREATE TABLE IF NOT EXISTS knowledge_v2_chunks (
 release text NOT NULL REFERENCES knowledge_v2_releases(id), id text NOT NULL,
 hash text NOT NULL, model text NOT NULL, card_id text NOT NULL, kind text NOT NULL,
 body text NOT NULL, terms text[] NOT NULL, source_refs text[] NOT NULL, evidence_level text NOT NULL,
 PRIMARY KEY(release,id), FOREIGN KEY(hash,model) REFERENCES knowledge_v2_vectors(hash,model)
);
CREATE INDEX IF NOT EXISTS knowledge_v2_terms ON knowledge_v2_chunks USING gin(terms);
CREATE TABLE IF NOT EXISTS knowledge_v2_bindings (
 release text NOT NULL, chunk_id text NOT NULL, job text NOT NULL,
 stages text[] NOT NULL, types text[] NOT NULL, goals text[] NOT NULL,
 PRIMARY KEY(release,chunk_id,job),
 FOREIGN KEY(release,chunk_id) REFERENCES knowledge_v2_chunks(release,id)
);
CREATE INDEX IF NOT EXISTS knowledge_v2_job ON knowledge_v2_bindings(release,job);
