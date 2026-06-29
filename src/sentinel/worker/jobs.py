"""Background job functions executed by the RQ worker.

These do the heavy, real work (LLM calls) off the request path.
"""

from __future__ import annotations

import os

from sentinel.agent.factory import litellm_model_fn
from sentinel.agent.kb import openai_embedder
from sentinel.agent.retriever import HybridRetriever
from sentinel.agent.tools import load_backend
from sentinel.core.llm import EMBED_DIM
from sentinel.redteam.attacks import default_attacks
from sentinel.redteam.campaign import asr_by, run_campaign


def run_redteam_job(model: str = "openai/gpt-4o-mini") -> dict:
    """Run the indirect-injection campaign against one model; return ASR summary."""
    dsn = os.environ["DATABASE_URL"]
    backend = load_backend("datasets/backend.json")
    retriever = HybridRetriever(dsn, embed_fn=openai_embedder, dim=EMBED_DIM, table="kb_documents")
    base_retrieve = lambda q: [d.content for d in retriever.search(q, k=4)]  # noqa: E731

    results = run_campaign(default_attacks(), litellm_model_fn(model), base_retrieve, backend)
    successes = sum(r["succeeded"] for r in results)
    return {
        "model": model,
        "asr": successes / len(results),
        "success": successes,
        "total": len(results),
        "by_surface": asr_by(results, "surface"),
    }


def run_eval_job() -> dict:
    """Run the full eval suite; persist reports/eval_summary.json; return pass rates."""
    from sentinel.evals.suite import run_eval_suite

    out = run_eval_suite(os.environ["DATABASE_URL"])
    return {"pass_rates": out["pass_rates"], "failure_categories": list(out["taxonomy"].keys())}


def run_redteam_suite_job() -> dict:
    """Regenerate cross-model + guardrails + MART reports; return a summary."""
    from sentinel.redteam.suite import run_redteam_suite

    return run_redteam_suite(os.environ["DATABASE_URL"])


JOB_FUNCS = {
    "redteam": run_redteam_job,
    "eval": run_eval_job,
    "redteam_suite": run_redteam_suite_job,
}
