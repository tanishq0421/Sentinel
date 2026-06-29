"""RQ-backed JobQueue (production implementation of the JobQueue protocol)."""

from __future__ import annotations

import os

import redis
from rq import Queue
from rq.job import Job

from sentinel.worker.jobs import JOB_FUNCS

QUEUE_NAME = "sentinel"


def _connection():
    return redis.from_url(os.getenv("REDIS_URL", "redis://localhost:6380/0"))


class RQJobQueue:
    def __init__(self) -> None:
        self.conn = _connection()
        self.queue = Queue(QUEUE_NAME, connection=self.conn)

    def enqueue(self, name: str, **kwargs) -> str:
        if name not in JOB_FUNCS:
            raise KeyError(f"unknown job: {name}")
        job = self.queue.enqueue(JOB_FUNCS[name], **kwargs, job_timeout=900)
        return job.id

    def status(self, job_id: str) -> dict:
        try:
            job = Job.fetch(job_id, connection=self.conn)
        except Exception:
            return {"id": job_id, "status": "unknown"}
        status = job.get_status()
        status = status.value if hasattr(status, "value") else str(status)
        return {"id": job_id, "status": status, "result": job.result}
