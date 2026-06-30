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


class AgentUpdateIn(BaseModel):
    name: str | None = None
    system_prompt: str | None = None
    model: str | None = None
    guardrails: dict | None = None


class KbIn(BaseModel):
    text: str


class AttackRunIn(BaseModel):
    attack_ids: list[str] | None = None
    trials: int = 3


class EvalProfileIn(BaseModel):
    checks: dict[str, bool] | None = None
    questions_per_eval: int | None = None
    judge_model: str | None = None


class RedTeamProfileIn(BaseModel):
    categories: dict[str, bool] | None = None
    attack_ids: list[str] | None = None
    trials_per_attack: int | None = None
    attacker_model: str | None = None


class ProfileUpdateIn(BaseModel):
    eval_profile: EvalProfileIn | None = None
    redteam_profile: RedTeamProfileIn | None = None


def create_app(
    trace_store: TraceStore,
    annotation_store: AnnotationStore,
    results_dir: str = "reports",
    job_queue: JobQueue | None = None,
    agent_store=None,
    ingest_fn=None,
    run_store=None,
    kb_list_fn=None,
    kb_delete_fn=None,
    trace_list_by_agent_fn=None,
) -> FastAPI:
    app = FastAPI(title="Sentinel API")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
    )
    results_path = Path(results_dir)

    def _run_summary(run) -> str:
        if run.kind == "eval":
            checks = run.result.get("checks", {})
            if checks:
                parts = [f"{name} {v.get('pass', 0)}/{v.get('total', 0)}" for name, v in checks.items()]
                return " · ".join(parts)
            g = run.result.get("groundedness", {})
            if g:
                return f"{g.get('pass', 0)}/{g.get('total', 0)} grounded"
        elif run.kind == "redteam":
            asr = run.result.get("asr")
            vuln = run.result.get("vulnerable_count")
            total = run.result.get("total_attacks")
            if asr is not None and vuln is not None:
                return f"ASR {round(asr * 100)}% · {vuln}/{total} vulnerable"
            if asr is not None:
                return f"ASR {round(asr * 100)}% — {'vulnerable' if run.result.get('vulnerable') else 'robust'}"
        return run.kind

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

    @app.put("/api/agents/{agent_id}")
    def update_agent(agent_id: str, body: AgentUpdateIn) -> dict:
        if agent_store is None:
            raise HTTPException(status_code=503, detail="agent store not configured")
        cfg = agent_store.get(agent_id)
        if cfg is None:
            raise HTTPException(status_code=404, detail="agent not found")
        updates = {}
        if body.name is not None:
            updates["name"] = body.name
        if body.system_prompt is not None:
            updates["system_prompt"] = body.system_prompt
        if body.model is not None:
            updates["model"] = body.model
        if body.guardrails is not None:
            updates["guardrails"] = body.guardrails
        if updates:
            agent_store.update(agent_id, **updates)
        return agent_store.get(agent_id).to_dict()

    @app.put("/api/agents/{agent_id}/profiles")
    def update_profiles(agent_id: str, body: ProfileUpdateIn) -> dict:
        if agent_store is None:
            raise HTTPException(status_code=503, detail="agent store not configured")
        cfg = agent_store.get(agent_id)
        if cfg is None:
            raise HTTPException(status_code=404, detail="agent not found")
        updates = {}
        if body.eval_profile:
            ep = cfg.eval_profile
            if body.eval_profile.checks is not None:
                ep.checks.update(body.eval_profile.checks)
            if body.eval_profile.questions_per_eval is not None:
                ep.questions_per_eval = body.eval_profile.questions_per_eval
            if body.eval_profile.judge_model is not None:
                ep.judge_model = body.eval_profile.judge_model or None
            updates["eval_profile"] = ep.to_dict()
        if body.redteam_profile:
            rp = cfg.redteam_profile
            if body.redteam_profile.categories is not None:
                rp.categories.update(body.redteam_profile.categories)
            if body.redteam_profile.attack_ids is not None:
                rp.attack_ids = body.redteam_profile.attack_ids
            if body.redteam_profile.trials_per_attack is not None:
                rp.trials_per_attack = body.redteam_profile.trials_per_attack
            if body.redteam_profile.attacker_model is not None:
                rp.attacker_model = body.redteam_profile.attacker_model or None
            updates["redteam_profile"] = rp.to_dict()
        if updates:
            agent_store.update(agent_id, **updates)
        updated = agent_store.get(agent_id)
        return updated.to_dict()

    @app.post("/api/agents/{agent_id}/kb")
    def ingest_agent_kb(agent_id: str, body: KbIn) -> dict:
        if ingest_fn is None:
            raise HTTPException(status_code=503, detail="ingest not configured")
        return {"chunks": ingest_fn(agent_id, body.text)}

    @app.get("/api/agents/{agent_id}/kb")
    def list_agent_kb(agent_id: str) -> dict:
        if kb_list_fn is None:
            raise HTTPException(status_code=503, detail="kb listing not configured")
        docs = kb_list_fn(agent_id)
        return {"chunks": [{"id": d.id, "content": d.content} for d in docs]}

    @app.delete("/api/agents/{agent_id}/kb/{chunk_id}")
    def delete_agent_kb_chunk(agent_id: str, chunk_id: str) -> dict:
        if kb_delete_fn is None:
            raise HTTPException(status_code=503, detail="kb delete not configured")
        deleted = kb_delete_fn(chunk_id)
        if not deleted:
            raise HTTPException(status_code=404, detail="chunk not found")
        return {"deleted": True}

    @app.get("/api/agents/{agent_id}/traces")
    def list_agent_traces(agent_id: str) -> list[dict]:
        if trace_list_by_agent_fn is None:
            raise HTTPException(status_code=503, detail="agent trace listing not configured")
        traces = trace_list_by_agent_fn(agent_id)
        return [
            {
                "id": t.id,
                "name": t.name,
                "input": t.input,
                "output": t.output,
                "duration_ms": t.duration_ms,
                "span_count": len(t.spans),
                "kind": t.kind,
            }
            for t in traces
        ]

    @app.get("/api/runs/{run_id}/detail")
    def get_run_detail(run_id: str) -> dict:
        if run_store is None:
            raise HTTPException(status_code=503, detail="run store not configured")
        run = run_store.get(run_id)
        if run is None:
            raise HTTPException(status_code=404, detail="run not found")
        return run.to_dict()

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

    @app.get("/api/stats")
    def platform_stats() -> dict:
        """Live platform-wide aggregates — powers the Overview page."""
        if agent_store is None or run_store is None:
            raise HTTPException(status_code=503, detail="stores not configured")
        agents = agent_store.list()
        recent = run_store.list_recent(limit=20)

        # build name lookup for recent feed
        agent_names = {a.id: a.name for a in agents}

        eval_runs, rt_runs = [], []
        for a in agents:
            ev = run_store.latest(a.id, "eval")
            rt = run_store.latest(a.id, "redteam")
            if ev:
                eval_runs.append(ev)
            if rt:
                rt_runs.append(rt)

        # aggregate groundedness across all agents
        total_pass = total_cases = 0
        for r in eval_runs:
            g = r.result.get("groundedness", {})
            total_pass += g.get("pass", 0)
            total_cases += g.get("total", 0)

        asrs = [r.result.get("asr", 0) for r in rt_runs]
        vulnerable_count = sum(1 for r in rt_runs if r.result.get("vulnerable", False))

        return {
            "total_agents": len(agents),
            "agents_evaled": len(eval_runs),
            "agents_redteamed": len(rt_runs),
            "avg_groundedness": round(total_pass / total_cases, 3) if total_cases else None,
            "avg_asr": round(sum(asrs) / len(asrs), 3) if asrs else None,
            "vulnerable_agents": vulnerable_count,
            "recent_runs": [
                {
                    "id": r.id,
                    "agent_id": r.agent_id,
                    "agent_name": agent_names.get(r.agent_id, r.agent_id[:8]),
                    "kind": r.kind,
                    "created_at": r.created_at.isoformat(),
                    "summary": _run_summary(r),
                }
                for r in recent
            ],
        }

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

    @app.get("/api/models")
    def list_models() -> dict:
        from sentinel.core.llm import DEFAULT_AGENT_MODEL, DEFAULT_ATTACKER_MODEL, DEFAULT_JUDGE_MODEL
        return {
            "models": [
                {"id": "anthropic/claude-haiku-4-5-20251001", "provider": "anthropic", "label": "Claude Haiku 4.5"},
                {"id": "anthropic/claude-sonnet-4-20250514", "provider": "anthropic", "label": "Claude Sonnet 4"},
                {"id": "openai/gpt-4o-mini", "provider": "openai", "label": "GPT-4o Mini"},
                {"id": "openai/gpt-4o", "provider": "openai", "label": "GPT-4o"},
                {"id": "openai/gpt-4.1-mini", "provider": "openai", "label": "GPT-4.1 Mini"},
                {"id": "openai/gpt-4.1", "provider": "openai", "label": "GPT-4.1"},
            ],
            "defaults": {
                "agent": DEFAULT_AGENT_MODEL,
                "judge": DEFAULT_JUDGE_MODEL,
                "attacker": DEFAULT_ATTACKER_MODEL,
            },
        }

    @app.get("/api/attacks")
    def list_attacks() -> dict:
        from sentinel.redteam.catalog import ATTACK_CATALOG, attacks_by_category
        return {
            "attacks": [
                {"id": a.id, "name": a.name, "category": a.category,
                 "success_type": a.success_type, "description": a.description}
                for a in ATTACK_CATALOG
            ],
            "categories": {k: [a.id for a in v] for k, v in attacks_by_category().items()},
        }

    @app.post("/api/agents/{agent_id}/attack")
    def run_attack(agent_id: str, body: AttackRunIn) -> dict:
        if job_queue is None:
            raise HTTPException(status_code=503, detail="job queue not configured")
        kwargs: dict = {"agent_id": agent_id}
        if body.attack_ids:
            kwargs["attack_ids"] = body.attack_ids
        return {"job_id": job_queue.enqueue("pg_redteam", **kwargs)}

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
        data = job_queue.status(job_id)
        try:
            from sentinel.core.progress import get_progress
            data["steps"] = get_progress(job_id)
        except Exception:
            data["steps"] = []
        return data

    return app
