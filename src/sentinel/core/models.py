"""ORM models for the relational app tables (Alembic-managed)."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, Float, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from sentinel.core.db import Base

# Import AgentRunRow so Alembic autogenerate sees it
from sentinel.agents.runs import AgentRunRow as AgentRunRow  # noqa: F401


class TraceRow(Base):
    __tablename__ = "traces"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    input: Mapped[Any] = mapped_column(JSONB, nullable=True)
    output: Mapped[Any] = mapped_column(JSONB, nullable=True)
    duration_ms: Mapped[float | None] = mapped_column(Float, nullable=True)
    spans: Mapped[Any] = mapped_column(JSONB, nullable=False, default=list)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class Agent(Base):
    """A playground-configured agent: prompt + guardrails (KB is keyed by id)."""

    __tablename__ = "agents"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    system_prompt: Mapped[str] = mapped_column(Text, nullable=False)
    model: Mapped[str] = mapped_column(String, nullable=False)
    guardrails: Mapped[Any] = mapped_column(JSONB, nullable=False, default=dict)
    is_example: Mapped[bool] = mapped_column(String, nullable=False, server_default="false")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class Annotation(Base):
    """A human failure-taxonomy label attached to a trace (the annotation tool)."""

    __tablename__ = "annotations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    trace_id: Mapped[str] = mapped_column(String, index=True, nullable=False)
    label: Mapped[str] = mapped_column(String, nullable=False)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
