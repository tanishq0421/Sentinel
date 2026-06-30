import json

from fastapi.testclient import TestClient

from sentinel.api.app import create_app
from sentinel.core.store import InMemoryAnnotationStore, InMemoryTraceStore
from sentinel.core.trace import SpanType, Tracer


def build(tmp_path):
    traces = InMemoryTraceStore()
    with Tracer().trace(name="support_agent", input="where is my order?") as t:
        with t.span("retrieve", SpanType.RETRIEVAL) as s:
            s.set_output(["chunk"])
        t.set_output("it shipped")
    traces.save(t)
    (tmp_path / "eval_summary.json").write_text(json.dumps({"pass_rates": {"groundedness": 13}}))
    app = create_app(traces, InMemoryAnnotationStore(), results_dir=str(tmp_path))
    return TestClient(app), t


def test_list_and_get_traces(tmp_path):
    client, trace = build(tmp_path)

    listed = client.get("/api/traces").json()
    assert listed[0]["id"] == trace.id
    assert listed[0]["span_count"] == 1

    detail = client.get(f"/api/traces/{trace.id}").json()
    assert detail["output"] == "it shipped"
    assert detail["spans"][0]["type"] == "retrieval"


def test_get_missing_trace_404(tmp_path):
    client, _ = build(tmp_path)
    assert client.get("/api/traces/nope").status_code == 404


def test_post_then_list_annotations(tmp_path):
    client, trace = build(tmp_path)

    created = client.post(
        "/api/annotations", json={"trace_id": trace.id, "label": "hallucination"}
    ).json()
    assert created["label"] == "hallucination"

    listed = client.get(f"/api/annotations?trace_id={trace.id}").json()
    assert len(listed) == 1


def test_results_endpoint_serves_json(tmp_path):
    client, _ = build(tmp_path)
    assert client.get("/api/results/eval_summary").json()["pass_rates"]["groundedness"] == 13
    assert client.get("/api/results/missing").status_code == 404


def test_agents_crud_and_kb_ingest(tmp_path):
    from sentinel.agents.config import InMemoryAgentStore
    from sentinel.api.app import create_app

    app = create_app(
        InMemoryTraceStore(), InMemoryAnnotationStore(), str(tmp_path),
        agent_store=InMemoryAgentStore(),
        ingest_fn=lambda agent_id, text: len(text.split()),
    )
    client = TestClient(app)

    created = client.post(
        "/api/agents",
        json={"name": "Bot", "system_prompt": "be nice", "guardrails": {"spotlight": True, "pii_egress": False}},
    ).json()
    assert created["id"]
    assert created["guardrails"]["spotlight"] is True

    assert client.get("/api/agents").json()[0]["name"] == "Bot"
    assert client.get(f"/api/agents/{created['id']}").json()["system_prompt"] == "be nice"
    assert client.post(f"/api/agents/{created['id']}/kb", json={"text": "one two three"}).json()["chunks"] == 3


def test_runs_endpoint_enqueues_and_reports(tmp_path):
    from sentinel.api.app import create_app
    from sentinel.core.jobs import InMemoryJobQueue

    queue = InMemoryJobQueue({"redteam": lambda model=None: {"asr": 0.25, "model": model}})
    app = create_app(InMemoryTraceStore(), InMemoryAnnotationStore(), str(tmp_path), job_queue=queue)
    client = TestClient(app)

    job_id = client.post("/api/runs", json={"type": "redteam", "model": "gpt-4o-mini"}).json()["job_id"]
    status = client.get(f"/api/runs/{job_id}").json()

    assert status["status"] == "finished"
    assert status["result"]["asr"] == 0.25
