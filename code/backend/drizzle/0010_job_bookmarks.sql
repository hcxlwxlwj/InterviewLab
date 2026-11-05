CREATE TABLE job_bookmarks (owner_id text NOT NULL, job_id text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(owner_id,job_id));
