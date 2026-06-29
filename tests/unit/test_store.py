from sentinel.core.store import InMemoryAnnotationStore, InMemoryTraceStore
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


def test_annotation_store_add_and_list_by_trace():
    store = InMemoryAnnotationStore()
    store.add("tr-1", "hallucination", "made up a number")
    store.add("tr-2", "policy_violation")

    a = store.add("tr-1", "tool_misuse")
    assert a["id"]
    assert a["trace_id"] == "tr-1"
    assert {x["label"] for x in store.list("tr-1")} == {"hallucination", "tool_misuse"}
    assert len(store.list()) == 3
