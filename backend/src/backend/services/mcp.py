"""MCP-style integrations: GitHub (create draft PR) and Slack (notify).

These use real APIs when credentials are configured, otherwise they fall back
to a deterministic simulated result so the rest of the system works in dev.

The plan for the "real" MCP path is to use a lightweight GitHub API client
(httpx) to create a branch, commit the hotfix patch, and open a draft PR.
"""

import base64
import re

import httpx

from backend.core.config import get_settings


_GH_API = "https://api.github.com"
_SLACK_API = "https://slack.com/api"


def _apply_patch(original: str, patch: str) -> str | None:
    """Apply a single-file unified diff to ``original``.

    Supports standard ``@@ -l,c +l,c @@`` hunks with context/removed/added
    lines. Returns the patched text, or None if the patch can't be applied.
    """
    hunks: list[dict] = []
    current: dict | None = None
    for line in patch.splitlines():
        if line.startswith("@@"):
            if current is not None:
                hunks.append(current)
            m = re.match(r"@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@", line)
            if not m:
                return None
            current = {"old_start": int(m.group(1)), "body": []}
        elif current is not None:
            current["body"].append(line)
    if current is not None:
        hunks.append(current)

    if not hunks:
        return None

    content = original.splitlines()
    for hunk in reversed(hunks):
        idx = hunk["old_start"] - 1
        del_count = 0
        add_lines: list[str] = []
        for line in hunk["body"]:
            if line.startswith("-"):
                del_count += 1
            elif line.startswith("+"):
                add_lines.append(line[1:])
            elif line.startswith(" "):
                del_count += 1
                add_lines.append(line[1:])
            # ignore "\ No newline at end of file" markers
        if idx < 0 or idx + del_count > len(content):
            return None
        content = content[:idx] + add_lines + content[idx + del_count:]
    return "\n".join(content)


def _fetch_file(client, headers, repo: str, path: str, branch: str) -> tuple[str, str] | None:
    """Return (current_content, sha) for a file on a branch."""
    r = client.get(
        f"{_GH_API}/repos/{repo}/contents/{path}",
        headers=headers,
        params={"ref": branch},
    )
    if r.status_code != 200:
        return None
    data = r.json()
    if not data.get("sha"):
        return None
    import base64 as _b64

    content = _b64.b64decode(data["content"]).decode("utf-8")
    return content, data["sha"]


async def apply_hotfix_direct(
    *,
    repo: str,
    title: str,
    patch: str,
    target_file_path: str,
    branch: str | None = None,
    access_token: str | None = None,
) -> str | None:
    """Commit a hotfix patch directly to an existing branch (no PR).

    Applies the diff to the file's current contents and commits the result to
    ``branch`` (defaults to the repo's default branch). Returns the commit URL.
    """
    settings = get_settings()
    repo = _normalize_repo(repo or settings.github_default_repo or "acme-corp/ecommerce-checkout-api")
    token = access_token or settings.github_access_token
    if not token:
        return None

    branch_name = f"sentinel-sre/hotfix/{_slugify(title)}"
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
    }

    try:
        async with httpx.AsyncClient(timeout=20) as client:
            repo_info = await _gh_get(client, headers, f"{_GH_API}/repos/{repo}")
            target_branch = branch or repo_info.get("default_branch") or "main"

            fetched = _fetch_file(client, headers, repo, target_file_path, target_branch)
            if fetched is None:
                return None
            original, file_sha = fetched

            updated = _apply_patch(original, patch)
            if updated is None:
                return None

            r = await client.put(
                f"{_GH_API}/repos/{repo}/contents/{target_file_path}",
                headers=headers,
                json={
                    "message": f"SentinelSRE hotfix (direct): {title}",
                    "content": base64.b64encode(updated.encode("utf-8")).decode("utf-8"),
                    "branch": target_branch,
                    "sha": file_sha,
                },
            )
            if r.status_code not in (200, 201):
                return None
            return r.json().get("html_url") or f"https://github.com/{repo}/commit/{r.json().get('commit', {}).get('sha', '')}"
    except Exception as exc:
        print(f"[mcp] direct commit failed: {exc}")
        return None

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
    access_token: str | None = None,
) -> str:
    """Open a real draft PR on GitHub (create branch -> commit -> PR).

    Falls back to a simulated URL when no token is configured or the API call
    fails, so the rest of the system keeps working in dev.

    ``access_token`` should be the *per-user* OAuth token (preferred). When
    omitted, the global ``GITHUB_ACCESS_TOKEN`` is used.
    """
    settings = get_settings()
    repo = _normalize_repo(repo or settings.github_default_repo or "acme-corp/ecommerce-checkout-api")

    token = access_token or settings.github_access_token
    if not token:
        return f"https://github.com/{repo}/pull/draft"

    branch_name = f"sentinel-sre/hotfix/{_slugify(title)}"
    headers = {
        "Authorization": f"Bearer {token}",
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


async def send_slack_alert(
    message: str,
    *,
    token: str | None = None,
    channel: str | None = None,
) -> bool:
    """Send a Slack message.

    Uses the per-user bot ``token`` + ``channel`` (chat.postMessage) when
    available; otherwise falls back to the global ``SLACK_WEBHOOK_URL``.
    """
    settings = get_settings()

    # Per-user bot token path.
    if token and channel:
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                resp = await client.post(
                    f"{_SLACK_API}/chat.postMessage",
                    headers={"Authorization": f"Bearer {token}"},
                    json={"channel": channel, "text": message},
                )
                body = resp.json()
                return bool(body.get("ok"))
        except Exception:
            return False

    # Webhook fallback.
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
