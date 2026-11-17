"use client";

import { useSearchParams } from "next/navigation";
import { CheckCircle2, GitBranch, Link2, Unlink, WifiOff } from "lucide-react";
import { useEffect, useState } from "react";
import {
  disconnectGithub,
  getGithubAuthorizeUrl,
  getGithubStatus,
  type GithubStatus,
} from "@/lib/api";
import type { TokenGetter } from "@/lib/api";

export default function GithubConnect({ getToken }: { getToken: TokenGetter }) {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<GithubStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(() => {
    const gh = searchParams.get("github");
    if (gh === "connected") {
      return "GitHub connected. Your incidents will now open draft PRs as you.";
    }
    if (gh === "error") {
      return `GitHub connection failed: ${searchParams.get("message") ?? "unknown error"}`;
    }
    return null;
  });

  useEffect(() => {
    // Consume the OAuth result query params without re-rendering.
    if (searchParams.has("github")) {
      window.history.replaceState({}, "", "/dashboard");
    }
  }, [searchParams]);

  useEffect(() => {
    void getGithubStatus(getToken).then(setStatus);
  }, [getToken]);

  async function handleConnect() {
    setBusy(true);
    try {
      const { url } = await getGithubAuthorizeUrl(getToken);
      window.location.href = url;
    } catch (err) {
      setNotice(
        err instanceof Error ? err.message : "GitHub OAuth is not configured."
      );
      setBusy(false);
    }
  }

  async function handleDisconnect() {
    setBusy(true);
    try {
      const next = await disconnectGithub(getToken);
      setStatus(next);
      setNotice("Disconnected from GitHub.");
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Failed to disconnect.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel p-4">
      {notice && (
        <div className="status-info mb-3 rounded-lg px-3 py-2 text-xs">
          {notice}
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-edge bg-surface-2 text-ink-2">
            <GitBranch className="h-4 w-4" />
          </span>
          <div>
            <div className="text-xs font-semibold text-ink">GitHub Connection</div>
            <div className="text-[11px] text-ink-3">
              {status === null
                ? "Checking…"
                : status.connected
                  ? `Connected${status.repo_url ? ` · ${status.repo_url}` : ""}`
                  : "Not connected — draft PRs use the shared account or are simulated."}
            </div>
          </div>
        </div>

        {status?.connected ? (
          <button
            type="button"
            onClick={handleDisconnect}
            disabled={busy}
            className="btn btn-ghost h-8 px-3 text-[11px]"
          >
            <Unlink className="h-3.5 w-3.5" />
            Disconnect
          </button>
        ) : (
          <button
            type="button"
            onClick={handleConnect}
            disabled={busy}
            className="btn btn-primary h-8 px-3 text-[11px]"
          >
            {busy ? (
              <WifiOff className="h-3.5 w-3.5" />
            ) : status?.connected ? (
              <CheckCircle2 className="h-3.5 w-3.5" />
            ) : (
              <Link2 className="h-3.5 w-3.5" />
            )}
            Connect GitHub
          </button>
        )}
      </div>
    </div>
  );
}
