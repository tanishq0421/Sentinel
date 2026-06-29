from types import SimpleNamespace

from sentinel.agent.factory import litellm_model_fn


class _Msg:
    """Mimics a litellm message object with model_dump()."""

    def __init__(self, payload):
        self._payload = payload

    def model_dump(self):
        return self._payload


def _response(payload):
    return SimpleNamespace(choices=[SimpleNamespace(message=_Msg(payload))])


def test_model_fn_returns_assistant_dict_with_tool_calls(mocker):
    payload = {
        "role": "assistant",
        "content": None,
        "tool_calls": [
            {"id": "t1", "type": "function",
             "function": {"name": "issue_refund", "arguments": "{}"}}
        ],
    }
    m = mocker.patch("sentinel.agent.factory.litellm.completion", return_value=_response(payload))

    fn = litellm_model_fn("anthropic/claude-haiku-4-5")
    out = fn([{"role": "user", "content": "refund"}], tools=[{"x": 1}])

    assert out["tool_calls"][0]["function"]["name"] == "issue_refund"
    _, kwargs = m.call_args
    assert kwargs["model"] == "anthropic/claude-haiku-4-5"
    assert kwargs["tools"] == [{"x": 1}]


def test_model_fn_returns_plain_answer(mocker):
    payload = {"role": "assistant", "content": "Here is your answer."}
    mocker.patch("sentinel.agent.factory.litellm.completion", return_value=_response(payload))

    fn = litellm_model_fn("anthropic/claude-haiku-4-5")
    out = fn([{"role": "user", "content": "hi"}], tools=[])

    assert out["content"] == "Here is your answer."
