from sentinel.evals.judge import llm_judge


def test_llm_judge_parses_pass_verdict(mocker):
    mocker.patch(
        "sentinel.evals.judge.complete",
        return_value='{"pass": true, "reason": "fully supported"}',
    )

    verdict = llm_judge("is it grounded?", "q", "a", ["ctx"])

    assert verdict["pass"] is True
    assert verdict["reason"] == "fully supported"


def test_llm_judge_strips_code_fences(mocker):
    mocker.patch(
        "sentinel.evals.judge.complete",
        return_value='```json\n{"pass": false, "reason": "hallucinated a detail"}\n```',
    )

    verdict = llm_judge("grounded?", "q", "a", [])

    assert verdict["pass"] is False
    assert "hallucinated" in verdict["reason"]
