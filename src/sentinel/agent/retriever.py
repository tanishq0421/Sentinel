"""Hybrid RAG retrieval: dense (pgvector) + sparse (pg_search BM25) fused by RRF.

Reciprocal Rank Fusion is kept as a pure function so it can be reasoned about
and tested without a database.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Callable

import psycopg


@dataclass
class Document:
    id: str
    content: str
    score: float | None = None


def reciprocal_rank_fusion(
    rankings: list[list[str]], k: int = 60
) -> list[tuple[str, float]]:
    """Fuse ranked id-lists into one ranking by reciprocal rank fusion.

    score(d) = sum over lists of 1 / (k + rank_in_list(d)), rank starting at 1.
    Returns (doc_id, score) sorted by score descending.
    """
    scores: dict[str, float] = {}
    for ranking in rankings:
        for rank, doc_id in enumerate(ranking, start=1):
            scores[doc_id] = scores.get(doc_id, 0.0) + 1.0 / (k + rank)
    return sorted(scores.items(), key=lambda item: item[1], reverse=True)


def _vector_literal(vec: list[float]) -> str:
    return "[" + ",".join(str(float(x)) for x in vec) + "]"


class HybridRetriever:
    """Hybrid retrieval over a pgvector + pg_search BM25 table, fused by RRF.

    `embed_fn` is injected so the embedding provider is swappable (and mockable
    in tests). The dense pool and sparse pool are each over-fetched, then fused.
    """

    def __init__(
        self,
        dsn: str,
        embed_fn: Callable[[str], list[float]],
        dim: int,
        table: str = "kb_documents",
    ) -> None:
        self.dsn = dsn
        self.embed_fn = embed_fn
        self.dim = dim
        self.table = table
        self._ensure_schema()

    def _ensure_schema(self) -> None:
        with psycopg.connect(self.dsn) as conn:
            conn.execute(
                f"CREATE TABLE IF NOT EXISTS {self.table} "
                f"(id TEXT PRIMARY KEY, content TEXT NOT NULL, "
                f"agent_id TEXT NOT NULL DEFAULT 'default', embedding vector({self.dim}))"
            )
            # Per-agent KB isolation: agent_id scopes every retrieval.
            conn.execute(
                f"ALTER TABLE {self.table} ADD COLUMN IF NOT EXISTS "
                f"agent_id TEXT NOT NULL DEFAULT 'default'"
            )
            conn.execute(
                f"CREATE INDEX IF NOT EXISTS {self.table}_bm25 ON {self.table} "
                f"USING bm25 (id, content) WITH (key_field='id')"
            )
            conn.execute(
                f"CREATE INDEX IF NOT EXISTS {self.table}_agent ON {self.table} (agent_id)"
            )

    def index(self, docs: list[Document], agent_id: str = "default") -> None:
        with psycopg.connect(self.dsn) as conn:
            for doc in docs:
                conn.execute(
                    f"INSERT INTO {self.table} (id, content, agent_id, embedding) "
                    f"VALUES (%s, %s, %s, %s::vector) "
                    f"ON CONFLICT (id) DO UPDATE SET "
                    f"content = EXCLUDED.content, agent_id = EXCLUDED.agent_id, "
                    f"embedding = EXCLUDED.embedding",
                    (doc.id, doc.content, agent_id, _vector_literal(self.embed_fn(doc.content))),
                )

    def documents(self, agent_id: str) -> list[Document]:
        with psycopg.connect(self.dsn) as conn:
            rows = conn.execute(
                f"SELECT id, content FROM {self.table} WHERE agent_id = %s ORDER BY id",
                (agent_id,),
            ).fetchall()
        return [Document(id=r[0], content=r[1]) for r in rows]

    def search(self, query: str, k: int = 5, agent_id: str = "default") -> list[Document]:
        query_vec = _vector_literal(self.embed_fn(query))
        pool = max(k * 4, 10)
        with psycopg.connect(self.dsn) as conn:
            dense = [
                r[0]
                for r in conn.execute(
                    f"SELECT id FROM {self.table} WHERE agent_id = %s "
                    f"ORDER BY embedding <=> %s::vector LIMIT %s",
                    (agent_id, query_vec, pool),
                ).fetchall()
            ]
            sparse = [
                r[0]
                for r in conn.execute(
                    f"SELECT id FROM {self.table} "
                    f"WHERE id @@@ paradedb.match('content', %s) AND agent_id = %s "
                    f"ORDER BY paradedb.score(id) DESC LIMIT %s",
                    (query, agent_id, pool),
                ).fetchall()
            ]
            fused = reciprocal_rank_fusion([dense, sparse])[:k]
            ids = [doc_id for doc_id, _ in fused]
            if not ids:
                return []
            rows = conn.execute(
                f"SELECT id, content FROM {self.table} WHERE id = ANY(%s)", (ids,)
            ).fetchall()
        content_by_id = {r[0]: r[1] for r in rows}
        score_by_id = dict(fused)
        return [
            Document(id=i, content=content_by_id[i], score=score_by_id[i])
            for i in ids
            if i in content_by_id
        ]
