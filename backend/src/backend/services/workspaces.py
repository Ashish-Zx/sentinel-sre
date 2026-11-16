from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.models.workspace import Workspace


async def get_or_create_workspace(db: AsyncSession, clerk_user_id: str) -> Workspace:
    """Return the workspace for a Clerk user, creating it if needed."""
    result = await db.execute(
        select(Workspace).where(Workspace.clerk_user_id == clerk_user_id)
    )
    workspace = result.scalars().first()
    if workspace is None:
        workspace = Workspace(clerk_user_id=clerk_user_id)
        db.add(workspace)
        await db.commit()
        await db.refresh(workspace)
    return workspace
