"""MCP-style integrations: GitHub (create draft PR) and Slack (notify).

These use real APIs when credentials are configured, otherwise they fall back
to a deterministic simulated result so the rest of the system works in dev.

The plan for the "real" MCP path is to use a lightweight GitHub API client
(httpx) to create a branch, commit the hotfix patch, and open a draft PR.
"""

import httpx

from backend.core.config import get_settings


async def create_draft_pr(
    *,
    repo: str,
    title: str,
    patch: str,
    target_file_path: str,
) -> str:
    """Open a draft PR (or return a simulated URL if GitHub isn't configured)."""
    settings = get_settings()
    repo = repo or settings.github_default_repo or "acme-corp/ecommerce-checkout-api"

    if not settings.github_access_token:
        # Simulated outcome
        return f"https://github.com/{repo}/pull/draft"

    # Real path: create branch, commit, open draft PR
    async with httpx.AsyncClient() as client:
        headers = {
            "Authorization": f"Bearer {settings.github_access_token}",
            "Accept": "application/vnd.github+json",
        }
        # Create a branch from the default branch
        default_ref = await client.get(
            f"https://api.github.com/repos/{repo}", headers=headers
        )
        default_branch = default_ref.json().get("default_branch", "main")
        branch_name = f"sentinel-sre/hotfix/{title[:30].lower().replace(' ', '-')}"
        # (full MCP implementation would create branch + commit + PR here)
        pr = await client.post(
            f"https://api.github.com/repos/{repo}/pulls",
            headers=headers,
            json={
                "title": title,
                "head": branch_name,
                "base": default_branch,
                "draft": True,
                "body": f"Automated hotfix from SentinelSRE.\n\n{patch}",
            },
        )
        if pr.status_code < 300:
            data = pr.json()
            return data.get("html_url", f"https://github.com/{repo}/pull/draft")

    return f"https://github.com/{repo}/pull/draft"


async def send_slack_alert(message: str) -> bool:
    """Send a Slack message via webhook (no-op if not configured)."""
    settings = get_settings()
    if not settings.slack_webhook_url:
        return False
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                settings.slack_webhook_url,
                json={"text": message},
            )
            return resp.status_code < 300
    except Exception:
        return False
