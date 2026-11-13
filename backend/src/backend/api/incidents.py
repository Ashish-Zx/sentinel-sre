from fastapi import APIRouter

router = APIRouter(tags=["incidents"])


@router.get("/incidents")
async def incidents() -> dict[str, str]:
    return {"status": "ok"}