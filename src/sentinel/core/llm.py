"""Provider abstraction over LiteLLM.

Agent, attacker, and judge all route through `complete()`, so swapping models
(cross-model red-team) is a config change, not a rewrite.
"""

from __future__ import annotations

import os
from dataclasses import dataclass

import litellm
from tenacity import retry, stop_after_attempt, wait_exponential

DEFAULT_AGENT_MODEL = "anthropic/claude-haiku-4-5-20251001"
DEFAULT_ATTACKER_MODEL = "openai/gpt-4o-mini"
DEFAULT_JUDGE_MODEL = "anthropic/claude-haiku-4-5-20251001"


@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=0.1, max=2),
    reraise=True,
)
def complete(model: str, messages: list[dict], **kwargs) -> str:
    """Return the assistant text for a chat completion; retries transient errors."""
    response = litellm.completion(model=model, messages=messages, **kwargs)
    return response.choices[0].message.content


@dataclass(frozen=True)
class ModelPanel:
    agent: str
    attacker: str
    judge: str


def model_panel() -> ModelPanel:
    """The cross-model panel, read from env with sensible defaults."""
    return ModelPanel(
        agent=os.getenv("SENTINEL_AGENT_MODEL", DEFAULT_AGENT_MODEL),
        attacker=os.getenv("SENTINEL_ATTACKER_MODEL", DEFAULT_ATTACKER_MODEL),
        judge=os.getenv("SENTINEL_JUDGE_MODEL", DEFAULT_JUDGE_MODEL),
    )
