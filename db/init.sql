-- Runs once on first container init (mounted into docker-entrypoint-initdb.d).
-- Enables hybrid-search extensions and creates the trace persistence table.

CREATE EXTENSION IF NOT EXISTS vector;     -- pgvector: dense embeddings
CREATE EXTENSION IF NOT EXISTS pg_search;  -- ParadeDB BM25: sparse keyword search

-- One agent run, serialized. Spans live as JSONB (the framework reads them back).
CREATE TABLE IF NOT EXISTS traces (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    input       JSONB,
    output      JSONB,
    duration_ms DOUBLE PRECISION,
    spans       JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS traces_created_at_idx ON traces (created_at DESC);
