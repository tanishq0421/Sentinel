"""Server entrypoint: `uvicorn sentinel.api.main:app`.

Wires the Postgres-backed stores from the environment.
"""

from __future__ import annotations

import os

from dotenv import load_dotenv

from sentinel.api.app import create_app
from sentinel.core.pg_store import PostgresAnnotationStore, PostgresTraceStore

load_dotenv()

_DSN = os.getenv("DATABASE_URL", "postgresql://sentinel:sentinel@localhost:5433/sentinel")

app = create_app(
    PostgresTraceStore(_DSN),
    PostgresAnnotationStore(_DSN),
    results_dir="reports",
)
