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
from backend.services.mcp import create_draft_pr, send_slack_alert
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


@router.get("/incidents/{incident_id}", response_model=IncidentOut)
async def get_incident(
    incident_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
) -> Incident:
    """Fetch a single incident (auth-scoped to the user's workspace)."""
    workspace = await get_or_create_workspace(db, user.clerk_user_id)
    incident = await db.get(Incident, incident_id)
    if incident is None or incident.workspace_id != workspace.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Incident not found")
    return incident


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
        context = incident.raw_error_trace or incident.error_summary or incident.title
        async for chunk in stream_investigation(incident_id, db, context):
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

    if not body.approved:
        incident.status = IncidentStatus.rejected
        await db.commit()
        await send_slack_alert(
            f"🚫 SentinelSRE: hotfix for '{incident.title}' was REJECTED.\n"
            f"Engineer feedback: {body.feedback or 'none provided'}"
        )
        return DecisionResponse(status=incident.status, github_pr_url=None)

    # Approved: create a draft PR via GitHub MCP, then notify Slack
    incident.status = IncidentStatus.resolved
    pr_url = await create_draft_pr(
        repo=incident.github_repo_url or "",
        title=f"Hotfix: {incident.title}",
        patch=incident.proposed_patch_diff or "",
        target_file_path=incident.target_file_path or "",
    )
    incident.github_pr_url = pr_url
    await db.commit()
    await send_slack_alert(
        f"✅ SentinelSRE: hotfix for '{incident.title}' approved.\n"
        f"Draft PR opened: {pr_url}"
    )
    return DecisionResponse(status=incident.status, github_pr_url=pr_url)