"""Job-queue abstraction: in-memory (sync, for tests/dev) and RQ (prod).

The API depends only on the JobQueue protocol, so endpoints are testable without
Redis.
"""

from __future__ import annotations

from typing import Callable, Protocol


class JobQueue(Protocol):
    def enqueue(self, name: str, **kwargs) -> str: ...

    def status(self, job_id: str) -> dict: ...


class InMemoryJobQueue:
    """Runs jobs synchronously; used in tests and keyless local dev."""

    def __init__(self, registry: dict[str, Callable]) -> None:
        self.registry = registry
        self._jobs: dict[str, dict] = {}
        self._counter = 0

    def enqueue(self, name: str, **kwargs) -> str:
        self._counter += 1
        job_id = f"job-{self._counter}"
        try:
            result = self.registry[name](**kwargs)
            self._jobs[job_id] = {"id": job_id, "status": "finished", "result": result}
        except Exception as exc:  # noqa: BLE001 - surface to the caller as failed
            self._jobs[job_id] = {"id": job_id, "status": "failed", "error": str(exc)}
        return job_id

    def status(self, job_id: str) -> dict:
        return self._jobs.get(job_id, {"id": job_id, "status": "unknown"})
