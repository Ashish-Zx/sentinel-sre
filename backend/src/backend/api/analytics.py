from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.security import CurrentUser, get_current_user
from backend.db.session import get_db
from backend.services.analytics import get_finops_summary
from backend.services.workspaces import get_or_create_workspace

router = APIRouter(tags=["analytics"])


@router.get("/analytics/summary")
async def analytics_summary(
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
) -> dict:
    workspace = await get_or_create_workspace(db, user.clerk_user_id)
    return await get_finops_summary(db, workspace.id)
