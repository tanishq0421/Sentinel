"""Postgres-backed TraceStore using the SQLAlchemy ORM.

Spans are stored as JSONB; reconstruction goes through Trace.from_dict so the
returned objects match the in-memory store's shape.
"""

from __future__ import annotations

from sqlalchemy import select

from sentinel.core.db import make_engine, make_session_factory
from sentinel.core.models import Annotation, TraceRow
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
                    agent_id=trace.agent_id,
                    kind=trace.kind,
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

    def list_by_agent(self, agent_id: str) -> list[Trace]:
        with self._session() as session:
            rows = (
                session.execute(
                    select(TraceRow)
                    .where(TraceRow.agent_id == agent_id)
                    .order_by(TraceRow.created_at.desc())
                )
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
                "agent_id": row.agent_id,
                "kind": row.kind,
            }
        )


class PostgresAnnotationStore:
    def __init__(self, dsn: str) -> None:
        self.engine = make_engine(dsn)
        self._session = make_session_factory(self.engine)

    def add(self, trace_id: str, label: str, note: str | None = None) -> dict:
        with self._session.begin() as session:
            row = Annotation(trace_id=trace_id, label=label, note=note)
            session.add(row)
            session.flush()
            return {"id": row.id, "trace_id": row.trace_id, "label": row.label, "note": row.note}

    def list(self, trace_id: str | None = None) -> list[dict]:
        query = select(Annotation)
        if trace_id is not None:
            query = query.where(Annotation.trace_id == trace_id)
        with self._session() as session:
            rows = session.execute(query.order_by(Annotation.id)).scalars().all()
            return [
                {"id": r.id, "trace_id": r.trace_id, "label": r.label, "note": r.note}
                for r in rows
            ]
