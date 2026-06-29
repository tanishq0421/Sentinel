from sentinel.core.jobs import InMemoryJobQueue


def test_inmemory_jobqueue_runs_job_and_reports_result():
    q = InMemoryJobQueue({"redteam": lambda model=None: {"asr": 0.25, "model": model}})

    job_id = q.enqueue("redteam", model="gpt-4o-mini")
    status = q.status(job_id)

    assert status["status"] == "finished"
    assert status["result"] == {"asr": 0.25, "model": "gpt-4o-mini"}


def test_inmemory_jobqueue_reports_failure():
    def boom():
        raise ValueError("kaboom")

    q = InMemoryJobQueue({"boom": boom})
    status = q.status(q.enqueue("boom"))

    assert status["status"] == "failed"
    assert "kaboom" in status["error"]


def test_inmemory_jobqueue_unknown_job():
    assert InMemoryJobQueue({}).status("nope")["status"] == "unknown"
