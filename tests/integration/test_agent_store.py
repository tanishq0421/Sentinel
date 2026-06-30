import os

import psycopg
import pytest

from sentinel.agents.config import AgentConfig
from sentinel.agents.store import PostgresAgentStore

DSN = os.getenv(
    "DATABASE_URL_TEST", "postgresql://sentinel:sentinel@localhost:5433/sentinel_test"
)


@pytest.fixture
def store():
    try:
        psycopg.connect(DSN).close()
    except Exception:
        pytest.skip("Postgres not reachable")
    with psycopg.connect(DSN) as conn:
        conn.execute("DELETE FROM agents")
    return PostgresAgentStore(DSN)


def test_create_get_list_update(store):
    cfg = store.create(AgentConfig(name="Support Bot", system_prompt="Be helpful."))

    assert store.get(cfg.id).name == "Support Bot"
    assert cfg.id in {a.id for a in store.list()}

    store.update(cfg.id, guardrails={"spotlight": True, "pii_egress": True})
    assert store.get(cfg.id).guardrails["spotlight"] is True
