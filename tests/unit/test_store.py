from sentinel.core.store import InMemoryTraceStore
from sentinel.core.trace import Tracer


def _make_trace(output="yo"):
    with Tracer().trace(name="run", input="hi") as t:
        t.set_output(output)
    return t


def test_in_memory_store_saves_and_gets_by_id():
    store = InMemoryTraceStore()
    trace = _make_trace()

    returned_id = store.save(trace)

    assert returned_id == trace.id
    assert store.get(trace.id) is trace


def test_in_memory_store_get_missing_returns_none():
    assert InMemoryTraceStore().get("nope") is None


def test_in_memory_store_lists_saved_traces():
    store = InMemoryTraceStore()
    a, b = _make_trace("a"), _make_trace("b")
    store.save(a)
    store.save(b)

    assert store.list() == [a, b]
