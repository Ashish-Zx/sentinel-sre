from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.security import CurrentUser, get_current_user
from backend.db.session import get_db
from backend.models.enums import IncidentStatus
from backend.models.incident import Incident

router = APIRouter(tags=["incidents"])


class IncidentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    workspace_id: UUID
    title: str
    raw_error_log_s3_key: str | None
    error_summary: str | None
    status: IncidentStatus
    root_cause_report: str | None
    proposed_patch_diff: str | None
    target_file_path: str | None
    confidence_score: int | None
    verifier_critique: str | None
    human_feedback: str | None
    github_pr_url: str | None
    created_at: datetime


@router.get("/incidents", response_model=list[IncidentOut])
async def incidents(
    db: AsyncSession = Depends(get_db),
    _user: CurrentUser = Depends(get_current_user),
) -> list[Incident]:
    result = await db.execute(select(Incident).order_by(Incident.created_at.desc()))
    return list(result.scalars().all())