"""Postgres-backed AgentStore (production implementation of the protocol)."""

from __future__ import annotations

from sqlalchemy import select

from sentinel.agents.config import AgentConfig
from sentinel.core.db import make_engine, make_session_factory
from sentinel.core.models import Agent as AgentRow


class PostgresAgentStore:
    def __init__(self, dsn: str) -> None:
        self.engine = make_engine(dsn)
        self._session = make_session_factory(self.engine)

    def create(self, cfg: AgentConfig) -> AgentConfig:
        with self._session.begin() as session:
            session.add(
                AgentRow(
                    id=cfg.id,
                    name=cfg.name,
                    system_prompt=cfg.system_prompt,
                    model=cfg.model,
                    guardrails=cfg.guardrails,
                )
            )
        return cfg

    def get(self, agent_id: str) -> AgentConfig | None:
        with self._session() as session:
            row = session.get(AgentRow, agent_id)
            return self._to_cfg(row) if row else None

    def list(self) -> list[AgentConfig]:
        with self._session() as session:
            rows = (
                session.execute(select(AgentRow).order_by(AgentRow.created_at.desc()))
                .scalars()
                .all()
            )
            return [self._to_cfg(r) for r in rows]

    def update(self, agent_id: str, **fields) -> AgentConfig | None:
        with self._session.begin() as session:
            row = session.get(AgentRow, agent_id)
            if row is None:
                return None
            for key, value in fields.items():
                setattr(row, key, value)
            session.flush()
            return self._to_cfg(row)

    @staticmethod
    def _to_cfg(row: AgentRow) -> AgentConfig:
        return AgentConfig(
            id=row.id,
            name=row.name,
            system_prompt=row.system_prompt,
            model=row.model,
            guardrails=row.guardrails or {},
        )
