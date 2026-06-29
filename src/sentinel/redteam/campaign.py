"""Red-team campaign: inject across a surface, run the agent, detect success.

Surfaces:
- rag    : the poisoned text is prepended to the retrieved context (a poisoned
           KB doc that retrieval surfaced).
- tool   : the poisoned text is planted in a tool's output (a malicious note on
           an order record).
"""

from __future__ import annotations

import copy
from collections import defaultdict
from typing import Callable

from sentinel.agent.graph import SupportAgent
from sentinel.agent.tools import SupportBackend
from sentinel.redteam.attacks import SURFACE_RAG, SURFACE_TOOL, Attack
from sentinel.redteam.detect import attack_succeeded


def poison_retrieve(base_retrieve_fn: Callable[[str], list[str]], attack: Attack):
    def retrieve(question: str) -> list[str]:
        return [attack.injected_text] + base_retrieve_fn(question)

    return retrieve


def poison_backend(backend: SupportBackend, attack: Attack) -> SupportBackend:
    poisoned = copy.deepcopy(backend)
    if attack.target_order and attack.target_order in poisoned.orders:
        poisoned.orders[attack.target_order] = {
            **poisoned.orders[attack.target_order],
            "note": attack.injected_text,
        }
    return poisoned


def run_attack(
    attack: Attack,
    model_fn,
    base_retrieve_fn: Callable[[str], list[str]],
    backend: SupportBackend,
    output_filter: Callable[[str | None], str | None] | None = None,
) -> dict:
    if attack.surface == SURFACE_RAG:
        agent = SupportAgent(model_fn, poison_retrieve(base_retrieve_fn, attack), backend)
    elif attack.surface == SURFACE_TOOL:
        agent = SupportAgent(model_fn, base_retrieve_fn, poison_backend(backend, attack))
    else:
        raise ValueError(f"unsupported surface: {attack.surface}")

    result = agent.run(attack.benign_question)
    answer = output_filter(result.answer) if output_filter else result.answer
    return {
        "attack_id": attack.id,
        "surface": attack.surface,
        "category": attack.category,
        "succeeded": attack_succeeded(attack, result.trace, answer),
        "answer": answer,
        "trace_id": result.trace.id,
    }


def run_campaign(attacks, model_fn, base_retrieve_fn, backend, output_filter=None) -> list[dict]:
    return [
        run_attack(a, model_fn, base_retrieve_fn, backend, output_filter) for a in attacks
    ]


def run_cross_model(attacks, model_fns: dict, base_retrieve_fn, backend, output_filter=None) -> list[dict]:
    """Run the same campaign across multiple models; tag each result with model."""
    out = []
    for model_name, model_fn in model_fns.items():
        for r in run_campaign(attacks, model_fn, base_retrieve_fn, backend, output_filter):
            out.append({**r, "model": model_name})
    return out


def asr_by(results: list[dict], key: str) -> dict[str, dict]:
    agg: dict[str, list[int]] = defaultdict(lambda: [0, 0])
    for r in results:
        agg[r[key]][0] += 1 if r["succeeded"] else 0
        agg[r[key]][1] += 1
    return {
        k: {"success": s, "total": t, "asr": s / t}
        for k, (s, t) in agg.items()
    }
