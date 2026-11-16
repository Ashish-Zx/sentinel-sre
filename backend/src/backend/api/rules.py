from uuid import UUID

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.security import CurrentUser, get_current_user
from backend.db.session import get_db
from backend.models.memory import ProceduralRule
from backend.services.workspaces import get_or_create_workspace

router = APIRouter(tags=["rules"])


class RulesOut(BaseModel):
    id: UUID | None = None
    workspace_id: UUID | None = None
    min_confidence_threshold: int = 85
    protected_paths: list[str] = []
    custom_instructions: str | None = None


class RulesIn(BaseModel):
    min_confidence_threshold: int = 85
    protected_paths: list[str] = []
    custom_instructions: str | None = None


@router.get("/rules", response_model=RulesOut)
async def get_rules(
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
) -> RulesOut:
    workspace = await get_or_create_workspace(db, user.clerk_user_id)
    result = await db.execute(
        select(ProceduralRule).where(ProceduralRule.workspace_id == workspace.id)
    )
    rule = result.scalar_one_or_none()
    if rule is None:
        return RulesOut(
            workspace_id=workspace.id,
            min_confidence_threshold=85,
            protected_paths=["auth/", "payments/", "migrations/", "api/checkout.py"],
            custom_instructions=(
                "Never modify database migration files automatically. "
                "Always require human approval for payment, Stripe, or checkout routes."
            ),
        )
    return RulesOut(
        id=rule.id,
        workspace_id=rule.workspace_id,
        min_confidence_threshold=rule.min_confidence_threshold,
        protected_paths=rule.protected_paths or [],
        custom_instructions=rule.custom_instructions,
    )


@router.put("/rules", response_model=RulesOut)
async def put_rules(
    body: RulesIn,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
) -> RulesOut:
    workspace = await get_or_create_workspace(db, user.clerk_user_id)
    result = await db.execute(
        select(ProceduralRule).where(ProceduralRule.workspace_id == workspace.id)
    )
    rule = result.scalar_one_or_none()
    if rule is None:
        rule = ProceduralRule(workspace_id=workspace.id)
        db.add(rule)

    rule.min_confidence_threshold = body.min_confidence_threshold
    rule.protected_paths = body.protected_paths
    rule.custom_instructions = body.custom_instructions
    await db.commit()
    await db.refresh(rule)

    return RulesOut(
        id=rule.id,
        workspace_id=rule.workspace_id,
        min_confidence_threshold=rule.min_confidence_threshold,
        protected_paths=rule.protected_paths or [],
        custom_instructions=rule.custom_instructions,
    )
