"""Per-agent eval/redteam run results — persistence and comparison."""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any

from sqlalchemy import String, Text, DateTime, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, Session

from sentinel.core.db import Base, make_session_factory


# ── ORM ────────────────────────────────────────────────────────────────────

class AgentRunRow(Base):
    __tablename__ = "agent_runs"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    agent_id: Mapped[str] = mapped_column(String, index=True, nullable=False)
    kind: Mapped[str] = mapped_column(String, nullable=False)           # "eval" | "redteam"
    result: Mapped[Any] = mapped_column(JSONB, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


# ── Domain object ───────────────────────────────────────────────────────────

@dataclass
class AgentRun:
    id: str
    agent_id: str
    kind: str
    result: dict
    created_at: datetime = field(default_factory=datetime.utcnow)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "agent_id": self.agent_id,
            "kind": self.kind,
            "result": self.result,
            "created_at": self.created_at.isoformat(),
        }


# ── Protocol ────────────────────────────────────────────────────────────────

class AgentRunStore:
    def create(self, agent_id: str, kind: str, result: dict) -> AgentRun: ...
    def get(self, run_id: str) -> AgentRun | None: ...
    def list(self, agent_id: str) -> list[AgentRun]: ...
    def latest(self, agent_id: str, kind: str) -> AgentRun | None: ...
    def compare(self, agent_ids: list[str], kind: str) -> dict[str, dict]: ...


# ── In-memory (tests + dev) ─────────────────────────────────────────────────

class InMemoryAgentRunStore(AgentRunStore):
    def __init__(self) -> None:
        self._runs: dict[str, AgentRun] = {}

    def create(self, agent_id: str, kind: str, result: dict) -> AgentRun:
        run = AgentRun(id=str(uuid.uuid4()), agent_id=agent_id, kind=kind, result=result)
        self._runs[run.id] = run
        return run

    def get(self, run_id: str) -> AgentRun | None:
        return self._runs.get(run_id)

    def list(self, agent_id: str) -> list[AgentRun]:
        return [r for r in self._runs.values() if r.agent_id == agent_id]

    def latest(self, agent_id: str, kind: str) -> AgentRun | None:
        candidates = [r for r in self._runs.values() if r.agent_id == agent_id and r.kind == kind]
        return max(candidates, key=lambda r: r.created_at, default=None)

    def compare(self, agent_ids: list[str], kind: str) -> dict[str, dict]:
        out: dict[str, dict] = {}
        for aid in agent_ids:
            run = self.latest(aid, kind)
            if run:
                out[aid] = run.result
        return out


# ── Postgres ────────────────────────────────────────────────────────────────

class PostgresAgentRunStore(AgentRunStore):
    def __init__(self, dsn: str) -> None:
        from sentinel.core.db import make_engine
        self._engine = make_engine(dsn)
        self._session = make_session_factory(self._engine)

    def _row_to_domain(self, row: AgentRunRow) -> AgentRun:
        return AgentRun(id=row.id, agent_id=row.agent_id, kind=row.kind,
                        result=row.result, created_at=row.created_at)

    def create(self, agent_id: str, kind: str, result: dict) -> AgentRun:
        with self._session.begin() as s:
            row = AgentRunRow(id=str(uuid.uuid4()), agent_id=agent_id, kind=kind, result=result)
            s.add(row)
            s.flush()
            s.refresh(row)
            return self._row_to_domain(row)

    def get(self, run_id: str) -> AgentRun | None:
        with self._session() as s:
            row = s.get(AgentRunRow, run_id)
            return self._row_to_domain(row) if row else None

    def list(self, agent_id: str) -> list[AgentRun]:
        with self._session() as s:
            rows = s.query(AgentRunRow).filter_by(agent_id=agent_id)\
                    .order_by(AgentRunRow.created_at.desc()).all()
            return [self._row_to_domain(r) for r in rows]

    def latest(self, agent_id: str, kind: str) -> AgentRun | None:
        with self._session() as s:
            row = s.query(AgentRunRow).filter_by(agent_id=agent_id, kind=kind)\
                   .order_by(AgentRunRow.created_at.desc()).first()
            return self._row_to_domain(row) if row else None

    def compare(self, agent_ids: list[str], kind: str) -> dict[str, dict]:
        return {aid: r.result for aid in agent_ids
                if (r := self.latest(aid, kind)) is not None}
