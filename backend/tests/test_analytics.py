import uuid

from sqlalchemy import select

from backend.models.enums import AgentName, IncidentStatus
from backend.models.incident import Incident
from backend.models.llm_trace import LlmTrace
from backend.models.workspace import Workspace
from tests.conftest import TEST_USER


async def _seed(db, *, resolved=1):
    ws = await db.scalar(
        select(Workspace).where(Workspace.clerk_user_id == TEST_USER.clerk_user_id)
    )
    if ws is None:
        ws = Workspace(clerk_user_id=TEST_USER.clerk_user_id)
        db.add(ws)
        await db.flush()

    for i in range(resolved):
        inc = Incident(
            workspace_id=ws.id,
            title=f"Incident {i}",
            status=IncidentStatus.resolved,
            confidence_score=90,
        )
        db.add(inc)
        await db.flush()
        db.add(
            LlmTrace(
                incident_id=inc.id,
                agent_name=AgentName.log_agent,
                model_used="mercury-3",
                prompt_tokens=1000,
                completion_tokens=200,
                cost_usd=0.0024,
                latency_ms=1420,
            )
        )
        db.add(
            LlmTrace(
                incident_id=inc.id,
                agent_name=AgentName.synthesizer,
                model_used="mercury-3",
                prompt_tokens=2000,
                completion_tokens=400,
                cost_usd=0.0098,
                latency_ms=4120,
            )
        )
    await db.commit()
    return ws.id


async def test_summary_counts_and_savings(db_session, client):
    await _seed(db_session, resolved=2)

    r = await client.get("/api/analytics/summary")
    assert r.status_code == 200
    s = r.json()
    assert s["total_incidents"] == 2
    assert s["resolved_incidents"] == 2
    # Savings must be positive because fast-tier agents get a frontier baseline
    assert s["saved_usd"] > 0
    assert s["savings_percentage"] > 0
    assert s["verifier_catch_count"] == 0
    agents = {a["agent_name"] for a in s["by_agent"]}
    assert "log_agent" in agents
    assert "synthesizer" in agents
