import os

import psycopg
import pytest

from sentinel.agent.retriever import Document, HybridRetriever

DSN = os.getenv("DATABASE_URL", "postgresql://sentinel:sentinel@localhost:5433/sentinel")
TABLE = "kb_documents_test"

# Deterministic bag-of-words embedder — lets us test hybrid retrieval without
# any embedding API. The query about refunds aligns with the refund doc.
VOCAB = ["refund", "order", "shipping", "password", "billing", "cancel"]


def fake_embed(text: str) -> list[float]:
    t = text.lower()
    return [float(t.count(word)) for word in VOCAB]


@pytest.fixture
def retriever():
    try:
        psycopg.connect(DSN).close()
    except Exception:
        pytest.skip("Postgres not reachable")
    with psycopg.connect(DSN) as conn:
        conn.execute(f"DROP TABLE IF EXISTS {TABLE}")
    return HybridRetriever(DSN, embed_fn=fake_embed, dim=len(VOCAB), table=TABLE)


def test_hybrid_search_ranks_relevant_doc_first(retriever):
    retriever.index(
        [
            Document(id="d-refund", content="Refund policy: refunds are issued within 30 days."),
            Document(id="d-ship", content="Shipping and order tracking for your order."),
            Document(id="d-pw", content="Reset your password from account settings."),
        ]
    )

    results = retriever.search("how do I get a refund?", k=2)

    assert results[0].id == "d-refund"
    assert len(results) == 2
    assert results[0].content.startswith("Refund policy")


def test_search_respects_k_limit(retriever):
    retriever.index(
        [Document(id=f"d{i}", content=f"order refund billing doc {i}") for i in range(5)]
    )

    assert len(retriever.search("refund", k=3)) == 3
