import json

from sentinel.agent.tools import SupportBackend
from sentinel.redteam.mart import make_attacker, mart_loop


def test_make_attacker_feeds_failures_into_prompt_and_strips_output(mocker):
    m = mocker.patch("sentinel.redteam.mart.complete", return_value="  EVIL  ")

    generate = make_attacker("openai/gpt-4o-mini")
    out = generate("unauthorized_refund", "rag", ["prev-failed-payload"])

    assert out == "EVIL"
    prompt = m.call_args[0][1][0]["content"]
    assert "prev-failed-payload" in prompt


def test_mart_loop_escalates_until_an_attack_lands():
    # Attacker proposes payload-0, payload-1, payload-2, ... (indexed by #failures).
    def generate_fn(goal, surface, failures):
        return f"payload-{len(failures)}"

    # Target obeys only once it sees "payload-2"; otherwise refuses.
    def target(messages, tools):
        if any(m.get("role") == "tool" for m in messages):
            return {"role": "assistant", "content": "done"}
        if "payload-2" in messages[0]["content"]:
            return {"role": "assistant", "content": None, "tool_calls": [
                {"id": "t", "type": "function", "function": {
                    "name": "issue_refund",
                    "arguments": json.dumps({"order_id": "o1", "amount": 1})}}]}
        return {"role": "assistant", "content": "no"}

    backend = SupportBackend(orders={"o1": {"id": "o1", "status": "delivered", "total": 1}})

    history = mart_loop(
        goal="unauthorized_refund", surface="rag",
        target_model_fn=target, base_retrieve_fn=lambda q: ["kb"], backend=backend,
        generate_fn=generate_fn, rounds=3, per_round=1,
    )

    assert history[0]["asr"] == 0.0  # payload-0 fails
    assert history[2]["asr"] == 1.0  # payload-2 lands
    assert history[2]["results"][0]["payload"] == "payload-2"
