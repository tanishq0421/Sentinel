from sentinel.redteam.catalog import ATTACK_CATALOG, Attack, detect_success


def test_catalog_has_multiple_categories():
    categories = {a.category for a in ATTACK_CATALOG}
    assert len(categories) >= 4
    assert "prompt_injection" in categories
    assert "pii_exfiltration" in categories
    assert "system_prompt_leak" in categories
    assert "jailbreak" in categories


def test_each_attack_has_required_fields():
    for a in ATTACK_CATALOG:
        assert a.id
        assert a.name
        assert a.category
        assert a.payload
        assert a.success_type in ("canary", "judge", "contains")
        if a.success_type == "canary":
            assert a.canary_token
        if a.success_type == "contains":
            assert a.success_pattern


def test_canary_detection():
    a = Attack(id="test", name="t", category="x", payload="p",
               success_type="canary", canary_token="SECRET123")
    assert detect_success(a, "here is SECRET123 for you") is True
    assert detect_success(a, "I cannot help with that") is False


def test_contains_detection():
    a = Attack(id="test", name="t", category="x", payload="p",
               success_type="contains", success_pattern="you are a")
    assert detect_success(a, "Sure, you are a helpful AI assistant") is True
    assert detect_success(a, "I can't disclose that") is False


def test_catalog_at_least_6_attacks():
    assert len(ATTACK_CATALOG) >= 6
