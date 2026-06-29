"""SQLAlchemy engine + declarative base.

Relational app tables (traces, eval results, annotations, attacks, runs) are
mapped here and migrated with Alembic. The hybrid-search table (kb_documents)
is managed by the retriever via raw DDL — its vector dim varies and its BM25
index isn't expressible in the ORM.
"""

from __future__ import annotations

from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker


class Base(DeclarativeBase):
    pass


def normalize_dsn(dsn: str) -> str:
    """Force the psycopg3 driver (SQLAlchemy defaults to psycopg2)."""
    if dsn.startswith("postgresql://"):
        return dsn.replace("postgresql://", "postgresql+psycopg://", 1)
    return dsn


def make_engine(dsn: str) -> Engine:
    return create_engine(normalize_dsn(dsn), future=True)


def make_session_factory(engine: Engine):
    return sessionmaker(engine, expire_on_commit=False)
