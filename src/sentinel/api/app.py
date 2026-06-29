"""FastAPI backend serving traces, annotations, and result artifacts.

`create_app` takes injected stores so it's testable with in-memory backends.
"""

from __future__ import annotations

import json
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from sentinel.core.jobs import JobQueue
from sentinel.core.store import AnnotationStore, TraceStore


class AnnotationIn(BaseModel):
    trace_id: str
    label: str
    note: str | None = None


class RunIn(BaseModel):
    type: str
    model: str | None = None


def create_app(
    trace_store: TraceStore,
    annotation_store: AnnotationStore,
    results_dir: str = "reports",
    job_queue: JobQueue | None = None,
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

    @app.post("/api/runs")
    def create_run(run: RunIn) -> dict:
        if job_queue is None:
            raise HTTPException(status_code=503, detail="job queue not configured")
        kwargs = {"model": run.model} if run.model else {}
        return {"job_id": job_queue.enqueue(run.type, **kwargs)}

    @app.get("/api/runs/{job_id}")
    def get_run(job_id: str) -> dict:
        if job_queue is None:
            raise HTTPException(status_code=503, detail="job queue not configured")
        return job_queue.status(job_id)

    return app
