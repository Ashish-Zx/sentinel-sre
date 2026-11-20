from fastapi import APIRouter, Depends, status
from pydantic import BaseModel
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.security import CurrentUser, get_current_user
from backend.db.session import get_db
from backend.models.incident import Incident
from backend.models.knowledge_file import KnowledgeFile
from backend.models.memory import ProceduralRule, SemanticMemoryChunk
from backend.services.storage import delete_object
from backend.services.workspaces import get_or_create_workspace

router = APIRouter(tags=["workspace"])


class ResetWorkspaceResponse(BaseModel):
    files_deleted: int
    memory_chunks_deleted: int
    procedural_rules_deleted: int
    incidents_deleted: int


@router.delete("/workspace/data", response_model=ResetWorkspaceResponse)
async def reset_workspace_data(
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
) -> ResetWorkspaceResponse:
    """Delete ALL data for the workspace: runbooks/docs, memory, rules, and incidents.

    The workspace row itself (and its connected GitHub/Slack credentials) is kept.
    """
    workspace = await get_or_create_workspace(db, user.clerk_user_id)
    ws_id = workspace.id

    # Collect + remove uploaded objects from R2 first.
    file_result = await db.execute(
        select(KnowledgeFile).where(KnowledgeFile.workspace_id == ws_id)
    )
    files = list(file_result.scalars().all())
    for record in files:
        try:
            delete_object(record.s3_key)
        except Exception:
            # Object may already be deleted; continue with relational cleanup.
            pass

    chunk_result = await db.execute(
        delete(SemanticMemoryChunk).where(SemanticMemoryChunk.workspace_id == ws_id)
    )
    rule_result = await db.execute(
        delete(ProceduralRule).where(ProceduralRule.workspace_id == ws_id)
    )
    incident_result = await db.execute(
        delete(Incident).where(Incident.workspace_id == ws_id)
    )
    await db.execute(delete(KnowledgeFile).where(KnowledgeFile.workspace_id == ws_id))
    await db.commit()

    return ResetWorkspaceResponse(
        files_deleted=len(files),
        memory_chunks_deleted=chunk_result.rowcount or 0,
        procedural_rules_deleted=rule_result.rowcount or 0,
        incidents_deleted=incident_result.rowcount or 0,
    )
