from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.security import CurrentUser, decrypt_secret, get_current_user
from backend.db.session import get_db
from backend.models.enums import IncidentStatus
from backend.models.incident import Incident
from backend.services.investigation import stream_investigation
from backend.services.mcp import apply_hotfix_direct, create_draft_pr, send_slack_alert
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
    # When True, commit the hotfix directly to the target branch (auto-deploy)
    # instead of opening a draft PR on a new branch.
    direct_commit: bool = False
    target_branch: str | None = None


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
    if body.github_repo_url and not workspace.github_repo_url:
        workspace.github_repo_url = body.github_repo_url
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

    slack_token = decrypt_secret(workspace.slack_token_encrypted)
    slack_channel = workspace.slack_channel_id

    if not body.approved:
        incident.status = IncidentStatus.rejected
        await db.commit()
        await send_slack_alert(
            f"🚫 SentinelSRE: hotfix for '{incident.title}' was REJECTED.\n"
            f"Engineer feedback: {body.feedback or 'none provided'}",
            token=slack_token,
            channel=slack_channel,
        )
        return DecisionResponse(status=incident.status, github_pr_url=None)

    # Approved: apply the fix via GitHub, then notify Slack
    incident.status = IncidentStatus.resolved
    # Prefer the user's own connected GitHub token; fall back to the global one.
    user_token = decrypt_secret(workspace.github_pat_encrypted)
    repo = incident.github_repo_url or workspace.github_repo_url or ""
    patch = incident.proposed_patch_diff or ""
    target_file_path = incident.target_file_path or ""

    pr_url: str | None = None
    if body.direct_commit:
        # Commit directly to the branch (defaults to the repo default branch).
        commit_url = await apply_hotfix_direct(
            repo=repo,
            title=f"Hotfix: {incident.title}",
            patch=patch,
            target_file_path=target_file_path,
            branch=body.target_branch,
            access_token=user_token,
        )
        if commit_url:
            pr_url = commit_url
        else:
            # Surface the failure rather than silently downgrading to a new-branch
            # PR, so the engineer knows the direct commit did not land.
            incident.status = IncidentStatus.awaiting_approval
            await db.commit()
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Direct commit to the target branch failed. No changes were pushed. Please review the patch and retry, or use the draft-PR delivery mode.",
            )

    if pr_url is None:
        # Draft PR (new branch) delivery.
        pr_url = await create_draft_pr(
            repo=repo,
            title=f"Hotfix: {incident.title}",
            patch=patch,
            target_file_path=target_file_path,
            access_token=user_token,
        )

    incident.github_pr_url = pr_url
    await db.commit()
    await send_slack_alert(
        f"✅ SentinelSRE: hotfix for '{incident.title}' approved.\n"
        f"{'Direct commit' if body.direct_commit else 'Draft PR'} opened: {pr_url}",
        token=slack_token,
        channel=slack_channel,
    )
    return DecisionResponse(status=incident.status, github_pr_url=pr_url)


@router.delete("/incidents/{incident_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_incident(
    incident_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
) -> None:
    """Delete an incident owned by the current user's workspace."""
    workspace = await get_or_create_workspace(db, user.clerk_user_id)
    result = await db.execute(
        select(Incident).where(
            Incident.id == incident_id,
            Incident.workspace_id == workspace.id,
        )
    )
    incident = result.scalar_one_or_none()
    if incident is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Incident not found",
        )
    await db.delete(incident)
    await db.commit()