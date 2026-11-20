"""A stream_investigation with an unparseable / random input must NOT fabricate the demo checkout fix."""

import json

from backend.models.enums import IncidentStatus
from backend.models.incident import Incident
from backend.models.workspace import Workspace
from backend.services.investigation import stream_investigation

TEST_CLERK = "test-user-1"


async def _seed_incident(db):
    ws = Workspace(clerk_user_id=TEST_CLERK)
    db.add(ws)
    await db.commit()
    await db.refresh(ws)
    inc = Incident(
        workspace_id=ws.id,
        title="error",
        status=IncidentStatus.investigating,
    )
    db.add(inc)
    await db.commit()
    await db.refresh(inc)
    return inc.id


async def _collect_events(db, incident_id, context):
    events = []
    async for chunk in stream_investigation(incident_id, db, context):
        if chunk.startswith("data: "):
            events.append(json.loads(chunk[6:]))
    return events


async def test_unparseable_input_does_not_fabricate_demo(db_session):
    incident_id = await _seed_incident(db_session)
    events = await _collect_events(db_session, incident_id, "errorr")

    synth = next(
        e
        for e in events
        if e.get("type") == "agent_completed" and e.get("agent_name") == "synthesizer"
    )
    report = synth["root_cause_report"]

    # Everything but the honest "unable to parse" message.
    assert "Unable to Parse" in report
    assert "discount_code" not in report
    assert "checkout.py" not in report
    assert "promo_code" not in report
    assert synth["proposed_patch_diff"] is None
    assert synth["target_file_path"] is None

    ver = next(e for e in events if e.get("type") == "verifier_result")
    assert ver["confidence_score"] == 0
    assert "Nothing to verify" in ver["verifier_critique"]

    paused = next(e for e in events if e.get("type") == "hitl_paused")
    assert paused["proposed_patch_diff"] is None
    assert "unparseable input" in paused["escalation_reason"]
