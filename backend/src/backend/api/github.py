"""Per-user GitHub OAuth.

Flow:
1. GET /api/github/authorize  -> returns a GitHub OAuth authorize URL + server-side `state`
                                  bound to the authenticated Clerk user.
2. GitHub redirects the browser to /api/github/callback?code=...&state=...
3. The backend exchanges `code` for an access token, encrypts it with the
   user's workspace, then redirects the browser to the frontend.

The resulting per-user token is used (instead of the global GITHUB_ACCESS_TOKEN)
when generating draft PRs for that user's incidents.
"""

import uuid
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.config import get_settings
from backend.core.security import (
    CurrentUser,
    decrypt_secret,
    encrypt_secret,
    get_current_user,
)
from backend.db.session import get_db
from backend.models.github_oauth import GithubOauthState
from backend.services.mcp import _normalize_repo
from backend.services.workspaces import get_or_create_workspace

router = APIRouter(tags=["github"])

_GH_AUTHORIZE = "https://github.com/login/oauth/authorize"
_GH_TOKEN = "https://github.com/login/oauth/access_token"
_GH_API = "https://api.github.com"


class GithubAuthorizeResponse(BaseModel):
    url: str
    state: str


class GithubStatusResponse(BaseModel):
    connected: bool
    repo_url: str | None = None


class GithubReposResponse(BaseModel):
    connected: bool
    repos: list[str] = []


class GithubCommit(BaseModel):
    sha: str
    message: str


class GithubCommitsResponse(BaseModel):
    connected: bool
    commits: list[GithubCommit] = []


def _github_oauth_config() -> tuple[str, str]:
    settings = get_settings()
    if not settings.github_client_id or not settings.github_client_secret:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="GitHub OAuth is not configured on this deployment",
        )
    return settings.github_client_id, settings.github_client_secret


def _callback_url(request: Request) -> str:
    configured = get_settings().github_oauth_callback_url
    if configured:
        return configured
    return str(request.base_url).rstrip("/") + "/api/github/callback"


@router.get("/github/authorize", response_model=GithubAuthorizeResponse)
async def github_authorize(
    request: Request,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
) -> GithubAuthorizeResponse:
    client_id, _ = _github_oauth_config()

    state = str(uuid.uuid4())
    db.add(GithubOauthState(state=uuid.UUID(state), clerk_user_id=user.clerk_user_id))
    await db.commit()

    query = urlencode(
        {
            "client_id": client_id,
            "redirect_uri": _callback_url(request),
            "scope": "repo",
            "state": state,
            "allow_signup": "false",
        }
    )
    return GithubAuthorizeResponse(url=f"{_GH_AUTHORIZE}?{query}", state=state)


@router.get("/github/callback")
async def github_callback(
    request: Request,
    code: str,
    state: str,
    db: AsyncSession = Depends(get_db),
) -> RedirectResponse:
    """Handle GitHub's redirect after the user authorizes the app."""
    settings = get_settings()

    try:
        state_uuid = uuid.UUID(state)
    except ValueError:
        return RedirectResponse(
            f"{settings.frontend_url}/dashboard?github=error&message=invalid_state"
        )

    row = (
        await db.execute(
            select(GithubOauthState).where(GithubOauthState.state == state_uuid)
        )
    ).scalars().first()

    if row is None:
        return RedirectResponse(
            f"{settings.frontend_url}/dashboard?github=error&message=invalid_state"
        )

    client_id, client_secret = _github_oauth_config()

    token = await _exchange_code_for_token(
        client_id, client_secret, code, _callback_url(request)
    )
    if token is None:
        return RedirectResponse(
            f"{settings.frontend_url}/dashboard?github=error&message=token_exchange_failed"
        )

    # Confirm the token is valid and belongs to a real GitHub account.
    github_login = await _get_github_login(token)
    if github_login is None:
        return RedirectResponse(
            f"{settings.frontend_url}/dashboard?github=error&message=invalid_token"
        )

    # Persist the (encrypted) token on the user's workspace.
    workspace = await get_or_create_workspace(db, row.clerk_user_id)
    workspace.github_pat_encrypted = encrypt_secret(token)
    await db.commit()

    # Consume the one-time state.
    await db.execute(delete(GithubOauthState).where(GithubOauthState.state == state_uuid))
    await db.commit()

    return RedirectResponse(
        f"{settings.frontend_url}/dashboard?github=connected&login={github_login}"
    )


@router.get("/github/status", response_model=GithubStatusResponse)
async def github_status(
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
) -> GithubStatusResponse:
    workspace = await get_or_create_workspace(db, user.clerk_user_id)
    return GithubStatusResponse(
        connected=bool(workspace.github_pat_encrypted),
        repo_url=workspace.github_repo_url,
    )


@router.get("/github/repos", response_model=GithubReposResponse)
async def github_repos(
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
) -> GithubReposResponse:
    """List repositories the connected user can access (for the dropdown).

    Returns ``connected=False`` when the user hasn't connected GitHub yet.
    """
    workspace = await get_or_create_workspace(db, user.clerk_user_id)
    token = decrypt_secret(workspace.github_pat_encrypted)
    if not token:
        return GithubReposResponse(connected=False)

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(
                f"{_GH_API}/user/repos",
                headers={
                    "Authorization": f"Bearer {token}",
                    "Accept": "application/vnd.github+json",
                },
                params={
                    "per_page": 100,
                    "affiliation": "owner,collaborator",
                    "sort": "updated",
                },
            )
            if resp.status_code >= 300:
                return GithubReposResponse(connected=True)
            data = resp.json()
    except Exception:
        return GithubReposResponse(connected=True)

    repos = sorted(
        {r.get("full_name") for r in data if r.get("full_name")}
    )
    return GithubReposResponse(connected=True, repos=repos)


@router.get("/github/commits", response_model=GithubCommitsResponse)
async def github_commits(
    repo: str = "",
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
) -> GithubCommitsResponse:
    """List recent commits for a repo the user can access (for the dropdown).

    ``repo`` may be ``owner/repo`` or a URL. Falls back to the workspace's
    default repo when not provided.
    """
    workspace = await get_or_create_workspace(db, user.clerk_user_id)
    token = decrypt_secret(workspace.github_pat_encrypted)
    if not token:
        return GithubCommitsResponse(connected=False)

    repo = _normalize_repo(repo or workspace.github_repo_url or "")
    if not repo:
        return GithubCommitsResponse(connected=True)

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(
                f"{_GH_API}/repos/{repo}/commits",
                headers={
                    "Authorization": f"Bearer {token}",
                    "Accept": "application/vnd.github+json",
                },
                params={"per_page": 20},
            )
            if resp.status_code >= 300:
                return GithubCommitsResponse(connected=True)
            data = resp.json()
    except Exception:
        return GithubCommitsResponse(connected=True)

    commits: list[GithubCommit] = []
    for c in data:
        sha = c.get("sha", "")
        message = ((c.get("commit") or {}).get("message") or "").split("\n")[0]
        if sha:
            commits.append(GithubCommit(sha=sha, message=message))
    return GithubCommitsResponse(connected=True, commits=commits)


@router.delete("/github", response_model=GithubStatusResponse)
async def github_disconnect(
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
) -> GithubStatusResponse:
    workspace = await get_or_create_workspace(db, user.clerk_user_id)
    workspace.github_pat_encrypted = None
    await db.commit()
    return GithubStatusResponse(connected=False, repo_url=None)


async def _exchange_code_for_token(
    client_id: str, client_secret: str, code: str, redirect_uri: str
) -> str | None:
    """Exchange an authorization code for an access token."""
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                _GH_TOKEN,
                data={
                    "client_id": client_id,
                    "client_secret": client_secret,
                    "code": code,
                    "redirect_uri": redirect_uri,
                },
                headers={"Accept": "application/json"},
            )
            if resp.status_code >= 300:
                return None
            body = resp.json()
            return (body or {}).get("access_token")
    except Exception:
        return None


async def _get_github_login(token: str) -> str | None:
    """Returns the GitHub login associated with a token, or None if invalid."""
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(
                f"{_GH_API}/user",
                headers={"Authorization": f"Bearer {token}", "Accept": "application/vnd.github+json"},
            )
            if resp.status_code >= 300:
                return None
            return (resp.json() or {}).get("login")
    except Exception:
        return None
