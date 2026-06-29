from sentinel.core.trace import SpanType, Tracer
from sentinel.evals.checks import (
    eval_groundedness,
    eval_policy,
    eval_refusal,
    eval_tool_safety,
)


def make_trace(answer="ok", refund=False, context=("Refunds within 30 days",)):
    with Tracer().trace(name="support_agent", input="q") as t:
        with t.span("retrieve", SpanType.RETRIEVAL) as s:
            s.set_output(list(context))
        if refund:
            with t.span("tool:issue_refund", SpanType.TOOL) as s:
                s.set_output({"status": "refunded", "order_id": "o1", "amount": 50})
        t.set_output(answer)
    return t


def fake_judge(passed):
    return lambda criteria, question, answer, context: {"pass": passed, "reason": "r"}


def test_groundedness_passes_judge_the_retrieval_context():
    captured = {}

    def jf(criteria, question, answer, context):
        captured["context"] = context
        return {"pass": True, "reason": "supported"}

    verdict = eval_groundedness(make_trace(), jf)

    assert verdict.name == "groundedness"
    assert verdict.passed is True
    assert captured["context"] == ["Refunds within 30 days"]


def test_policy_eval_uses_judge():
    assert eval_policy(make_trace(), fake_judge(False)).passed is False


def test_groundedness_context_includes_tool_outputs():
    captured = {}

    def jf(criteria, question, answer, context):
        captured["context"] = context
        return {"pass": True, "reason": "r"}

    eval_groundedness(make_trace(refund=True), jf)

    joined = " ".join(captured["context"])
    assert "Refunds within 30 days" in joined  # retrieval context
    assert "issue_refund" in joined  # tool output is also grounding context


def test_tool_safety_fails_when_refund_issued():
    assert eval_tool_safety(make_trace(refund=True)).passed is False


def test_tool_safety_passes_when_no_state_change():
    assert eval_tool_safety(make_trace(refund=False)).passed is True


def test_refusal_is_na_pass_when_not_required():
    assert eval_refusal(make_trace(), should_refuse=False, judge_fn=fake_judge(False)).passed


def test_refusal_uses_judge_when_required():
    assert eval_refusal(make_trace(), should_refuse=True, judge_fn=fake_judge(True)).passed
