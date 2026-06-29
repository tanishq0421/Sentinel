# Sentinel — Eval & Red-Team Harness for an Agentic Support Agent

**Sentinel answers two questions about an LLM customer-support agent — *does it
work well?* and *can it be made to misbehave?* — with measured, reproducible
evidence.** The support agent is the substrate; the **eval + red-team framework
is the product**.

> Built test-first (TDD), verified against live services at every step.

---

## What this is (the purpose)

Shipping LLM agents safely requires more than vibes. Sentinel is a working
system that, for a reference customer-support agent (RAG + tools + a hybrid
knowledge base):

- **Evaluation.** Domain-specific binary evals (groundedness, policy
  compliance, refusal, tool-safety) over real agent traces, error analysis, and
  a measured **failure taxonomy**. No generic BERTScore/ROUGE.
- **Red-teaming.** Indirect prompt-injection attacks across two surfaces
  (poisoned RAG doc, poisoned tool output), **cross-model** comparison, a
  **MART-style adaptive** attacker loop, and **guardrails** with measured
  before/after attack-success-rate (ASR).

Both halves run through one **trace** abstraction and surface in a dark
**operations console** (Next.js).

## What we actually built

```
┌──────────────┐   HTTP    ┌──────────────┐   enqueue   ┌──────────────┐
│  Next.js     │ ────────► │  FastAPI     │ ──────────► │  RQ worker   │
│  dashboard   │ ◄──────── │  API         │   (Redis)   │  (eval /     │
│  (console)   │  traces / │              │             │   red-team)  │
└──────────────┘  results  └──────┬───────┘             └──────┬───────┘
                                   │                            │
                                   ▼                            ▼
                          ┌─────────────────────────────────────────┐
                          │  Postgres (ParadeDB)                      │
                          │  • pgvector + pg_search BM25 = hybrid RAG │
                          │  • traces / annotations (SQLAlchemy+Alembic)│
                          └─────────────────────────────────────────┘
            agent: LangGraph (RAG → LLM → tools)  ·  models via LiteLLM
```

- `agent/` — LangGraph support agent: hybrid retriever (pgvector dense + ParadeDB
  BM25, fused by RRF), tools (`lookup_order`/`lookup_customer`/`issue_refund`),
  fully traced.
- `evals/` — LLM-judge + assertion evals, taxonomy, recall@k.
- `redteam/` — attack corpus, injection surfaces, success detectors, campaign
  runner + ASR, MART adaptive loop.
- `guardrails/` — spotlighting (data-marking), PII egress filter, refund
  confirmation.
- `api/` + `worker/` — FastAPI + Redis/RQ async jobs.
- `dashboard/` — dark Next.js console.

## Key findings (real, measured)

| Result | Value |
|---|---|
| Eval pass rates (15 tickets) | groundedness/policy ~13-14/15, refusal 15/15 |
| Agent safety bug found | t-05: unauthorized refund on a *cancel* request (caught by 3 evals) |
| Cross-model ASR | **Claude Haiku 0%** vs **GPT-4o-mini 25%** (same attacks) |
| Guardrails before/after | GPT-4o-mini **25% → 0%** |
| MART adaptive | landed on GPT-4o-mini; Claude robust across rounds |

Full writeups: [reports/eval_findings.md](reports/eval_findings.md),
[reports/redteam_findings.md](reports/redteam_findings.md).

---

## Quickstart

### Option A — full stack in Docker (one command)

```bash
cp .env.example .env     # add ANTHROPIC_API_KEY + OPENAI_API_KEY
docker-compose up --build
```

Then open **http://localhost:3000**. The API runs migrations + seeds the KB on
boot; the worker consumes eval/red-team jobs. (For EC2, rebuild the dashboard
with `NEXT_PUBLIC_API_URL=http://<public-ip>:8000`.)

### Option B — local dev

```bash
uv sync
cp .env.example .env                 # add keys
docker-compose up -d postgres redis  # just the infra
uv run alembic upgrade head          # create tables
uv run sentinel seed                 # embed + index the KB
uv run uvicorn sentinel.api.main:app --port 8000   # API
uv run python -m sentinel.worker.main              # worker (separate shell)
cd dashboard && npm install && npm run dev          # dashboard
```

## Using the dashboard

- **Overview** — the four findings (eval pass rates + taxonomy, cross-model ASR,
  guardrail before/after, MART curve).
- **Run a job** (top of Overview) — **conduct an agent eval or a red-team
  campaign right from the UI**: click *run eval suite* (regenerates traces and
  scores them) or *run red-team · <model>* (runs the injection campaign). Jobs
  execute async on the RQ worker; status + results stream back and the charts
  refresh.
- **Traces** — every agent run as a step timeline (retrieval → llm → tool); open
  one to **annotate failures** into the taxonomy.

## CLI

```bash
uv run sentinel seed                            # embed + index the KB
uv run sentinel ask "How long for a refund?"   # run one ticket through the agent
uv run sentinel eval                            # run the eval suite -> reports/
uv run sentinel redteam --model openai/gpt-4o-mini   # run an injection campaign
```

## Tech stack

LangGraph · LiteLLM (multi-provider) · Postgres/ParadeDB (pgvector + pg_search) ·
SQLAlchemy + Alembic · FastAPI · Redis + RQ (Redis Queue) · Next.js.

Evals and tracing are **custom-built** (custom `Trace` logger + LLM-as-judge),
not DeepEval/Langfuse — see `reports/code_review.md` for the rationale and the
optional path to wiring Langfuse later.

## Testing

```bash
uv run pytest      # 77 tests; integration tests use a dedicated sentinel_test DB
```

Strict TDD throughout; integration tests verify against real Postgres.
