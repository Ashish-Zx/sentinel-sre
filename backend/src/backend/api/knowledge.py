from datetime import datetime
from uuid import UUID, uuid4

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.security import CurrentUser, get_current_user
from backend.db.session import get_db
from backend.models.enums import FileType, IngestionStatus
from backend.models.knowledge_file import KnowledgeFile
from backend.models.memory import SemanticMemoryChunk
from backend.services.memory import run_ingestion
from backend.services.storage import delete_object
from backend.services.workspaces import get_or_create_workspace

router = APIRouter(tags=["knowledge"])


class KnowledgeFileOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    workspace_id: UUID
    file_name: str
    file_type: FileType
    s3_key: str
    ingestion_status: IngestionStatus
    created_at: datetime


class IngestRequest(BaseModel):
    file_name: str
    file_type: FileType
    s3_key: str


@router.get("/knowledge", response_model=list[KnowledgeFileOut])
async def list_knowledge_files(
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
) -> list[KnowledgeFile]:
    workspace = await get_or_create_workspace(db, user.clerk_user_id)
    result = await db.execute(
        select(KnowledgeFile)
        .where(KnowledgeFile.workspace_id == workspace.id)
        .order_by(KnowledgeFile.created_at.desc())
    )
    return list(result.scalars().all())


@router.post("/knowledge/ingest", response_model=KnowledgeFileOut, status_code=201)
async def ingest_knowledge(
    body: IngestRequest,
    background: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
) -> KnowledgeFile:
    if body.file_type not in FileType:
        raise HTTPException(status_code=415, detail="Unsupported file type")

    workspace = await get_or_create_workspace(db, user.clerk_user_id)

    record = KnowledgeFile(
        workspace_id=workspace.id,
        file_name=body.file_name,
        file_type=body.file_type,
        s3_key=body.s3_key,
        ingestion_status=IngestionStatus.processing,
    )
    db.add(record)
    await db.commit()
    await db.refresh(record)

    background.add_task(run_ingestion, record.id)
    return record


@router.delete("/knowledge/{file_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_knowledge_file(
    file_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
) -> None:
    """Delete a single uploaded knowledge file (runbook/doc/crash log).

    Removes the object from R2 and any semantic memory chunks derived from it.
    """
    workspace = await get_or_create_workspace(db, user.clerk_user_id)
    result = await db.execute(
        select(KnowledgeFile).where(
            KnowledgeFile.id == file_id,
            KnowledgeFile.workspace_id == workspace.id,
        )
    )
    record = result.scalar_one_or_none()
    if record is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Knowledge file not found")

    try:
        delete_object(record.s3_key)
    except Exception:
        # The R2 object may already be gone; still clean up the metadata + memory.
        pass

    await db.execute(
        delete(SemanticMemoryChunk).where(SemanticMemoryChunk.file_id == record.id)
    )
    await db.delete(record)
    await db.commit()


@router.delete("/knowledge", status_code=status.HTTP_204_NO_CONTENT)
async def delete_all_knowledge_files(
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
) -> None:
    """Delete every uploaded knowledge file for the workspace (R2 + memory + rows)."""
    workspace = await get_or_create_workspace(db, user.clerk_user_id)
    result = await db.execute(
        select(KnowledgeFile).where(KnowledgeFile.workspace_id == workspace.id)
    )
    records = list(result.scalars().all())
    for record in records:
        try:
            delete_object(record.s3_key)
        except Exception:
            pass
    if records:
        file_ids = [record.id for record in records]
        await db.execute(
            delete(SemanticMemoryChunk).where(SemanticMemoryChunk.file_id.in_(file_ids))
        )
        await db.execute(
            delete(KnowledgeFile).where(KnowledgeFile.id.in_(file_ids))
        )
        await db.commit()
