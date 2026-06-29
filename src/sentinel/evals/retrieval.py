"""Retrieval evaluation: recall@k over a golden set of (query, expected docs)."""

from __future__ import annotations

from typing import Iterable


def recall_at_k(retrieved_ids: list[str], expected_ids: Iterable[str], k: int) -> float:
    """Fraction of expected ids found within the top-k retrieved ids."""
    expected = set(expected_ids)
    if not expected:
        return 1.0
    top_k = set(retrieved_ids[:k])
    return len(expected & top_k) / len(expected)
