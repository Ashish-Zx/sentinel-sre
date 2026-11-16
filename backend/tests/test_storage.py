async def test_presign_returns_payload(client):
    r = await client.post(
        "/api/storage/presign",
        json={"file_name": "crash.log", "content_type": "text/plain"},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["expires_in"] == 600
    assert body["url"].startswith("https://")
    assert body["key"].endswith("/crash.log")


async def test_presign_rejects_unsupported_type(client):
    r = await client.post(
        "/api/storage/presign",
        json={"file_name": "x.exe", "content_type": "application/x-msdownload"},
    )
    assert r.status_code == 415


async def test_presign_validates_missing_fields(client):
    r = await client.post("/api/storage/presign", json={})
    assert r.status_code == 422
