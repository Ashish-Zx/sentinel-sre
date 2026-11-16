"""MCP-style integrations: GitHub (create draft PR) and Slack (notify).

These use real APIs when credentials are configured, otherwise they fall back
to a deterministic simulated result so the rest of the system works in dev.

The plan for the "real" MCP path is to use a lightweight GitHub API client
(httpx) to create a branch, commit the hotfix patch, and open a draft PR.
"""

import httpx

from backend.core.config import get_settings


_GH_API = "https://api.github.com"

import re


def _slugify(value: str, max_len: int = 40) -> str:
    """Make a git-ref-safe branch component from an arbitrary title."""
    slug = re.sub(r"[^a-zA-Z0-9-]", "-", value).strip("-").lower()
    return slug[:max_len].rstrip("-") or "hotfix"


def _normalize_repo(repo: str) -> str:
    """Normalize a repo reference to ``owner/repo`` form.

    Accepts either ``owner/repo`` or a full URL like
    ``https://github.com/owner/repo`` (with optional ``.git``).
    """
    repo = repo.strip()
    repo = repo.rstrip("/")
    if repo.endswith(".git"):
        repo = repo[: -len(".git")]
    if "://" in repo:
        repo = repo.split("://", 1)[1]
    if "/" in repo:
        # Strip any leading host path segments (e.g. "github.com/owner/repo")
        parts = [p for p in repo.split("/") if p]
        repo = "/".join(parts[-2:])
    return repo.strip("/")


async def _gh_get(client, headers, url: str) -> dict:
    r = await client.get(url, headers=headers)
    r.raise_for_status()
    return r.json()


async def create_draft_pr(
    *,
    repo: str,
    title: str,
    patch: str,
    target_file_path: str,
) -> str:
    """Open a real draft PR on GitHub (create branch -> commit -> PR).

    Falls back to a simulated URL when no token is configured or the API call
    fails, so the rest of the system keeps working in dev.
    """
    settings = get_settings()
    repo = _normalize_repo(repo or settings.github_default_repo or "acme-corp/ecommerce-checkout-api")

    if not settings.github_access_token:
        return f"https://github.com/{repo}/pull/draft"

    branch_name = f"sentinel-sre/hotfix/{_slugify(title)}"
    headers = {
        "Authorization": f"Bearer {settings.github_access_token}",
        "Accept": "application/vnd.github+json",
    }

    try:
        async with httpx.AsyncClient(timeout=20) as client:
            # 1. Default branch + its head SHA
            repo_info = await _gh_get(
                client, headers, f"{_GH_API}/repos/{repo}"
            )
            default_branch = repo_info.get("default_branch", "main")
            ref = await _gh_get(
                client,
                headers,
                f"{_GH_API}/repos/{repo}/git/ref/heads/{default_branch}",
            )
            base_sha = ref["object"]["sha"]

            # 2. Create a branch from the default branch
            r = await client.post(
                f"{_GH_API}/repos/{repo}/git/refs",
                headers=headers,
                json={
                    "ref": f"refs/heads/{branch_name}",
                    "sha": base_sha,
                },
            )
            if r.status_code not in (201, 422):  # 422 = branch already exists
                r.raise_for_status()

            # 3. Commit the hotfix patch into a file on the new branch
            import base64
            content_b64 = base64.b64encode(patch.encode("utf-8")).decode("utf-8")
            commit = await client.put(
                f"{_GH_API}/repos/{repo}/contents/{target_file_path}",
                headers=headers,
                json={
                    "message": f"SentinelSRE hotfix: {title}",
                    "content": content_b64,
                    "branch": branch_name,
                },
            )
            if commit.status_code not in (200, 201, 422):  # 422 = file exists
                commit.raise_for_status()

            # 4. Open a draft PR
            pr = await client.post(
                f"{_GH_API}/repos/{repo}/pulls",
                headers=headers,
                json={
                    "title": title,
                    "head": branch_name,
                    "base": default_branch,
                    "draft": True,
                    "body": f"Automated hotfix from SentinelSRE.\n\n```diff\n{patch}\n```",
                },
            )
            if pr.status_code < 300:
                data = pr.json()
                return data.get("html_url", f"https://github.com/{repo}/pull/draft")
            pr.raise_for_status()
    except Exception as exc:
        print(f"[mcp] GitHub PR creation failed: {exc}")

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
