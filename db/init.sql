-- Runs once on first container init (mounted into docker-entrypoint-initdb.d).
-- Enables hybrid-search extensions. Application tables are owned by Alembic
-- (`uv run alembic upgrade head`); the kb_documents search table is created by
-- the retriever.

CREATE EXTENSION IF NOT EXISTS vector;     -- pgvector: dense embeddings
CREATE EXTENSION IF NOT EXISTS pg_search;  -- ParadeDB BM25: sparse keyword search
