"""Postgres-backed TraceStore using the SQLAlchemy ORM.

Spans are stored as JSONB; reconstruction goes through Trace.from_dict so the
returned objects match the in-memory store's shape.
"""

from __future__ import annotations

from sqlalchemy import select

from sentinel.core.db import make_engine, make_session_factory
from sentinel.core.models import TraceRow
from sentinel.core.trace import Trace


class PostgresTraceStore:
    def __init__(self, dsn: str) -> None:
        self.engine = make_engine(dsn)
        self._session = make_session_factory(self.engine)

    def save(self, trace: Trace) -> str:
        with self._session.begin() as session:
            session.merge(
                TraceRow(
                    id=trace.id,
                    name=trace.name,
                    input=trace.input,
                    output=trace.output,
                    duration_ms=trace.duration_ms,
                    spans=[s.to_dict() for s in trace.spans],
                )
            )
        return trace.id

    def get(self, trace_id: str) -> Trace | None:
        with self._session() as session:
            row = session.get(TraceRow, trace_id)
            return self._to_trace(row) if row else None

    def list(self) -> list[Trace]:
        with self._session() as session:
            rows = (
                session.execute(select(TraceRow).order_by(TraceRow.created_at.desc()))
                .scalars()
                .all()
            )
            return [self._to_trace(r) for r in rows]

    @staticmethod
    def _to_trace(row: TraceRow) -> Trace:
        return Trace.from_dict(
            {
                "id": row.id,
                "name": row.name,
                "input": row.input,
                "output": row.output,
                "duration_ms": row.duration_ms,
                "spans": row.spans or [],
            }
        )
