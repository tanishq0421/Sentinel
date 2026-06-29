from types import SimpleNamespace

from sentinel.core.llm import complete, model_panel


def _fake_response(text):
    return SimpleNamespace(
        choices=[SimpleNamespace(message=SimpleNamespace(content=text))]
    )


def test_complete_returns_assistant_text_and_passes_args(mocker):
    m = mocker.patch(
        "sentinel.core.llm.litellm.completion",
        return_value=_fake_response("hello"),
    )

    out = complete("anthropic/claude-haiku-4-5", [{"role": "user", "content": "hi"}])

    assert out == "hello"
    _, kwargs = m.call_args
    assert kwargs["model"] == "anthropic/claude-haiku-4-5"
    assert kwargs["messages"] == [{"role": "user", "content": "hi"}]


def test_complete_retries_on_transient_error_then_succeeds(mocker):
    m = mocker.patch(
        "sentinel.core.llm.litellm.completion",
        side_effect=[RuntimeError("transient"), _fake_response("ok")],
    )

    out = complete("m", [{"role": "user", "content": "hi"}])

    assert out == "ok"
    assert m.call_count == 2


def test_model_panel_reads_agent_attacker_judge_from_env(monkeypatch):
    monkeypatch.setenv("SENTINEL_AGENT_MODEL", "anthropic/a")
    monkeypatch.setenv("SENTINEL_ATTACKER_MODEL", "openai/b")
    monkeypatch.setenv("SENTINEL_JUDGE_MODEL", "anthropic/c")

    panel = model_panel()

    assert panel.agent == "anthropic/a"
    assert panel.attacker == "openai/b"
    assert panel.judge == "anthropic/c"
