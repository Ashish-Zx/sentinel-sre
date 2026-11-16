import backend.services.llm as llm
from backend.models.enums import AgentName


def test_agent_prompts_cover_all_agents():
    for agent in AgentName:
        assert agent in llm.AGENT_SYSTEM_PROMPTS
        assert llm.AGENT_SYSTEM_PROMPTS[agent].strip()


async def test_verify_patch_returns_shape(monkeypatch):
    async def boom(*args, **kwargs):
        raise RuntimeError("no LLM configured")

    monkeypatch.setattr(llm, "chat", boom)
    result = await llm.verify_patch("raw error", "diff")
    assert 0 <= result["confidence"] <= 100
    assert isinstance(result["critique"], str)


async def test_verify_patch_parses_llm_json(monkeypatch):
    async def fake_chat(system, user, **kwargs):
        return '{"confidence": 87, "critique": "looks correct"}'

    monkeypatch.setattr(llm, "chat", fake_chat)
    result = await llm.verify_patch("err", "diff")
    assert result["confidence"] == 87
    assert result["critique"] == "looks correct"
