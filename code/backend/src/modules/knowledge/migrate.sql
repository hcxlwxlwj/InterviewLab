CREATE EXTENSION IF NOT EXISTS vector;
CREATE TABLE IF NOT EXISTS knowledge_releases (
 id text PRIMARY KEY, status text NOT NULL CHECK (status IN ('draft','published','retired')), active boolean NOT NULL DEFAULT false,
 body jsonb NOT NULL, checksum text NOT NULL, threshold double precision NOT NULL DEFAULT 0.48,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS knowledge_one_active ON knowledge_releases(active) WHERE active;
CREATE TABLE IF NOT EXISTS knowledge_chunks (
 id text NOT NULL, release text NOT NULL REFERENCES knowledge_releases(id),card_id text NOT NULL,
 job text NOT NULL,stages text[] NOT NULL,types text[] NOT NULL,goals text[] NOT NULL,
 text text NOT NULL,terms text[] NOT NULL,source_refs text[] NOT NULL,embedding vector(1024) NOT NULL,
 PRIMARY KEY(release,id)
);
CREATE INDEX IF NOT EXISTS knowledge_terms ON knowledge_chunks USING gin(terms);

CREATE TABLE IF NOT EXISTS knowledge_query_cache (
 key text PRIMARY KEY, release text NOT NULL REFERENCES knowledge_releases(id), result jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
