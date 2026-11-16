from fastapi import APIRouter, Depends

from backend.core.security import CurrentUser, get_current_user

router = APIRouter(tags=["auth"])


@router.get("/auth")
async def auth() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/auth/me", response_model=CurrentUser)
async def auth_me(current_user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
    """Return the authenticated Clerk user (requires a valid Bearer token)."""
    return current_user