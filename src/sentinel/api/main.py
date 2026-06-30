"""Server entrypoint: `uvicorn sentinel.api.main:app`.

Wires the Postgres-backed stores from the environment.
"""

from __future__ import annotations

import os

from dotenv import load_dotenv

from sentinel.agents.store import PostgresAgentStore
from sentinel.api.app import create_app
from sentinel.core.pg_store import PostgresAnnotationStore, PostgresTraceStore
from sentinel.playground.engine import ingest_kb
from sentinel.worker.queue import RQJobQueue

load_dotenv()

_DSN = os.getenv("DATABASE_URL", "postgresql://sentinel:sentinel@localhost:5433/sentinel")

app = create_app(
    PostgresTraceStore(_DSN),
    PostgresAnnotationStore(_DSN),
    results_dir="reports",
    job_queue=RQJobQueue(),
    agent_store=PostgresAgentStore(_DSN),
    ingest_fn=lambda agent_id, text: ingest_kb(_DSN, agent_id, text),
)
