"""Trace persistence behind a small interface.

`TraceStore` is the seam: `InMemoryTraceStore` backs fast unit tests and local
dev; a `PostgresTraceStore` (pgvector + pg_search) will implement the same
Protocol for production.
"""

from __future__ import annotations

from typing import Protocol

from sentinel.core.trace import Trace


class TraceStore(Protocol):
    def save(self, trace: Trace) -> str: ...

    def get(self, trace_id: str) -> Trace | None: ...

    def list(self) -> list[Trace]: ...


class InMemoryTraceStore:
    def __init__(self) -> None:
        self._traces: dict[str, Trace] = {}

    def save(self, trace: Trace) -> str:
        self._traces[trace.id] = trace
        return trace.id

    def get(self, trace_id: str) -> Trace | None:
        return self._traces.get(trace_id)

    def list(self) -> list[Trace]:
        return list(self._traces.values())
