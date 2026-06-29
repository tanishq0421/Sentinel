from sentinel.agent.graph import AgentResult
from sentinel.core.store import InMemoryTraceStore
from sentinel.core.trace import Tracer
from sentinel.evals.generate import generate_traces, load_tickets


class FakeAgent:
    def run(self, question):
        with Tracer().trace(name="support_agent", input=question) as trace:
            trace.set_output(f"answer to: {question}")
        return AgentResult(answer=f"answer to: {question}", trace=trace)


def test_generate_traces_runs_agent_and_persists_each():
    store = InMemoryTraceStore()
    tickets = [{"id": "t1", "question": "q1"}, {"id": "t2", "question": "q2"}]

    pairs = generate_traces(FakeAgent(), tickets, store)

    assert [p["ticket_id"] for p in pairs] == ["t1", "t2"]
    saved = store.get(pairs[0]["trace_id"])
    assert saved.input == "q1"
    assert len(store.list()) == 2


def test_load_tickets_reads_dataset():
    tickets = load_tickets("datasets/tickets.json")

    assert len(tickets) == 15
    assert tickets[0]["id"] == "t-01"
    assert any(t["should_refuse"] for t in tickets)
