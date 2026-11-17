async def test_slack_authorize_requires_auth(anon_client):
    r = await anon_client.get("/api/slack/authorize")
    assert r.status_code == 401


async def test_slack_status_requires_auth(anon_client):
    r = await anon_client.get("/api/slack/status")
    assert r.status_code == 401


async def test_slack_status_defaults_to_disconnected(client):
    r = await client.get("/api/slack/status")
    assert r.status_code == 200
    body = r.json()
    assert body["connected"] is False
    assert body["channel_id"] is None


async def test_slack_channels_defaults_to_disconnected(client):
    r = await client.get("/api/slack/channels")
    assert r.status_code == 200
    body = r.json()
    assert body["connected"] is False
    assert body["channels"] == []


async def test_slack_authorize_route_works_or_503(client):
    from backend.core.config import get_settings

    r = await client.get("/api/slack/authorize")
    if not get_settings().slack_client_id:
        assert r.status_code == 503
        return
    assert r.status_code == 200
    body = r.json()
    assert body["url"].startswith("https://slack.com/oauth/v2/authorize")
    assert body["state"]
