"""Tests for deleting uploaded runbooks/docs, memory, and workspace data."""

from sqlalchemy import delete, select

from backend.models.enums import FileType, IncidentStatus, IngestionStatus
from backend.models.incident import Incident
from backend.models.knowledge_file import KnowledgeFile
from backend.models.memory import ProceduralRule, SemanticMemoryChunk
from backend.models.workspace import Workspace

TEST_CLERK = "test-user-1"
DIM = 1536


async def _seed_workspace(db):
    existing = (
        await db.execute(select(Workspace).where(Workspace.clerk_user_id == TEST_CLERK))
    ).scalar_one_or_none()
    if existing is not None:
        return existing
    ws = Workspace(clerk_user_id=TEST_CLERK)
    db.add(ws)
    await db.commit()
    await db.refresh(ws)
    return ws


async def _seed_file(
    db,
    workspace_id,
    name="runbook.pdf",
    ftype=FileType.runbook_pdf,
    key="abc/runbook.pdf",
):
    f = KnowledgeFile(
        workspace_id=workspace_id,
        file_name=name,
        file_type=ftype,
        s3_key=key,
        ingestion_status=IngestionStatus.indexed,
    )
    db.add(f)
    await db.commit()
    await db.refresh(f)
    return f


async def _seed_chunk(db, workspace_id, file_id=None):
    db.add(
        SemanticMemoryChunk(
            workspace_id=workspace_id,
            file_id=file_id,
            content="chunk",
            metadata_={},
            embedding=[0.0] * DIM,
        )
    )
    await db.commit()


async def _seed_rule(db, workspace_id):
    db.add(ProceduralRule(workspace_id=workspace_id))
    await db.commit()


async def _seed_incident(db, workspace_id):
    db.add(
        Incident(
            workspace_id=workspace_id,
            title="inc",
            status=IncidentStatus.investigating,
        )
    )
    await db.commit()


# --- Individual knowledge file deletion ---


async def test_delete_knowledge_file_removes_record_and_chunks(client, db_session):
    ws = await _seed_workspace(db_session)
    f = await _seed_file(db_session, ws.id)
    await _seed_chunk(db_session, ws.id, f.id)

    r = await client.delete(f"/api/knowledge/{f.id}")
    assert r.status_code == 204

    assert (
        await db_session.execute(select(KnowledgeFile).where(KnowledgeFile.id == f.id))
    ).scalar_one_or_none() is None
    chunks = await db_session.execute(
        select(SemanticMemoryChunk).where(SemanticMemoryChunk.file_id == f.id)
    )
    assert chunks.scalars().all() == []


async def test_delete_knowledge_file_rejects_foreign_file(client, db_session):
    ws = await _seed_workspace(db_session)
    other = Workspace(clerk_user_id="other-user")
    db_session.add(other)
    await db_session.commit()
    f = await _seed_file(db_session, other.id)

    r = await client.delete(f"/api/knowledge/{f.id}")
    assert r.status_code == 404
    assert (
        await db_session.execute(select(KnowledgeFile).where(KnowledgeFile.id == f.id))
    ).scalar_one_or_none() is not None


async def test_delete_knowledge_file_missing_returns_404(client, db_session):
    await _seed_workspace(db_session)
    r = await client.delete("/api/knowledge/00000000-0000-0000-0000-000000000000")
    assert r.status_code == 404


async def test_delete_all_knowledge_files(client, db_session):
    ws = await _seed_workspace(db_session)
    f1 = await _seed_file(db_session, ws.id)
    f2 = await _seed_file(
        db_session, ws.id, name="doc.md", ftype=FileType.postmortem, key="xyz/doc.md"
    )
    await _seed_chunk(db_session, ws.id, f1.id)
    await _seed_chunk(db_session, ws.id, f2.id)

    r = await client.delete("/api/knowledge")
    assert r.status_code == 204

    files = await db_session.execute(
        select(KnowledgeFile).where(KnowledgeFile.workspace_id == ws.id)
    )
    assert files.scalars().all() == []
    chunks = await db_session.execute(
        select(SemanticMemoryChunk).where(SemanticMemoryChunk.workspace_id == ws.id)
    )
    assert chunks.scalars().all() == []


# --- Memory clearing ---


async def test_clear_memory_removes_chunks_and_rules(client, db_session):
    ws = await _seed_workspace(db_session)
    await _seed_chunk(db_session, ws.id)
    await _seed_rule(db_session, ws.id)

    r = await client.delete("/api/memory")
    assert r.status_code == 200
    body = r.json()
    assert body["semantic_chunks_deleted"] == 1
    assert body["procedural_rules_deleted"] == 1

    chunks = await db_session.execute(
        select(SemanticMemoryChunk).where(SemanticMemoryChunk.workspace_id == ws.id)
    )
    assert chunks.scalars().all() == []
    rules = await db_session.execute(
        select(ProceduralRule).where(ProceduralRule.workspace_id == ws.id)
    )
    assert rules.scalars().all() == []


# --- Full workspace reset ---


async def test_reset_workspace_data_wipes_everything(client, db_session):
    ws = await _seed_workspace(db_session)

    # Wipe anything left over by other tests in this shared-session DB so the
    # seeded set below is the entire population (deterministic counts).
    await db_session.execute(
        delete(KnowledgeFile).where(KnowledgeFile.workspace_id == ws.id)
    )
    await db_session.execute(
        delete(SemanticMemoryChunk).where(
            SemanticMemoryChunk.workspace_id == ws.id
        )
    )
    await db_session.execute(
        delete(ProceduralRule).where(ProceduralRule.workspace_id == ws.id)
    )
    await db_session.execute(
        delete(Incident).where(Incident.workspace_id == ws.id)
    )
    await db_session.commit()

    f1 = await _seed_file(db_session, ws.id)
    await _seed_file(db_session, ws.id, name="doc.md", ftype=FileType.postmortem)
    await _seed_chunk(db_session, ws.id, f1.id)
    await _seed_rule(db_session, ws.id)
    await _seed_incident(db_session, ws.id)

    r = await client.delete("/api/workspace/data")
    assert r.status_code == 200
    body = r.json()
    assert body["files_deleted"] == 2
    assert body["memory_chunks_deleted"] == 1
    assert body["procedural_rules_deleted"] == 1
    assert body["incidents_deleted"] == 1

    assert (
        await db_session.execute(
            select(KnowledgeFile).where(KnowledgeFile.workspace_id == ws.id)
        )
    ).scalars().all() == []
    assert (
        await db_session.execute(
            select(SemanticMemoryChunk).where(
                SemanticMemoryChunk.workspace_id == ws.id
            )
        )
    ).scalars().all() == []
    assert (
        await db_session.execute(
            select(ProceduralRule).where(ProceduralRule.workspace_id == ws.id)
        )
    ).scalars().all() == []
    assert (
        await db_session.execute(
            select(Incident).where(Incident.workspace_id == ws.id)
        )
    ).scalars().all() == []


# --- Auth gating ---


async def test_delete_endpoints_require_auth(anon_client):
    r = await anon_client.delete(
        "/api/knowledge/00000000-0000-0000-0000-000000000000"
    )
    assert r.status_code == 401
    assert (await anon_client.delete("/api/memory")).status_code == 401
    assert (await anon_client.delete("/api/workspace/data")).status_code == 401
