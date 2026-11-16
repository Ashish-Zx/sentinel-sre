from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from backend.core.security import CurrentUser, get_current_user
from backend.services.storage import SUPPORTED_TYPES, create_presigned_upload

router = APIRouter(tags=["storage"])


class PresignRequest(BaseModel):
    file_name: str = Field(min_length=1, max_length=255)
    content_type: str = Field(min_length=1)


class PresignResponse(BaseModel):
    url: str
    key: str
    expires_in: int


@router.get("/storage")
async def storage() -> dict[str, str]:
    return {"status": "ok"}


@router.post("/storage/presign", response_model=PresignResponse)
async def presign(
    body: PresignRequest,
    _user: CurrentUser = Depends(get_current_user),
) -> PresignResponse:
    """Return a presigned PUT URL for uploading a file to R2."""
    if body.content_type not in SUPPORTED_TYPES:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported content type. Supported: {', '.join(SUPPORTED_TYPES)}",
        )

    result = await create_presigned_upload(
        file_name=body.file_name,
        content_type=body.content_type,
    )
    return PresignResponse(**result)