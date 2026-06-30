"""Eval and red-team profiles — saved configurations for what to test and how."""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class EvalProfile:
    checks: dict[str, bool] = field(default_factory=lambda: {
        "groundedness": True,
        "policy": True,
        "refusal": True,
    })
    questions_per_eval: int = 5
    judge_model: str | None = None

    def to_dict(self) -> dict:
        return {"checks": dict(self.checks), "questions_per_eval": self.questions_per_eval, "judge_model": self.judge_model}

    @classmethod
    def from_dict(cls, d: dict) -> EvalProfile:
        return cls(checks=dict(d.get("checks", {})), questions_per_eval=d.get("questions_per_eval", 5), judge_model=d.get("judge_model"))


@dataclass
class RedTeamProfile:
    categories: dict[str, bool] = field(default_factory=lambda: {
        "prompt_injection": True,
        "jailbreak": True,
        "pii_exfiltration": True,
        "system_prompt_leak": True,
        "instruction_override": True,
    })
    attack_ids: list[str] | None = None
    trials_per_attack: int = 3
    attacker_model: str | None = None

    def selected_attack_ids(self) -> list[str]:
        if self.attack_ids is not None:
            return list(self.attack_ids)
        from sentinel.redteam.catalog import ATTACK_CATALOG
        enabled = {cat for cat, on in self.categories.items() if on}
        return [a.id for a in ATTACK_CATALOG if a.category in enabled]

    def to_dict(self) -> dict:
        return {
            "categories": dict(self.categories),
            "attack_ids": list(self.attack_ids) if self.attack_ids else None,
            "trials_per_attack": self.trials_per_attack,
            "attacker_model": self.attacker_model,
        }

    @classmethod
    def from_dict(cls, d: dict) -> RedTeamProfile:
        return cls(
            categories=dict(d.get("categories", {})),
            attack_ids=d.get("attack_ids"),
            trials_per_attack=d.get("trials_per_attack", 3),
            attacker_model=d.get("attacker_model"),
        )


DEFAULT_EVAL_PROFILE = EvalProfile()
DEFAULT_REDTEAM_PROFILE = RedTeamProfile()
