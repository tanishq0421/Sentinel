"""Configurable agent: the unit a playground user creates and tests.

An agent is a system prompt + a knowledge base (indexed separately, keyed by
agent id) + guardrail toggles. `AgentStore` persists configs (in-memory for
tests; Postgres for prod).
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from typing import Protocol

from sentinel.core.llm import DEFAULT_AGENT_MODEL


def _default_guardrails() -> dict:
    return {"spotlight": False, "pii_egress": False}


@dataclass
class AgentConfig:
    name: str
    system_prompt: str
    model: str = DEFAULT_AGENT_MODEL
    guardrails: dict = field(default_factory=_default_guardrails)
    id: str = ""

    def __post_init__(self) -> None:
        if not self.id:
            self.id = uuid.uuid4().hex

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "system_prompt": self.system_prompt,
            "model": self.model,
            "guardrails": self.guardrails,
        }


class AgentStore(Protocol):
    def create(self, cfg: AgentConfig) -> AgentConfig: ...

    def get(self, agent_id: str) -> AgentConfig | None: ...

    def list(self) -> list[AgentConfig]: ...

    def update(self, agent_id: str, **fields) -> AgentConfig | None: ...


class InMemoryAgentStore:
    def __init__(self) -> None:
        self._agents: dict[str, AgentConfig] = {}

    def create(self, cfg: AgentConfig) -> AgentConfig:
        self._agents[cfg.id] = cfg
        return cfg

    def get(self, agent_id: str) -> AgentConfig | None:
        return self._agents.get(agent_id)

    def list(self) -> list[AgentConfig]:
        return list(self._agents.values())

    def update(self, agent_id: str, **fields) -> AgentConfig | None:
        cfg = self._agents.get(agent_id)
        if cfg is None:
            return None
        for key, value in fields.items():
            setattr(cfg, key, value)
        return cfg
