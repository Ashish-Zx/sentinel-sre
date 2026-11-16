from functools import lru_cache

import httpx
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import jwt
from jose.jwk import construct
from pydantic import BaseModel

from backend.core.config import get_settings

bearer_scheme = HTTPBearer(auto_error=False)


class CurrentUser(BaseModel):
    clerk_user_id: str
    email: str | None = None
    first_name: str | None = None
    last_name: str | None = None


@lru_cache(maxsize=1)
def _jwks_url() -> str:
    return get_settings().clerk_jwks_url


@lru_cache(maxsize=1)
def _issuer() -> str:
    return get_settings().clerk_issuer


async def _fetch_jwks() -> dict:
    """Fetch the JWKS from Clerk's well-known endpoint."""
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(_jwks_url())
        resp.raise_for_status()
        return resp.json()


def _find_signing_key(jwks: dict, kid: str) -> dict:
    for key in jwks.get("keys", []):
        if key.get("kid") == kid:
            return key
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Unknown signing key",
    )


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> CurrentUser:
    """Verify a Clerk-issued JWT and return the current user."""
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials
    try:
        unverified = jwt.get_unverified_header(token)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
        ) from exc

    jwks = await _fetch_jwks()
    signing_key = _find_signing_key(jwks, unverified.get("kid", ""))

    try:
        public_key = construct(signing_key).public_key()
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not construct signing key",
        ) from exc

    try:
        payload = jwt.decode(
            token,
            public_key,
            algorithms=["RS256"],
            issuer=_issuer(),
            options={"verify_aud": False},
        )
    except jwt.JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token verification failed",
        ) from exc

    return CurrentUser(
        clerk_user_id=payload.get("sub") or payload.get("user_id") or "",
        email=payload.get("email"),
        first_name=payload.get("first_name"),
        last_name=payload.get("last_name"),
    )
