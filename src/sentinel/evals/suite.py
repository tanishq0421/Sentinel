"""Run the full eval suite over the ticket set and persist results.

Shared by the CLI (`sentinel eval`) and the async worker (`eval` job).
"""

from __future__ import annotations

import json
from collections import defaultdict

from sentinel.agent.factory import build_support_agent
from sentinel.agent.tools import load_backend
from sentinel.core.pg_store import PostgresTraceStore
from sentinel.evals.generate import load_tickets
from sentinel.evals.judge import llm_judge
from sentinel.evals.runner import build_taxonomy, evaluate_trace


def run_eval_suite(
    dsn: str,
    kb_table: str = "kb_documents",
    tickets_path: str = "datasets/tickets.json",
    backend_path: str = "datasets/backend.json",
    out_path: str | None = "reports/eval_summary.json",
) -> dict:
    agent = build_support_agent(dsn, load_backend(backend_path), table=kb_table)
    store = PostgresTraceStore(dsn)
    tickets = load_tickets(tickets_path)
    judge = lambda c, q, a, ctx: llm_judge(c, q, a, ctx)  # noqa: E731

    results = []
    for ticket in tickets:
        trace = agent.run(ticket["question"]).trace
        store.save(trace)
        results.append(evaluate_trace(trace, ticket, judge))

    counts: dict[str, list[int]] = defaultdict(lambda: [0, 0])
    for r in results:
        for v in r["verdicts"]:
            counts[v.name][0] += 1 if v.passed else 0
            counts[v.name][1] += 1

    out = {
        "pass_rates": {k: {"pass": v[0], "total": v[1]} for k, v in counts.items()},
        "taxonomy": build_taxonomy(results),
        "per_ticket": [
            {
                "ticket_id": r["ticket_id"],
                "verdicts": [
                    {"name": v.name, "passed": v.passed, "reason": v.reason} for v in r["verdicts"]
                ],
            }
            for r in results
        ],
    }
    if out_path:
        json.dump(out, open(out_path, "w"), indent=2)
    return out
