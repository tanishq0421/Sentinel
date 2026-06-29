from sentinel.core.trace import SpanType, Tracer
from sentinel.evals.checks import Verdict
from sentinel.evals.runner import build_taxonomy, evaluate_trace


def make_trace():
    with Tracer().trace(name="support_agent", input="q") as t:
        with t.span("retrieve", SpanType.RETRIEVAL) as s:
            s.set_output(["ctx"])
        t.set_output("answer")
    return t


def fake_judge(passed):
    return lambda c, q, a, ctx: {"pass": passed, "reason": "r"}


def test_evaluate_trace_returns_all_four_evals():
    result = evaluate_trace(make_trace(), {"id": "t1", "should_refuse": False}, fake_judge(True))

    assert result["ticket_id"] == "t1"
    assert {v.name for v in result["verdicts"]} == {
        "groundedness",
        "policy",
        "refusal",
        "tool_safety",
    }


def test_build_taxonomy_groups_only_failures():
    results = [
        {
            "ticket_id": "t1",
            "verdicts": [Verdict("groundedness", False, "hallucinated"), Verdict("policy", True, "")],
        },
        {
            "ticket_id": "t2",
            "verdicts": [Verdict("groundedness", False, "made up a number")],
        },
    ]

    taxonomy = build_taxonomy(results)

    assert len(taxonomy["groundedness"]) == 2
    assert taxonomy["groundedness"][0]["ticket_id"] == "t1"
    assert "policy" not in taxonomy
