"""Trace generation: run the agent over a ticket set and persist each trace.

These persisted traces are the substrate for error analysis and the trace-based
evals (groundedness, tool-safety, policy, refusal).
"""

from __future__ import annotations

import json
from pathlib import Path

from sentinel.core.store import TraceStore


def load_tickets(path: str) -> list[dict]:
    return json.loads(Path(path).read_text())


def generate_traces(agent, tickets: list[dict], store: TraceStore) -> list[dict]:
    """Run the agent on each ticket, persist the trace, return id pairings."""
    pairings = []
    for ticket in tickets:
        result = agent.run(ticket["question"])
        store.save(result.trace)
        pairings.append({"ticket_id": ticket["id"], "trace_id": result.trace.id})
    return pairings
