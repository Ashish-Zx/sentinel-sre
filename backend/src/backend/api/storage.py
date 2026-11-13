from fastapi import APIRouter

router = APIRouter(tags=["storage"])


@router.get("/storage")
async def storage() -> dict[str, str]:
    return {"status": "ok"}