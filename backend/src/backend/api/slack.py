"""Per-user Slack OAuth.

Flow (mirrors the GitHub OAuth flow):
1. GET /api/slack/authorize  -> Slack OAuth authorize URL + server-side `state`
                                 bound to the authenticated Clerk user.
2. Slack redirects the browser to /api/slack/callback?code=...&state=...
3. The backend exchanges `code` for a bot access token, encrypts it on the
   user's workspace, then redirects the browser to the frontend.

Notifications for that user then post to Slack using their connected bot token
(over the global SLACK_WEBHOOK_URL).
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
from backend.models.slack_oauth import SlackOauthState
from backend.services.workspaces import get_or_create_workspace

router = APIRouter(tags=["slack"])

_SLACK_AUTHORIZE = "https://slack.com/oauth/v2/authorize"
_SLACK_TOKEN = "https://slack.com/api/oauth.v2.access"
_SLACK_API = "https://slack.com/api"


class SlackAuthorizeResponse(BaseModel):
    url: str
    state: str


class SlackStatusResponse(BaseModel):
    connected: bool
    team: str | None = None
    channel_id: str | None = None


class SlackChannel(BaseModel):
    id: str
    name: str


class SlackChannelsResponse(BaseModel):
    connected: bool
    channels: list[SlackChannel] = []


class SlackChannelUpdate(BaseModel):
    channel_id: str


def _slack_oauth_config() -> tuple[str, str]:
    settings = get_settings()
    if not settings.slack_client_id or not settings.slack_client_secret:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Slack OAuth is not configured on this deployment",
        )
    return settings.slack_client_id, settings.slack_client_secret


def _callback_url(request: Request) -> str:
    configured = get_settings().slack_oauth_callback_url
    if configured:
        return configured
    return str(request.base_url).rstrip("/") + "/api/slack/callback"


@router.get("/slack/authorize", response_model=SlackAuthorizeResponse)
async def slack_authorize(
    request: Request,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
) -> SlackAuthorizeResponse:
    client_id, _ = _slack_oauth_config()

    state = str(uuid.uuid4())
    db.add(SlackOauthState(state=uuid.UUID(state), clerk_user_id=user.clerk_user_id))
    await db.commit()

    query = urlencode(
        {
            "client_id": client_id,
            "redirect_uri": _callback_url(request),
            "scope": "chat:write,channels:read",
            "state": state,
        }
    )
    return SlackAuthorizeResponse(url=f"{_SLACK_AUTHORIZE}?{query}", state=state)


@router.get("/slack/callback")
async def slack_callback(
    request: Request,
    code: str,
    state: str,
    db: AsyncSession = Depends(get_db),
) -> RedirectResponse:
    """Handle Slack's redirect after the user authorizes the app."""
    settings = get_settings()

    try:
        state_uuid = uuid.UUID(state)
    except ValueError:
        return RedirectResponse(
            f"{settings.frontend_url}/dashboard?slack=error&message=invalid_state"
        )

    row = (
        await db.execute(
            select(SlackOauthState).where(SlackOauthState.state == state_uuid)
        )
    ).scalars().first()

    if row is None:
        return RedirectResponse(
            f"{settings.frontend_url}/dashboard?slack=error&message=invalid_state"
        )

    client_id, client_secret = _slack_oauth_config()
    token_data = await _exchange_code_for_token(
        client_id, client_secret, code, _callback_url(request)
    )
    if token_data is None:
        return RedirectResponse(
            f"{settings.frontend_url}/dashboard?slack=error&message=token_exchange_failed"
        )

    bot_token = token_data.get("access_token")
    if not bot_token:
        return RedirectResponse(
            f"{settings.frontend_url}/dashboard?slack=error&message=invalid_token"
        )

    team = (token_data.get("team") or {}).get("name")
    workspace = await get_or_create_workspace(db, row.clerk_user_id)
    workspace.slack_token_encrypted = encrypt_secret(bot_token)
    workspace.slack_team_name = team
    # Keep any previously chosen default channel.
    await db.commit()

    await db.execute(delete(SlackOauthState).where(SlackOauthState.state == state_uuid))
    await db.commit()

    team_query = urlencode({"team": team or ""})
    return RedirectResponse(
        f"{settings.frontend_url}/dashboard?slack=connected&{team_query}"
    )


@router.get("/slack/status", response_model=SlackStatusResponse)
async def slack_status(
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
) -> SlackStatusResponse:
    workspace = await get_or_create_workspace(db, user.clerk_user_id)
    return SlackStatusResponse(
        connected=bool(workspace.slack_token_encrypted),
        team=workspace.slack_team_name,
        channel_id=workspace.slack_channel_id,
    )


@router.get("/slack/channels", response_model=SlackChannelsResponse)
async def slack_channels(
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
) -> SlackChannelsResponse:
    """List channels the connected Slack app can post to."""
    workspace = await get_or_create_workspace(db, user.clerk_user_id)
    token = decrypt_secret(workspace.slack_token_encrypted)
    if not token:
        return SlackChannelsResponse(connected=False)

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(
                f"{_SLACK_API}/conversations.list",
                headers={"Authorization": f"Bearer {token}"},
                params={"types": "public_channel,private_channel", "limit": 200, "exclude_archived": "true"},
            )
            body = resp.json()
            if not body.get("ok"):
                return SlackChannelsResponse(connected=True)
            channels = [
                SlackChannel(id=c["id"], name=c["name"])
                for c in body.get("channels", [])
                if c.get("id") and c.get("name")
            ]
            channels.sort(key=lambda c: c.name.lower())
            return SlackChannelsResponse(connected=True, channels=channels)
    except Exception:
        return SlackChannelsResponse(connected=True)


@router.patch("/slack", response_model=SlackStatusResponse)
async def slack_set_channel(
    body: SlackChannelUpdate,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
) -> SlackStatusResponse:
    workspace = await get_or_create_workspace(db, user.clerk_user_id)
    if not workspace.slack_token_encrypted:
        raise HTTPException(status_code=400, detail="Slack not connected")
    workspace.slack_channel_id = body.channel_id
    await db.commit()
    return SlackStatusResponse(
        connected=True, team=workspace.slack_team_name, channel_id=workspace.slack_channel_id
    )


@router.delete("/slack", response_model=SlackStatusResponse)
async def slack_disconnect(
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
) -> SlackStatusResponse:
    workspace = await get_or_create_workspace(db, user.clerk_user_id)
    workspace.slack_token_encrypted = None
    workspace.slack_team_name = None
    workspace.slack_channel_id = None
    await db.commit()
    return SlackStatusResponse(connected=False, channel_id=None)


async def _exchange_code_for_token(
    client_id: str, client_secret: str, code: str, redirect_uri: str
) -> dict | None:
    """Exchange an authorization code for an access token (v2)."""
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                _SLACK_TOKEN,
                data={
                    "client_id": client_id,
                    "client_secret": client_secret,
                    "code": code,
                    "redirect_uri": redirect_uri,
                },
            )
            body = resp.json()
            if not body.get("ok"):
                return None
            return body
    except Exception:
        return None
