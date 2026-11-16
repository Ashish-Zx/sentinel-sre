"use client";

import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  GitPullRequest,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import type { Incident } from "@/lib/types";

export default function HitlActionBar({
  incident,
  onApprove,
  onReject,
}: {
  incident: Incident;
  onApprove: () => Promise<void>;
  onReject: (feedback: string) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [feedback, setFeedback] = useState("");

  async function handleApproveClick() {
    setBusy(true);
    try {
      await onApprove();
    } finally {
      setBusy(false);
    }
  }

  async function handleRejectSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await onReject(feedback);
      setShowRejectModal(false);
    } finally {
      setBusy(false);
    }
  }

  if (incident.status === "resolved") {
    return (
      <div className="sticky bottom-0 z-30 flex flex-wrap items-center justify-between gap-4 border-t border-emerald-500/40 bg-emerald-950/90 px-6 py-4 backdrop-blur">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
          <div>
            <div className="text-xs font-semibold text-white">
              Approved & Executed via GitHub MCP + Slack MCP
            </div>
            <div className="text-[11px] text-emerald-200/80">
              Draft Pull Request opened and outcome saved to Episodic Memory (`incidents` SQL table).
            </div>
          </div>
        </div>

        {incident.github_pr_url && (
          <a
            href={incident.github_pr_url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-400 px-4 py-2 text-xs font-semibold text-zinc-950 hover:bg-emerald-300"
          >
            <GitPullRequest className="h-4 w-4" />
            View Hotfix Draft PR on GitHub
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </div>
    );
  }

  if (incident.status === "rejected") {
    return (
      <div className="sticky bottom-0 z-30 flex items-center justify-between border-t border-red-500/40 bg-red-950/90 px-6 py-4 backdrop-blur">
        <div className="flex items-center gap-3">
          <XCircle className="h-5 w-5 text-red-400 shrink-0" />
          <div>
            <div className="text-xs font-semibold text-white">
              Patch Rejected — Logged to Episodic Memory
            </div>
            <div className="text-[11px] text-red-200/80">
              Engineer Feedback: {incident.human_feedback || "Rejected during review"}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="sticky bottom-0 z-30 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t border-amber-500/40 bg-amber-950/85 px-6 py-3.5 backdrop-blur">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <div className="text-xs font-semibold text-amber-100">
              Escalation Gate Triggered: Touches Payment/Checkout Route (Confidence:{" "}
              {incident.confidence_score ?? 94}%)
            </div>
            <div className="text-[11px] text-amber-200/80">
              LangGraph execution paused via <code className="font-mono">interrupt()</code> in PostgresSaver. Review the diff before authorizing MCP tool execution.
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            disabled={busy}
            onClick={() => setShowRejectModal(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-red-500/40 bg-red-500/15 px-3.5 py-2 text-xs font-medium text-red-200 hover:bg-red-500/25 disabled:opacity-50 cursor-pointer"
          >
            <XCircle className="h-4 w-4" />
            Reject & Give Feedback
          </button>

          <button
            type="button"
            disabled={busy}
            onClick={handleApproveClick}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-semibold text-zinc-950 shadow-lg shadow-emerald-500/20 hover:bg-emerald-400 disabled:opacity-50 cursor-pointer"
          >
            <GitPullRequest className="h-4 w-4" />
            {busy ? "Executing MCP Tools..." : "Approve & Open Hotfix Draft PR"}
          </button>
        </div>
      </div>

      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
          <form onSubmit={handleRejectSubmit} className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-950 p-6 space-y-4">
            <h3 className="text-sm font-semibold text-white">
              Reject Proposed Patch & Record Episodic Memory
            </h3>
            <p className="text-xs text-zinc-400">
              Your feedback is saved into the <code className="font-mono">incidents</code> table so Agent C remembers why this fix was rejected in future investigations.
            </p>
            <textarea
              required
              rows={3}
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="e.g. Don't fallback to discount_code here; raise 422 with deprecation header instead."
              className="w-full rounded-lg border border-zinc-800 bg-zinc-900 p-3 text-xs text-white focus:border-red-500 focus:outline-none"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowRejectModal(false)}
                className="rounded-lg border border-zinc-800 px-3 py-1.5 text-xs text-zinc-400"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy}
                className="rounded-lg bg-red-500 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-red-400"
              >
                Confirm Rejection
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
