from sentinel.agents.runs import AgentRunStore, InMemoryAgentRunStore


def test_create_and_get_run():
    store = InMemoryAgentRunStore()
    run = store.create(agent_id="a1", kind="eval", result={"pass": 5, "total": 5})
    assert run.id
    assert run.agent_id == "a1"
    assert run.kind == "eval"
    assert run.result["pass"] == 5

    fetched = store.get(run.id)
    assert fetched.id == run.id


def test_list_runs_for_agent():
    store = InMemoryAgentRunStore()
    store.create(agent_id="a1", kind="eval", result={})
    store.create(agent_id="a1", kind="redteam", result={})
    store.create(agent_id="a2", kind="eval", result={})

    runs = store.list(agent_id="a1")
    assert len(runs) == 2
    assert all(r.agent_id == "a1" for r in runs)


def test_latest_run_by_kind():
    store = InMemoryAgentRunStore()
    store.create(agent_id="a1", kind="eval", result={"pass": 3, "total": 5})
    r2 = store.create(agent_id="a1", kind="eval", result={"pass": 5, "total": 5})

    latest = store.latest(agent_id="a1", kind="eval")
    assert latest.id == r2.id


def test_summary_across_agents():
    store = InMemoryAgentRunStore()
    store.create(agent_id="a1", kind="eval", result={"groundedness": {"pass": 4, "total": 5}})
    store.create(agent_id="a2", kind="eval", result={"groundedness": {"pass": 2, "total": 5}})

    summary = store.compare(agent_ids=["a1", "a2"], kind="eval")
    assert summary["a1"]["groundedness"]["pass"] == 4
    assert summary["a2"]["groundedness"]["pass"] == 2
