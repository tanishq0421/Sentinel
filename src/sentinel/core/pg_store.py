"""Postgres-backed TraceStore — the production implementation of the interface.

Spans are stored as JSONB; reconstruction goes through Trace.from_dict so the
returned objects are identical in shape to the in-memory store's.
"""

from __future__ import annotations

import psycopg
from psycopg.types.json import Json

from sentinel.core.trace import Trace

_COLUMNS = "id, name, input, output, duration_ms, spans"


class PostgresTraceStore:
    def __init__(self, dsn: str) -> None:
        self.dsn = dsn

    def save(self, trace: Trace) -> str:
        with psycopg.connect(self.dsn) as conn:
            conn.execute(
                """
                INSERT INTO traces (id, name, input, output, duration_ms, spans)
                VALUES (%s, %s, %s, %s, %s, %s)
                ON CONFLICT (id) DO UPDATE SET
                    name = EXCLUDED.name,
                    input = EXCLUDED.input,
                    output = EXCLUDED.output,
                    duration_ms = EXCLUDED.duration_ms,
                    spans = EXCLUDED.spans
                """,
                (
                    trace.id,
                    trace.name,
                    Json(trace.input),
                    Json(trace.output),
                    trace.duration_ms,
                    Json([s.to_dict() for s in trace.spans]),
                ),
            )
        return trace.id

    def get(self, trace_id: str) -> Trace | None:
        with psycopg.connect(self.dsn) as conn:
            row = conn.execute(
                f"SELECT {_COLUMNS} FROM traces WHERE id = %s", (trace_id,)
            ).fetchone()
        return self._row_to_trace(row) if row else None

    def list(self) -> list[Trace]:
        with psycopg.connect(self.dsn) as conn:
            rows = conn.execute(
                f"SELECT {_COLUMNS} FROM traces ORDER BY created_at DESC"
            ).fetchall()
        return [self._row_to_trace(r) for r in rows]

    @staticmethod
    def _row_to_trace(row) -> Trace:
        id_, name, input_, output, duration_ms, spans = row
        return Trace.from_dict(
            {
                "id": id_,
                "name": name,
                "input": input_,
                "output": output,
                "duration_ms": duration_ms,
                "spans": spans or [],
            }
        )
