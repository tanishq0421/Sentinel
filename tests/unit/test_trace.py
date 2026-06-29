import json

from sentinel.core.trace import SpanType, Tracer


def test_trace_records_spans_in_order_with_io():
    tracer = Tracer()
    with tracer.trace(name="agent_run", input={"q": "where is my order?"}) as trace:
        with trace.span("retrieval", SpanType.RETRIEVAL) as span:
            span.set_output(["doc-1", "doc-2"])
        with trace.span("llm", SpanType.LLM) as span:
            span.set_output("your order ships tomorrow")
        trace.set_output("your order ships tomorrow")

    assert trace.input == {"q": "where is my order?"}
    assert trace.output == "your order ships tomorrow"
    assert [s.name for s in trace.spans] == ["retrieval", "llm"]
    assert trace.spans[0].type == SpanType.RETRIEVAL
    assert trace.spans[0].output == ["doc-1", "doc-2"]


def test_span_and_trace_record_duration():
    tracer = Tracer()
    with tracer.trace(name="run") as trace:
        with trace.span("llm", SpanType.LLM):
            pass
    assert trace.spans[0].duration_ms is not None
    assert trace.spans[0].duration_ms >= 0
    assert trace.duration_ms is not None
    assert trace.duration_ms >= 0


def test_trace_to_dict_is_json_serializable_with_ids():
    tracer = Tracer()
    with tracer.trace(name="run", input="hi") as trace:
        with trace.span("llm", SpanType.LLM) as span:
            span.set_output("yo")
        trace.set_output("yo")

    d = trace.to_dict()
    assert d["id"]
    assert d["name"] == "run"
    assert d["input"] == "hi"
    assert d["output"] == "yo"
    assert d["spans"][0]["name"] == "llm"
    assert d["spans"][0]["type"] == "llm"
    assert d["spans"][0]["id"]
    json.dumps(d)  # must round-trip through JSON


def test_each_trace_has_a_unique_id():
    tracer = Tracer()
    with tracer.trace(name="a") as a:
        pass
    with tracer.trace(name="b") as b:
        pass
    assert a.id != b.id
