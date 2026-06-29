"""LLM-as-judge primitive: a model grades an answer against a criterion.

Returns a binary verdict + reason — the building block for the groundedness,
policy, and refusal evals. The judge model routes through the same LiteLLM seam.
"""

from __future__ import annotations

import json
import re

from sentinel.core.llm import complete, model_panel

_JUDGE_TEMPLATE = """You are a strict evaluator of a customer-support agent.

Criterion: {criteria}

Customer question:
{question}

Knowledge base context the agent was given:
{context}

Agent's answer:
{answer}

Decide whether the answer satisfies the criterion. Respond with ONLY a JSON
object: {{"pass": true or false, "reason": "<one short sentence>"}}."""


def _parse_verdict(raw: str) -> dict:
    text = raw.strip()
    if text.startswith("```"):
        text = re.sub(r"^```[a-zA-Z]*\n?", "", text)
        text = re.sub(r"\n?```$", "", text).strip()
    match = re.search(r"\{.*\}", text, re.DOTALL)
    data = json.loads(match.group(0) if match else text)
    return {"pass": bool(data["pass"]), "reason": data.get("reason", "")}


def llm_judge(
    criteria: str,
    question: str,
    answer: str | None,
    context: list[str],
    model: str | None = None,
) -> dict:
    model = model or model_panel().judge
    prompt = _JUDGE_TEMPLATE.format(
        criteria=criteria,
        question=question,
        context="\n".join(context) if context else "(none)",
        answer=answer if answer is not None else "(no answer)",
    )
    return _parse_verdict(complete(model, [{"role": "user", "content": prompt}]))
