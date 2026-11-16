from backend.api import incidents as incidents_api
from backend.models.enums import IncidentStatus


async def test_start_incident_creates_record(client):
    r = await client.post(
        "/api/incidents/start",
        json={"title": "Checkout 500", "raw_error_trace": "KeyError: discount_code"},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == IncidentStatus.investigating.value
    assert body["incident_id"]


async def test_list_incidents_returns_records(client):
    await client.post(
        "/api/incidents/start", json={"title": "Incident A"}
    )
    r = await client.get("/api/incidents")
    assert r.status_code == 200
    incidents = r.json()
    assert any(i["title"] == "Incident A" for i in incidents)


async def test_decision_reject_sets_status(client, monkeypatch):
    async def fake_slack(message):
        return True

    monkeypatch.setattr(incidents_api, "send_slack_alert", fake_slack)

    created = (await client.post(
        "/api/incidents/start", json={"title": "Reject me"}
    )).json()
    incident_id = created["incident_id"]

    r = await client.post(
        f"/api/incidents/{incident_id}/decision",
        json={"approved": False, "feedback": "wrong fix"},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == IncidentStatus.rejected.value
    assert body["github_pr_url"] is None


async def test_decision_approve_opens_pr(client, monkeypatch):
    async def fake_create_pr(*args, **kwargs):
        return "https://github.com/acme/checkout/pull/1"

    async def fake_slack(message):
        return True

    monkeypatch.setattr(incidents_api, "create_draft_pr", fake_create_pr)
    monkeypatch.setattr(incidents_api, "send_slack_alert", fake_slack)

    created = (await client.post(
        "/api/incidents/start", json={"title": "Approve me"}
    )).json()
    incident_id = created["incident_id"]

    r = await client.post(
        f"/api/incidents/{incident_id}/decision",
        json={"approved": True},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == IncidentStatus.resolved.value
    assert body["github_pr_url"] == "https://github.com/acme/checkout/pull/1"


async def test_decision_unknown_incident_404(client):
    r = await client.post(
        "/api/incidents/00000000-0000-0000-0000-000000000000/decision",
        json={"approved": True},
    )
    assert r.status_code == 404
