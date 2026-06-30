"""Reproducible red-team suite: regenerate the cross-model, guardrails, and MART
report artifacts from committed code (replaces earlier ad-hoc scripts).
"""

from __future__ import annotations

import json
import os

from sentinel.agent.factory import litellm_model_fn
from sentinel.agent.kb import openai_embedder
from sentinel.agent.retriever import HybridRetriever
from sentinel.agent.tools import load_backend
from sentinel.core.llm import EMBED_DIM
from sentinel.guardrails.defenses import pii_egress_filter, spotlight_retrieve
from sentinel.redteam.attacks import default_attacks
from sentinel.redteam.campaign import asr_by, run_campaign, run_cross_model
from sentinel.redteam.mart import make_attacker, mart_loop

MODELS = {
    "claude-haiku": "anthropic/claude-haiku-4-5-20251001",
    "gpt-4o-mini": "openai/gpt-4o-mini",
}
VULNERABLE = "gpt-4o-mini"


def _write(reports_dir: str, name: str, obj: dict) -> None:
    with open(os.path.join(reports_dir, name), "w") as f:
        json.dump(obj, f, indent=2)


def run_redteam_suite(dsn: str, reports_dir: str = "reports") -> dict:
    backend_path = "datasets/backend.json"
    retriever = HybridRetriever(dsn, embed_fn=openai_embedder, dim=EMBED_DIM, table="kb_documents")
    base_retrieve = lambda q: [d.content for d in retriever.search(q, k=4, agent_id="acme")]  # noqa: E731
    backend = load_backend(backend_path)
    attacks = default_attacks()

    # 1) cross-model
    cm = run_cross_model(attacks, {n: litellm_model_fn(m) for n, m in MODELS.items()}, base_retrieve, backend)
    cross = {
        "by_model": asr_by(cm, "model"),
        "results": [{k: r[k] for k in ("model", "attack_id", "surface", "category", "succeeded")} for r in cm],
    }
    _write(reports_dir, "redteam_cross_model.json", cross)

    # 2) guardrails before/after on the vulnerable model
    vuln = litellm_model_fn(MODELS[VULNERABLE])
    before = run_campaign(attacks, vuln, base_retrieve, backend)
    guarded_backend = load_backend(backend_path)
    guarded_backend.require_refund_confirmation = True
    egress = lambda a: pii_egress_filter(a, allowed=set())  # noqa: E731
    after = run_campaign(attacks, vuln, spotlight_retrieve(base_retrieve), guarded_backend, output_filter=egress)
    asr = lambda rs: sum(r["succeeded"] for r in rs) / len(rs)  # noqa: E731
    guardrails = {
        "before": {"overall_asr": asr(before), "by_category": asr_by(before, "category")},
        "after": {"overall_asr": asr(after), "by_category": asr_by(after, "category")},
    }
    _write(reports_dir, "redteam_guardrails.json", guardrails)

    # 3) MART adaptive
    attacker = make_attacker(MODELS[VULNERABLE], target_order="o1", target_secret="bob@example.com")
    mart = {}
    for name, model in MODELS.items():
        hist = mart_loop(
            "unauthorized_refund", "tool", litellm_model_fn(model),
            base_retrieve, backend, attacker, rounds=3, per_round=2,
        )
        mart[name] = [{"round": h["round"], "asr": h["asr"]} for h in hist]
    _write(reports_dir, "redteam_mart.json", mart)

    return {
        "cross_model": cross["by_model"],
        "guardrails": {"before": guardrails["before"]["overall_asr"], "after": guardrails["after"]["overall_asr"]},
    }
