async def test_public_endpoints_open(anon_client):
    r = await anon_client.get("/api/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"

    r = await anon_client.get("/api/auth")
    assert r.status_code == 200


async def test_auth_me_requires_bearer(anon_client):
    r = await anon_client.get("/api/auth/me")
    assert r.status_code == 401


async def test_incidents_list_requires_auth(anon_client):
    r = await anon_client.get("/api/incidents")
    assert r.status_code == 401


async def test_storage_presign_requires_auth(anon_client):
    r = await anon_client.post(
        "/api/storage/presign",
        json={"file_name": "x.log", "content_type": "text/plain"},
    )
    assert r.status_code == 401


async def test_knowledge_requires_auth(anon_client):
    r = await anon_client.get("/api/knowledge")
    assert r.status_code == 401


async def test_rules_requires_auth(anon_client):
    r = await anon_client.get("/api/rules")
    assert r.status_code == 401


async def test_analytics_requires_auth(anon_client):
    r = await anon_client.get("/api/analytics/summary")
    assert r.status_code == 401
