"use client";

import { useSearchParams } from "next/navigation";
import { CheckCircle2, MessageSquare, Unlink, WifiOff } from "lucide-react";
import { useEffect, useState } from "react";
import {
  disconnectSlack,
  fetchSlackChannels,
  getSlackAuthorizeUrl,
  getSlackStatus,
  setSlackChannel,
  type SlackChannel,
  type SlackStatus,
} from "@/lib/api";
import type { TokenGetter } from "@/lib/api";

export default function SlackConnect({ getToken }: { getToken: TokenGetter }) {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<SlackStatus | null>(null);
  const [channels, setChannels] = useState<SlackChannel[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(() => {
    const sk = searchParams.get("slack");
    if (sk === "connected") return "Slack connected. Notifications will post as your workspace.";
    if (sk === "error")
      return `Slack connection failed: ${searchParams.get("message") ?? "unknown error"}`;
    return null;
  });

  useEffect(() => {
    if (searchParams.has("slack")) {
      window.history.replaceState({}, "", "/dashboard");
    }
  }, [searchParams]);

  useEffect(() => {
    void getSlackStatus(getToken).then((s) => {
      setStatus(s);
      if (s.connected) {
        void fetchSlackChannels(getToken).then((res) => {
          if (res.connected) setChannels(res.channels);
        });
      }
    });
  }, [getToken]);

  async function handleConnect() {
    setBusy(true);
    try {
      const { url } = await getSlackAuthorizeUrl(getToken);
      window.location.href = url;
    } catch (err) {
      setNotice(
        err instanceof Error ? err.message : "Slack OAuth is not configured."
      );
      setBusy(false);
    }
  }

  async function handleDisconnect() {
    setBusy(true);
    try {
      const next = await disconnectSlack(getToken);
      setStatus(next);
      setChannels([]);
      setNotice("Disconnected from Slack.");
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Failed to disconnect.");
    } finally {
      setBusy(false);
    }
  }

  async function handleChannelChange(channelId: string) {
    if (!channelId || !status) return;
    setBusy(true);
    try {
      const next = await setSlackChannel(getToken, channelId);
      setStatus(next);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Failed to set channel.");
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
            <MessageSquare className="h-4 w-4" />
          </span>
          <div>
            <div className="text-xs font-semibold text-ink">Slack Notifications</div>
            <div className="text-[11px] text-ink-3">
              {status === null
                ? "Checking…"
                : status.connected
                  ? `Connected${status.team ? ` · ${status.team}` : ""}`
                  : "Not connected — notifications use the shared webhook or are silent."}
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
            ) : (
              <CheckCircle2 className="h-3.5 w-3.5" />
            )}
            Connect Slack
          </button>
        )}
      </div>

      {status?.connected && channels.length > 0 && (
        <div className="mt-3 flex items-center gap-2 border-t border-edge pt-3">
          <label className="text-[11px] text-ink-3">Notify channel:</label>
          <select
            value={status.channel_id ?? ""}
            onChange={(e) => void handleChannelChange(e.target.value)}
            className="input h-8 flex-1 font-mono text-xs"
          >
            <option value="" disabled>
              Select a channel…
            </option>
            {channels.map((c) => (
              <option key={c.id} value={c.id}>
                #{c.name}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
