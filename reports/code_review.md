# Code Review — Sentinel

Self-review of the codebase, with severity, rationale, and the action taken.

## Verdict

Solid, tested (77 tests, TDD), working end-to-end and containerized. The issues
below were found on review; the High/Medium ones are fixed in this pass.

---

## Findings

### HIGH

**H1 — Spec drift: DeepEval & Langfuse claimed but never used.**
The plan and earlier README/`.env.example` implied a "hybrid" stack using
DeepEval (eval plumbing) and Langfuse (tracing). Reality: we built **custom
equivalents** — a custom `Trace`/`Span` logger (`core/trace.py`) and a custom
LLM-as-judge (`evals/judge.py`) — and never imported either library.
*Why it matters:* claiming tools you didn't use is misleading in a portfolio.
**Action:** removed the claims from the README and the unused `LANGFUSE_*` keys
from `.env.example`; documented the custom approach. (Optional future: wire
Langfuse as a real `Trace` sink — noted below.)

**H2 — Non-production report naming (`half_a_eval`, `half_b_crossmodel`, …).**
These leaked an internal "Half A / Half B" framing into the API surface and
artifacts.
**Action:** renamed to domain names — `eval_summary`, `redteam_cross_model`,
`redteam_guardrails`, `redteam_mart`, `redteam_baseline` — across report files,
the writers (`evals/suite.py`), the API consumers (dashboard), tests, and docs.

**H3 — Reproducibility gap in red-team reports.**
`redteam_cross_model/guardrails/mart` were originally produced by ad-hoc inline
scripts, with no committed command to regenerate them — so the dashboard's
red-team charts weren't reproducible from code.
**Action:** added `redteam/suite.py::run_redteam_suite`, exposed as
`sentinel redteam-suite` (CLI), a `redteam_suite` worker job, and a
"run full red-team suite" dashboard button.

### MEDIUM

**M1 — "Empty traces" was a UX/ambiguity issue, not data loss.**
The backend was correct (17 traces; `/api/traces` returns 17). The Traces page
had no explicit loading/empty state, so a stale tab or a not-yet-seeded DB
looked like a bug.
**Action:** added loading + empty states to the Traces page.

**M2 — API has permissive CORS (`*`) and no auth.**
Acceptable for a local/demo portfolio app; must be locked down before any real
deployment.
**Action:** documented; left permissive for the demo. (Future: restrict origins,
add an API key/JWT.)

**M3 — `reports/` is baked into the image; live runs overwrite only in-container.**
Re-running eval/red-team inside the container updates results there but not on a
host volume, so they're lost on container recreate.
**Action:** documented. (Future: mount a `reports` volume in compose.)

### LOW

- **L1** — `InMemoryJobQueue` runs jobs synchronously (intentional: tests/keyless
  dev). Documented.
- **L2** — a few `lambda` assignments (E731) in suite/CLI glue; harmless, `noqa`'d.
- **L3** — the billing sub-agent / 3rd injection surface (agent-to-agent message)
  is not implemented; it's the one documented extension (see
  `reports/redteam_findings.md`).

---

## What "RQ" means

**RQ = Redis Queue** — a small Python library that runs background jobs backed by
Redis. The API enqueues eval/red-team jobs (`api/app.py::create_run`); a worker
process (`sentinel.worker.main`, using `SimpleWorker`) consumes them.

## Optional future: real Langfuse tracing

`core/trace.py` already centralizes every span. A real integration would add a
sink that pushes each `Trace` to Langfuse when `LANGFUSE_*` is set — a small,
isolated change. Not done here to avoid shipping unused "integration theater".
