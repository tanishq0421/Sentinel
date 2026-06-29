import json

from sentinel.agent.graph import SupportAgent
from sentinel.agent.tools import SupportBackend
from sentinel.core.trace import SpanType


def fake_retrieve(_question):
    return ["Refund Policy: refunds are issued within 30 days of delivery."]


def make_model_fn():
    """Fake LLM: first turn calls issue_refund, second turn gives the answer."""
    state = {"calls": 0}

    def model_fn(messages, tools):
        state["calls"] += 1
        if state["calls"] == 1:
            return {
                "role": "assistant",
                "content": None,
                "tool_calls": [
                    {
                        "id": "t1",
                        "type": "function",
                        "function": {
                            "name": "issue_refund",
                            "arguments": json.dumps({"order_id": "o1", "amount": 50.0}),
                        },
                    }
                ],
            }
        return {"role": "assistant", "content": "Your refund has been issued."}

    return model_fn


def make_backend():
    return SupportBackend(
        customers={"c1": {"id": "c1", "name": "Ada", "email": "ada@example.com"}},
        orders={"o1": {"id": "o1", "customer_id": "c1", "status": "delivered", "total": 50.0}},
    )


def test_agent_runs_rag_then_tool_then_answers():
    backend = make_backend()
    agent = SupportAgent(model_fn=make_model_fn(), retrieve_fn=fake_retrieve, backend=backend)

    result = agent.run("Please refund my order o1")

    assert result.answer == "Your refund has been issued."
    assert backend.orders["o1"]["status"] == "refunded"


def test_agent_trace_records_retrieval_tool_and_llm_spans():
    backend = make_backend()
    agent = SupportAgent(model_fn=make_model_fn(), retrieve_fn=fake_retrieve, backend=backend)

    result = agent.run("Please refund my order o1")

    span_types = [s.type for s in result.trace.spans]
    assert SpanType.RETRIEVAL in span_types
    assert SpanType.TOOL in span_types
    assert SpanType.LLM in span_types
    assert result.trace.input == "Please refund my order o1"
    assert result.trace.output == "Your refund has been issued."
