from sentinel.agents.config import AgentConfig, InMemoryAgentStore


def test_agent_config_defaults():
    cfg = AgentConfig(name="My Bot", system_prompt="You are helpful.")
    assert cfg.guardrails == {"spotlight": False, "pii_egress": False}
    assert cfg.model  # has a default model


def test_agent_store_create_get_list():
    store = InMemoryAgentStore()
    created = store.create(AgentConfig(name="Bot A", system_prompt="p"))

    assert created.id
    fetched = store.get(created.id)
    assert fetched.name == "Bot A"
    assert created.id in {a.id for a in store.list()}


def test_agent_store_update_guardrails():
    store = InMemoryAgentStore()
    cfg = store.create(AgentConfig(name="B", system_prompt="p"))

    store.update(cfg.id, guardrails={"spotlight": True, "pii_egress": True})

    assert store.get(cfg.id).guardrails["spotlight"] is True
