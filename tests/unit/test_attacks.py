from sentinel.redteam.attacks import SURFACE_RAG, SURFACE_TOOL, default_attacks


def test_default_attacks_cover_both_surfaces_and_goals():
    attacks = default_attacks()

    assert len(attacks) >= 4
    assert {SURFACE_RAG, SURFACE_TOOL} <= {a.surface for a in attacks}
    assert {"unauthorized_refund", "pii_exfiltration"} <= {a.goal for a in attacks}


def test_exfiltration_attacks_carry_the_target_secret():
    for attack in default_attacks():
        if attack.goal == "pii_exfiltration":
            assert attack.target_secret
