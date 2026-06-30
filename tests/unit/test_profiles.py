from sentinel.agents.profiles import (
    EvalProfile,
    RedTeamProfile,
    DEFAULT_EVAL_PROFILE,
    DEFAULT_REDTEAM_PROFILE,
)


def test_default_eval_profile_has_all_checks():
    p = DEFAULT_EVAL_PROFILE
    assert "groundedness" in p.checks
    assert "policy" in p.checks
    assert "refusal" in p.checks
    assert p.questions_per_eval >= 3


def test_eval_profile_to_dict_roundtrip():
    p = EvalProfile(checks={"groundedness": True, "policy": False}, questions_per_eval=10)
    d = p.to_dict()
    assert d["checks"]["groundedness"] is True
    assert d["checks"]["policy"] is False
    assert d["questions_per_eval"] == 10
    restored = EvalProfile.from_dict(d)
    assert restored.checks == p.checks
    assert restored.questions_per_eval == p.questions_per_eval


def test_default_redteam_profile_includes_all_categories():
    p = DEFAULT_REDTEAM_PROFILE
    assert "prompt_injection" in p.categories
    assert "jailbreak" in p.categories
    assert "system_prompt_leak" in p.categories
    assert p.trials_per_attack >= 1


def test_redteam_profile_to_dict_roundtrip():
    p = RedTeamProfile(
        categories={"prompt_injection": True, "jailbreak": False},
        attack_ids=["inj-ignore-instructions"],
        trials_per_attack=5,
    )
    d = p.to_dict()
    assert d["attack_ids"] == ["inj-ignore-instructions"]
    restored = RedTeamProfile.from_dict(d)
    assert restored.categories == p.categories
    assert restored.attack_ids == ["inj-ignore-instructions"]
    assert restored.trials_per_attack == 5


def test_redteam_profile_selected_attacks_filters_catalog():
    p = RedTeamProfile(
        categories={"prompt_injection": True, "jailbreak": False},
        trials_per_attack=3,
    )
    selected = p.selected_attack_ids()
    assert "inj-ignore-instructions" in selected
    assert "inj-rag-poisoned-doc" in selected
    assert "jailbreak-roleplay" not in selected


def test_redteam_profile_explicit_ids_override_categories():
    p = RedTeamProfile(
        categories={"prompt_injection": True, "jailbreak": True},
        attack_ids=["inj-ignore-instructions"],
        trials_per_attack=3,
    )
    selected = p.selected_attack_ids()
    assert selected == ["inj-ignore-instructions"]
