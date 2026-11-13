from fastapi import APIRouter

router = APIRouter(tags=["auth"])


@router.get("/auth")
async def auth() -> dict[str, str]:
    return {"status": "ok"}