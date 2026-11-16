from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.security import CurrentUser, get_current_user
from backend.db.session import get_db
from backend.models.enums import IncidentStatus
from backend.models.incident import Incident
from backend.services.investigation import stream_investigation
from backend.services.workspaces import get_or_create_workspace

router = APIRouter(tags=["incidents"])


class IncidentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    workspace_id: UUID
    title: str
    github_repo_url: str | None
    deployed_commit_sha: str | None
    raw_error_trace: str | None
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


class StartIncidentRequest(BaseModel):
    title: str
    github_repo_url: str = ""
    deployed_commit_sha: str | None = None
    raw_error_trace: str | None = None
    raw_error_log_s3_key: str | None = None
    is_demo: bool = False


class StartIncidentResponse(BaseModel):
    incident_id: UUID
    status: IncidentStatus


class DecisionRequest(BaseModel):
    approved: bool
    feedback: str | None = None


class DecisionResponse(BaseModel):
    status: IncidentStatus
    github_pr_url: str | None = None


@router.get("/incidents", response_model=list[IncidentOut])
async def incidents(
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
) -> list[Incident]:
    workspace = await get_or_create_workspace(db, user.clerk_user_id)
    result = await db.execute(
        select(Incident)
        .where(Incident.workspace_id == workspace.id)
        .order_by(Incident.created_at.desc())
    )
    return list(result.scalars().all())


@router.post("/incidents/start", response_model=StartIncidentResponse)
async def start_incident(
    body: StartIncidentRequest,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
) -> StartIncidentResponse:
    workspace = await get_or_create_workspace(db, user.clerk_user_id)

    incident = Incident(
        workspace_id=workspace.id,
        title=body.title,
        github_repo_url=body.github_repo_url or None,
        deployed_commit_sha=body.deployed_commit_sha,
        raw_error_trace=body.raw_error_trace,
        raw_error_log_s3_key=body.raw_error_log_s3_key,
        error_summary=body.raw_error_trace,
        status=IncidentStatus.investigating,
    )
    db.add(incident)
    await db.commit()
    await db.refresh(incident)

    return StartIncidentResponse(
        incident_id=incident.id, status=incident.status
    )


@router.get("/incidents/{incident_id}/stream")
async def stream_incident(
    incident_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
) -> StreamingResponse:
    """SSE stream of the multi-agent investigation for an incident."""
    workspace = await get_or_create_workspace(db, user.clerk_user_id)
    incident = await db.get(Incident, incident_id)
    if incident is None or incident.workspace_id != workspace.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Incident not found")

    async def event_generator():
        async for chunk in stream_investigation(incident_id):
            yield chunk
        # Persist the pending-HITL state after the stream completes
        incident.status = IncidentStatus.awaiting_approval
        await db.commit()

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/incidents/{incident_id}/decision", response_model=DecisionResponse)
async def decide_incident(
    incident_id: UUID,
    body: DecisionRequest,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
) -> DecisionResponse:
    workspace = await get_or_create_workspace(db, user.clerk_user_id)
    incident = await db.get(Incident, incident_id)
    if incident is None or incident.workspace_id != workspace.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Incident not found")

    incident.human_feedback = body.feedback

    if body.approved:
        incident.status = IncidentStatus.resolved
        incident.github_pr_url = (
            f"https://github.com/{incident.github_repo_url or ''}/pull/draft"
        )
    else:
        incident.status = IncidentStatus.rejected

    await db.commit()
    return DecisionResponse(status=incident.status, github_pr_url=incident.github_pr_url)