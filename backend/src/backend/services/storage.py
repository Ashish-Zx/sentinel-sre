from functools import lru_cache
from typing import Literal
from uuid import uuid4

import boto3
from botocore.client import Config as BotoConfig

from backend.core.config import get_settings


@lru_cache(maxsize=1)
def _s3_client():
    settings = get_settings()
    return boto3.client(
        "s3",
        endpoint_url=settings.r2_endpoint_url or None,
        aws_access_key_id=settings.r2_access_key_id,
        aws_secret_access_key=settings.r2_secret_access_key,
        region_name="auto",
        config=BotoConfig(signature_version="s3v4"),
    )


def delete_object(key: str) -> None:
    """Delete an uploaded object from R2 by its key."""
    settings = get_settings()
    _s3_client().delete_object(Bucket=settings.r2_bucket, Key=key)


async def create_presigned_upload(
    file_name: str,
    content_type: str,
    expires_in: int = 600,
) -> dict:
    """Generate a presigned PUT URL for a file key in R2."""
    settings = get_settings()
    key = f"{uuid4().hex}/{file_name}"

    url = _s3_client().generate_presigned_url(
        "put_object",
        Params={
            "Bucket": settings.r2_bucket,
            "Key": key,
            "ContentType": content_type,
        },
        ExpiresIn=expires_in,
        HttpMethod="PUT",
    )

    return {
        "url": url,
        "key": key,
        "expires_in": expires_in,
    }


SUPPORTED_TYPES: dict[str, Literal["runbook_pdf", "crash_log", "postmortem"]] = {
    "application/pdf": "runbook_pdf",
    "text/plain": "crash_log",
    "text/markdown": "postmortem",
    "application/json": "crash_log",
}
