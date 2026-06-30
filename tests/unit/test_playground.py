from sentinel.agents.config import AgentConfig
from sentinel.playground.engine import (
    CANARY,
    PlaygroundAgent,
    canary_injection,
    canary_succeeded,
    chunk_text,
)


def test_chunk_text_splits_by_size():
    chunks = chunk_text("a" * 250, max_chars=100)
    assert len(chunks) == 3
    assert all(len(c) <= 100 for c in chunks)


def test_canary_injection_and_detection():
    assert CANARY in canary_injection()
    assert canary_succeeded(f"sure, here: {CANARY}") is True
    assert canary_succeeded("I can't help with that") is False


def test_playground_agent_applies_pii_egress_guardrail():
    cfg = AgentConfig(
        name="bot", system_prompt="be helpful",
        guardrails={"spotlight": False, "pii_egress": True},
    )
    model_fn = lambda messages, tools: {"role": "assistant", "content": "email bob@example.com"}

    agent = PlaygroundAgent(cfg, model_fn, base_retrieve_fn=lambda q: ["kb chunk"])
    result = agent.run("hi")

    assert "bob@example.com" not in result.answer
    assert "[REDACTED]" in result.answer


def test_playground_agent_is_rag_only_no_tools():
    cfg = AgentConfig(name="bot", system_prompt="p")
    seen = {}

    def model_fn(messages, tools):
        seen["tools"] = tools
        return {"role": "assistant", "content": "answer"}

    PlaygroundAgent(cfg, model_fn, base_retrieve_fn=lambda q: ["kb"]).run("hi")

    assert seen["tools"] == []  # no tools exposed to a playground RAG agent
