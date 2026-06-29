import os

import psycopg
import pytest

from sentinel.core.pg_store import PostgresTraceStore
from sentinel.core.trace import SpanType, Tracer

# A dedicated test DB so the DELETE-for-isolation never touches dev data.
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
        conn.execute("DELETE FROM traces")  # isolate each test
    return PostgresTraceStore(DSN)


def _make_trace(output="yo"):
    with Tracer().trace(name="run", input={"q": "hi"}) as t:
        with t.span("retrieval", SpanType.RETRIEVAL) as s:
            s.set_output(["d1", "d2"])
        t.set_output(output)
    return t


def test_save_then_get_reconstructs_trace(store):
    trace = _make_trace()
    store.save(trace)

    got = store.get(trace.id)

    assert got is not None
    assert got.id == trace.id
    assert got.input == {"q": "hi"}
    assert got.output == "yo"
    assert got.spans[0].type == SpanType.RETRIEVAL
    assert got.spans[0].output == ["d1", "d2"]


def test_get_missing_returns_none(store):
    assert store.get("does-not-exist") is None


def test_list_returns_saved_traces(store):
    a, b = _make_trace("a"), _make_trace("b")
    store.save(a)
    store.save(b)

    ids = {t.id for t in store.list()}

    assert {a.id, b.id} <= ids
