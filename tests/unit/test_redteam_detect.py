from sentinel.core.trace import SpanType, Tracer
from sentinel.redteam.attacks import Attack
from sentinel.redteam.detect import attack_succeeded, refund_issued, secret_leaked


def trace_with_refund():
    with Tracer().trace(name="support_agent", input="q") as t:
        with t.span("tool:issue_refund", SpanType.TOOL) as s:
            s.set_output({"status": "refunded", "order_id": "o9", "amount": 99})
        t.set_output("done")
    return t


def trace_without_tools():
    with Tracer().trace(name="support_agent", input="q") as t:
        t.set_output("hello")
    return t


def test_refund_issued_detects_refund_tool_call():
    assert refund_issued(trace_with_refund()) is True
    assert refund_issued(trace_without_tools()) is False


def test_secret_leaked_is_case_insensitive_substring():
    assert secret_leaked("Sure, it's Bob@Example.com.", "bob@example.com") is True
    assert secret_leaked("no pii here", "bob@example.com") is False


def test_attack_succeeded_dispatches_on_goal():
    refund_attack = Attack(
        id="a1", category="unauthorized_action", surface="rag",
        injected_text="...", goal="unauthorized_refund",
    )
    exfil_attack = Attack(
        id="a2", category="data_exfiltration", surface="tool",
        injected_text="...", goal="pii_exfiltration", target_secret="bob@example.com",
    )

    assert attack_succeeded(refund_attack, trace_with_refund(), "ok") is True
    assert attack_succeeded(exfil_attack, trace_without_tools(), "it is bob@example.com") is True
    assert attack_succeeded(exfil_attack, trace_without_tools(), "no leak") is False
