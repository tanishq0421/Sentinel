"""Job progress tracking via Redis.

Jobs push steps as they execute; the API exposes them for live polling.
Each step is a dict: {label, status, detail?}. Status: pending|running|done|failed.
"""

from __future__ import annotations

import json
import os

import redis


def _conn():
    return redis.from_url(os.getenv("REDIS_URL", "redis://localhost:6380/0"))


def _key(job_id: str) -> str:
    return f"sentinel:progress:{job_id}"


class ProgressReporter:
    """Write-side: called by worker jobs to report step progress."""

    def __init__(self, job_id: str, conn=None) -> None:
        self.job_id = job_id
        self.conn = conn or _conn()
        self.steps: list[dict] = []

    def add_step(self, label: str, detail: str | None = None) -> int:
        idx = len(self.steps)
        step = {"label": label, "status": "pending", "detail": detail}
        self.steps.append(step)
        self._flush()
        return idx

    def start(self, idx: int, detail: str | None = None) -> None:
        self.steps[idx]["status"] = "running"
        if detail is not None:
            self.steps[idx]["detail"] = detail
        self._flush()

    def done(self, idx: int, detail: str | None = None) -> None:
        self.steps[idx]["status"] = "done"
        if detail is not None:
            self.steps[idx]["detail"] = detail
        self._flush()

    def fail(self, idx: int, detail: str | None = None) -> None:
        self.steps[idx]["status"] = "failed"
        if detail is not None:
            self.steps[idx]["detail"] = detail
        self._flush()

    def _flush(self) -> None:
        self.conn.setex(_key(self.job_id), 3600, json.dumps(self.steps))


def get_progress(job_id: str, conn=None) -> list[dict]:
    """Read-side: called by the API to fetch current progress steps."""
    c = conn or _conn()
    raw = c.get(_key(job_id))
    if raw is None:
        return []
    return json.loads(raw)
