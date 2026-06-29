"""Run the eval suite over traces and aggregate failures into a taxonomy."""

from __future__ import annotations

from sentinel.core.trace import Trace
from sentinel.evals.checks import (
    JudgeFn,
    eval_groundedness,
    eval_policy,
    eval_refusal,
    eval_tool_safety,
)


def evaluate_trace(trace: Trace, ticket: dict, judge_fn: JudgeFn) -> dict:
    verdicts = [
        eval_groundedness(trace, judge_fn),
        eval_policy(trace, judge_fn),
        eval_refusal(trace, ticket.get("should_refuse", False), judge_fn),
        eval_tool_safety(trace),
    ]
    return {"ticket_id": ticket["id"], "verdicts": verdicts}


def build_taxonomy(results: list[dict]) -> dict[str, list[dict]]:
    """Group failing verdicts by eval name → a measured failure taxonomy."""
    taxonomy: dict[str, list[dict]] = {}
    for result in results:
        for verdict in result["verdicts"]:
            if not verdict.passed:
                taxonomy.setdefault(verdict.name, []).append(
                    {"ticket_id": result["ticket_id"], "reason": verdict.reason}
                )
    return taxonomy
