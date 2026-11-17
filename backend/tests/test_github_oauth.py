async def test_github_authorize_requires_auth(anon_client):
    r = await anon_client.get("/api/github/authorize")
    assert r.status_code == 401


async def test_github_status_requires_auth(anon_client):
    r = await anon_client.get("/api/github/status")
    assert r.status_code == 401


async def test_github_disconnect_requires_auth(anon_client):
    r = await anon_client.delete("/api/github")
    assert r.status_code == 401


async def test_github_authorize_returns_url_when_configured(client):
    # Behavior depends on whether OAuth is configured in this environment.
    from backend.core.config import get_settings

    r = await client.get("/api/github/authorize")
    if not get_settings().github_client_id:
        assert r.status_code == 503
        return
    assert r.status_code == 200
    body = r.json()
    assert body["url"].startswith("https://github.com/login/oauth/authorize")
    assert "state=" in body["url"]
    assert body["state"]


async def test_github_status_defaults_to_disconnected(client):
    r = await client.get("/api/github/status")
    assert r.status_code == 200
    body = r.json()
    assert body["connected"] is False
    assert body["repo_url"] is None


async def test_github_repos_defaults_to_disconnected(client):
    r = await client.get("/api/github/repos")
    assert r.status_code == 200
    body = r.json()
    assert body["connected"] is False
    assert body["repos"] == []


async def test_github_commits_defaults_to_disconnected(client):
    r = await client.get("/api/github/commits?repo=acme/corp")
    assert r.status_code == 200
    body = r.json()
    assert body["connected"] is False
    assert body["commits"] == []
