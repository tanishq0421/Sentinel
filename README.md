# Sentinel — Eval & Red-Team Harness for an Agentic Support Agent

Eval-driven, red-team-hardened build of an agentic customer-support agent.
The support agent is the *substrate*; the **eval + red-team framework is the star**.

## What this is

One coherent system that answers two questions about an LLM support agent:

- **Half A — "Does it work well?"** Domain-specific binary evals (groundedness,
  retrieval recall@k, tool-call correctness, policy compliance), error analysis
  over 100+ traces, and a measured failure taxonomy — surfaced in a custom
  annotation dashboard.
- **Half B — "Can it be made to misbehave?"** Indirect prompt injection across
  three surfaces (RAG doc, tool output, sub-agent message), an attacker-LLM with
  a MART-style multi-round loop, cross-model attack-success comparison, and
  guardrails with measured before/after attack-success-rate.

## Stack

LangGraph agent · hybrid RAG (pgvector dense + ParadeDB `pg_search` BM25, RRF) ·
LiteLLM multi-provider · FastAPI · Redis + RQ worker · Next.js dashboard ·
Postgres · Langfuse · DeepEval. Deployed (v1) on EC2 via docker-compose.

## Layout

```
src/sentinel/
  core/        provider abstraction (LiteLLM), tracing/observability
  agent/       LangGraph support agent: graph, tools, billing sub-agent, retriever
  evals/       custom evals (judge + assertions), taxonomy
  redteam/     attacker payloads, 3 injection surfaces, MART loop, ASR metrics
  guardrails/  filters, spotlighting, PII egress, tool allow-list
  api/         FastAPI backend
  worker/      RQ worker
dashboard/     Next.js annotation tool + results
datasets/      KB, generated traces, attack corpora
reports/       findings writeup + research notes
```

## Development

```bash
uv sync                 # install deps (Python 3.12)
uv run pytest           # run the test suite
cp .env.example .env    # then fill in provider keys
```

Built test-first (TDD). See `reports/` for findings once generated.
