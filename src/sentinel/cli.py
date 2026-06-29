"""Sentinel CLI — seed the KB, test the agent, and run red-team campaigns.

    uv run sentinel seed                       # embed + index the KB
    uv run sentinel ask "where is my order?"  # run one ticket through the agent
    uv run sentinel eval                       # run the eval suite -> reports/
    uv run sentinel redteam --model openai/gpt-4o-mini   # run a campaign
"""

from __future__ import annotations

import argparse
import json
import os

from dotenv import load_dotenv


def _dsn() -> str:
    return os.environ["DATABASE_URL"]


def _retriever():
    from sentinel.agent.kb import openai_embedder
    from sentinel.agent.retriever import HybridRetriever
    from sentinel.core.llm import EMBED_DIM

    return HybridRetriever(_dsn(), embed_fn=openai_embedder, dim=EMBED_DIM, table="kb_documents")


def cmd_seed(_args) -> None:
    from sentinel.agent.kb import seed_kb

    n = seed_kb(_retriever(), "datasets/kb/articles.json")
    print(f"seeded {n} KB articles into kb_documents")


def cmd_ask(args) -> None:
    from sentinel.agent.factory import build_support_agent
    from sentinel.agent.tools import load_backend

    agent = build_support_agent(_dsn(), load_backend("datasets/backend.json"), table="kb_documents")
    result = agent.run(args.question)
    print("\nTRACE")
    for s in result.trace.spans:
        print(f"  [{s.type.value:9s}] {s.name}")
    print("\nANSWER\n" + (result.answer or ""))


def cmd_eval(_args) -> None:
    from collections import defaultdict

    from sentinel.agent.factory import build_support_agent
    from sentinel.agent.tools import load_backend
    from sentinel.core.pg_store import PostgresTraceStore
    from sentinel.evals.generate import load_tickets
    from sentinel.evals.judge import llm_judge
    from sentinel.evals.runner import build_taxonomy, evaluate_trace

    agent = build_support_agent(_dsn(), load_backend("datasets/backend.json"), table="kb_documents")
    store = PostgresTraceStore(_dsn())
    tickets = load_tickets("datasets/tickets.json")
    judge = lambda c, q, a, ctx: llm_judge(c, q, a, ctx)  # noqa: E731

    results = []
    for t in tickets:
        trace = agent.run(t["question"]).trace
        store.save(trace)
        results.append(evaluate_trace(trace, t, judge))

    counts = defaultdict(lambda: [0, 0])
    for r in results:
        for v in r["verdicts"]:
            counts[v.name][0] += 1 if v.passed else 0
            counts[v.name][1] += 1
    for name, (p, n) in counts.items():
        print(f"  {name:14s}: {p}/{n}")
    out = {
        "pass_rates": {k: {"pass": v[0], "total": v[1]} for k, v in counts.items()},
        "taxonomy": build_taxonomy(results),
        "per_ticket": [
            {"ticket_id": r["ticket_id"],
             "verdicts": [{"name": v.name, "passed": v.passed, "reason": v.reason} for v in r["verdicts"]]}
            for r in results
        ],
    }
    json.dump(out, open("reports/half_a_eval.json", "w"), indent=2)
    print("saved -> reports/half_a_eval.json")


def cmd_redteam(args) -> None:
    from sentinel.worker.jobs import run_redteam_job

    print(json.dumps(run_redteam_job(model=args.model), indent=2))


def main() -> None:
    load_dotenv()
    parser = argparse.ArgumentParser(prog="sentinel", description="Sentinel eval & red-team CLI")
    sub = parser.add_subparsers(dest="cmd", required=True)

    sub.add_parser("seed", help="embed + index the KB").set_defaults(func=cmd_seed)

    ask = sub.add_parser("ask", help="run one question through the agent")
    ask.add_argument("question")
    ask.set_defaults(func=cmd_ask)

    sub.add_parser("eval", help="run the eval suite over tickets").set_defaults(func=cmd_eval)

    rt = sub.add_parser("redteam", help="run an injection campaign against a model")
    rt.add_argument("--model", default="openai/gpt-4o-mini")
    rt.set_defaults(func=cmd_redteam)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
