"""RQ worker entrypoint: `uv run python -m sentinel.worker.main`.

Uses SimpleWorker (no fork) for macOS friendliness.
"""

from __future__ import annotations

import os

import redis
from dotenv import load_dotenv
from rq import Queue, SimpleWorker

from sentinel.worker.queue import QUEUE_NAME

load_dotenv()


def main() -> None:
    conn = redis.from_url(os.getenv("REDIS_URL", "redis://localhost:6380/0"))
    SimpleWorker([Queue(QUEUE_NAME, connection=conn)], connection=conn).work()


if __name__ == "__main__":
    main()
