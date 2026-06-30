"""Server entrypoint: `uvicorn sentinel.api.main:app`.

Wires the Postgres-backed stores from the environment.
"""

from __future__ import annotations

import os

from dotenv import load_dotenv

from sentinel.agents.runs import PostgresAgentRunStore
from sentinel.agents.store import PostgresAgentStore
from sentinel.api.app import create_app
from sentinel.core.pg_store import PostgresAnnotationStore, PostgresTraceStore
from sentinel.playground.engine import delete_kb_chunk, ingest_kb, list_kb
from sentinel.worker.queue import RQJobQueue

load_dotenv()

_DSN = os.getenv("DATABASE_URL", "postgresql://sentinel:sentinel@localhost:5433/sentinel")

_trace_store = PostgresTraceStore(_DSN)

app = create_app(
    _trace_store,
    PostgresAnnotationStore(_DSN),
    results_dir="reports",
    job_queue=RQJobQueue(),
    agent_store=PostgresAgentStore(_DSN),
    ingest_fn=lambda agent_id, text: ingest_kb(_DSN, agent_id, text),
    kb_list_fn=lambda agent_id: list_kb(_DSN, agent_id),
    kb_delete_fn=lambda chunk_id: delete_kb_chunk(_DSN, chunk_id),
    run_store=PostgresAgentRunStore(_DSN),
    trace_list_by_agent_fn=lambda agent_id: _trace_store.list_by_agent(agent_id),
)
