from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.security import CurrentUser, get_current_user
from backend.db.session import get_db
from backend.models.memory import ProceduralRule, SemanticMemoryChunk
from backend.services.workspaces import get_or_create_workspace

router = APIRouter(tags=["memory"])


class ClearMemoryResponse(BaseModel):
    semantic_chunks_deleted: int
    procedural_rules_deleted: int


@router.delete("/memory", response_model=ClearMemoryResponse)
async def clear_memory(
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
) -> ClearMemoryResponse:
    """Clear all memory for the workspace (semantic memory chunks + procedural rules)."""
    workspace = await get_or_create_workspace(db, user.clerk_user_id)

    chunk_result = await db.execute(
        delete(SemanticMemoryChunk).where(
            SemanticMemoryChunk.workspace_id == workspace.id
        )
    )
    rule_result = await db.execute(
        delete(ProceduralRule).where(ProceduralRule.workspace_id == workspace.id)
    )
    await db.commit()

    return ClearMemoryResponse(
        semantic_chunks_deleted=chunk_result.rowcount or 0,
        procedural_rules_deleted=rule_result.rowcount or 0,
    )
