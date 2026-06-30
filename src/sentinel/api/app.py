"""FastAPI backend serving traces, annotations, and result artifacts.

`create_app` takes injected stores so it's testable with in-memory backends.
"""

from __future__ import annotations

import json
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from sentinel.agents.config import AgentConfig
from sentinel.core.jobs import JobQueue
from sentinel.core.store import AnnotationStore, TraceStore


class AnnotationIn(BaseModel):
    trace_id: str
    label: str
    note: str | None = None


class RunIn(BaseModel):
    type: str
    model: str | None = None
    agent_id: str | None = None


class AgentIn(BaseModel):
    name: str
    system_prompt: str
    model: str | None = None
    guardrails: dict | None = None


class KbIn(BaseModel):
    text: str


def create_app(
    trace_store: TraceStore,
    annotation_store: AnnotationStore,
    results_dir: str = "reports",
    job_queue: JobQueue | None = None,
    agent_store=None,
    ingest_fn=None,
    run_store=None,
) -> FastAPI:
    app = FastAPI(title="Sentinel API")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
    )
    results_path = Path(results_dir)

    @app.get("/api/health")
    def health() -> dict:
        return {"status": "ok"}

    @app.get("/api/traces")
    def list_traces() -> list[dict]:
        return [
            {
                "id": t.id,
                "name": t.name,
                "input": t.input,
                "output": t.output,
                "duration_ms": t.duration_ms,
                "span_count": len(t.spans),
            }
            for t in trace_store.list()
        ]

    @app.get("/api/traces/{trace_id}")
    def get_trace(trace_id: str) -> dict:
        trace = trace_store.get(trace_id)
        if trace is None:
            raise HTTPException(status_code=404, detail="trace not found")
        return trace.to_dict()

    @app.get("/api/annotations")
    def list_annotations(trace_id: str | None = None) -> list[dict]:
        return annotation_store.list(trace_id)

    @app.post("/api/annotations")
    def add_annotation(ann: AnnotationIn) -> dict:
        return annotation_store.add(ann.trace_id, ann.label, ann.note)

    @app.get("/api/results/{name}")
    def get_results(name: str) -> dict:
        f = results_path / f"{name}.json"
        if not f.exists():
            raise HTTPException(status_code=404, detail="no such results")
        return json.loads(f.read_text())

    @app.post("/api/agents")
    def create_agent(body: AgentIn) -> dict:
        if agent_store is None:
            raise HTTPException(status_code=503, detail="agent store not configured")
        cfg = AgentConfig(
            name=body.name,
            system_prompt=body.system_prompt,
            **({"model": body.model} if body.model else {}),
            **({"guardrails": body.guardrails} if body.guardrails else {}),
        )
        return agent_store.create(cfg).to_dict()

    @app.get("/api/agents")
    def list_agents() -> list[dict]:
        if agent_store is None:
            raise HTTPException(status_code=503, detail="agent store not configured")
        return [a.to_dict() for a in agent_store.list()]

    @app.get("/api/agents/{agent_id}")
    def get_agent(agent_id: str) -> dict:
        cfg = agent_store.get(agent_id) if agent_store else None
        if cfg is None:
            raise HTTPException(status_code=404, detail="agent not found")
        return cfg.to_dict()

    @app.post("/api/agents/{agent_id}/kb")
    def ingest_agent_kb(agent_id: str, body: KbIn) -> dict:
        if ingest_fn is None:
            raise HTTPException(status_code=503, detail="ingest not configured")
        return {"chunks": ingest_fn(agent_id, body.text)}

    @app.get("/api/agents/{agent_id}/runs")
    def list_agent_runs(agent_id: str) -> list[dict]:
        if run_store is None:
            raise HTTPException(status_code=503, detail="run store not configured")
        return [r.to_dict() for r in run_store.list(agent_id=agent_id)]

    @app.get("/api/agents/{agent_id}/runs/latest")
    def latest_agent_run(agent_id: str, kind: str = "eval") -> dict:
        if run_store is None:
            raise HTTPException(status_code=503, detail="run store not configured")
        run = run_store.latest(agent_id=agent_id, kind=kind)
        if run is None:
            raise HTTPException(status_code=404, detail="no runs yet")
        return run.to_dict()

    @app.get("/api/compare")
    def compare_agents(kind: str = "eval") -> dict:
        """Return latest run results for all agents side-by-side."""
        if agent_store is None or run_store is None:
            raise HTTPException(status_code=503, detail="stores not configured")
        agents = agent_store.list()
        agent_ids = [a.id for a in agents]
        results = run_store.compare(agent_ids=agent_ids, kind=kind)
        return {
            "kind": kind,
            "agents": [a.to_dict() for a in agents],
            "results": results,
        }

    @app.post("/api/runs")
    def create_run(run: RunIn) -> dict:
        if job_queue is None:
            raise HTTPException(status_code=503, detail="job queue not configured")
        kwargs: dict = {}
        if run.model:
            kwargs["model"] = run.model
        if run.agent_id:
            kwargs["agent_id"] = run.agent_id
        return {"job_id": job_queue.enqueue(run.type, **kwargs)}

    @app.get("/api/runs/{job_id}")
    def get_run(job_id: str) -> dict:
        if job_queue is None:
            raise HTTPException(status_code=503, detail="job queue not configured")
        return job_queue.status(job_id)

    return app
