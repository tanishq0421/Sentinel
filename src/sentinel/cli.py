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
    from sentinel.evals.suite import run_eval_suite

    out = run_eval_suite(_dsn())
    for name, r in out["pass_rates"].items():
        print(f"  {name:14s}: {r['pass']}/{r['total']}")
    print("saved -> reports/eval_summary.json")


def cmd_redteam(args) -> None:
    from sentinel.worker.jobs import run_redteam_job

    print(json.dumps(run_redteam_job(model=args.model), indent=2))


def cmd_seed_examples(_args) -> None:
    from sentinel.examples.seed import seed_examples

    ids = seed_examples(_dsn())
    print(f"done — {len(ids)} new example agent(s) seeded")


def cmd_redteam_suite(_args) -> None:
    from sentinel.redteam.suite import run_redteam_suite

    print(json.dumps(run_redteam_suite(_dsn()), indent=2))
    print("saved -> reports/redteam_{cross_model,guardrails,mart}.json")


def main() -> None:
    load_dotenv()
    parser = argparse.ArgumentParser(prog="sentinel", description="Sentinel eval & red-team CLI")
    sub = parser.add_subparsers(dest="cmd", required=True)

    sub.add_parser("seed", help="embed + index the KB").set_defaults(func=cmd_seed)
    sub.add_parser("seed-examples", help="seed 3 public example agents").set_defaults(func=cmd_seed_examples)

    ask = sub.add_parser("ask", help="run one question through the agent")
    ask.add_argument("question")
    ask.set_defaults(func=cmd_ask)

    sub.add_parser("eval", help="run the eval suite over tickets").set_defaults(func=cmd_eval)

    rt = sub.add_parser("redteam", help="run an injection campaign against a model")
    rt.add_argument("--model", default="openai/gpt-4o-mini")
    rt.set_defaults(func=cmd_redteam)

    sub.add_parser(
        "redteam-suite", help="regenerate cross-model + guardrails + MART reports"
    ).set_defaults(func=cmd_redteam_suite)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
