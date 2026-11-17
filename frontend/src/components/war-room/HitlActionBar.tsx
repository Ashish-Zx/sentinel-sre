"use client";

import { AlertTriangle, CheckCircle2, ExternalLink, GitBranch, GitPullRequest, XCircle } from "lucide-react";
import { useState } from "react";
import type { Incident } from "@/lib/types";

export default function HitlActionBar({
  incident,
  onApprove,
  onReject,
}: {
  incident: Incident;
  onApprove: (opts: { directCommit: boolean; targetBranch?: string }) => Promise<void>;
  onReject: (feedback: string) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [delivery, setDelivery] = useState<"draft" | "direct">("draft");
  const [branch, setBranch] = useState("");

  async function handleApproveClick() {
    setBusy(true);
    try {
      await onApprove({
        directCommit: delivery === "direct",
        targetBranch: delivery === "direct" && branch.trim() ? branch.trim() : undefined,
      });
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
      <div className="sticky bottom-0 z-30 flex flex-wrap items-center justify-between gap-4 border-t border-signal-edge bg-[#07130e]/95 px-6 py-4 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-signal" />
          <div>
            <div className="text-xs font-semibold text-ink">
              Approved &amp; Executed via GitHub MCP + Slack MCP
            </div>
            <div className="text-[11px] text-ink-2">
              Fix delivered to GitHub and outcome saved to Episodic Memory (incidents SQL table).
            </div>
          </div>
        </div>

        {incident.github_pr_url && (
          <a
            href={incident.github_pr_url}
            target="_blank"
            rel="noreferrer"
            className="btn btn-primary h-10 px-4 text-xs"
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
      <div className="sticky bottom-0 z-30 flex items-center justify-between border-t border-[#e4a29b] bg-[#fff8f7] px-6 py-4 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <XCircle className="h-5 w-5 shrink-0 text-[#a32116]" />
          <div>
            <div className="text-xs font-semibold text-ink">
              Patch Rejected — Logged to Episodic Memory
            </div>
            <div className="text-[11px] text-ink-2">
              Engineer feedback: {incident.human_feedback || "Rejected during review"}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="sticky bottom-0 z-30 flex flex-col gap-3 border-t border-[#dfb55a] bg-[#fffdf5] px-6 py-3.5 backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[#7a4d00]" />
          <div>
            <div className="text-xs font-semibold text-[#7a4d00]">
              Escalation Gate Triggered: touches payment/checkout route (Confidence:{" "}
              {incident.confidence_score ?? 94}%)
            </div>
            <div className="text-[11px] text-ink-2">
              LangGraph execution paused via <code className="font-mono">interrupt()</code> in
              PostgresSaver. Review the diff before authorizing MCP tool execution.
            </div>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 rounded-lg border border-[#e6cf9a] bg-white px-3 py-1.5">
            <GitBranch className="h-3.5 w-3.5 text-[#7a4d00]" />
            <select
              aria-label="Delivery mode"
              value={delivery}
              onChange={(e) => setDelivery(e.target.value as "draft" | "direct")}
              className="bg-transparent text-xs font-medium text-[#7a4d00] outline-none"
            >
              <option value="draft">Draft PR (new branch)</option>
              <option value="direct">Commit directly to branch</option>
            </select>
            {delivery === "direct" && (
              <input
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                placeholder="branch (default: main)"
                className="w-36 font-mono text-[11px] text-ink outline-none"
              />
            )}
          </div>

          <button
            type="button"
            disabled={busy}
            onClick={() => setShowRejectModal(true)}
            className="btn status-danger h-9 px-3.5 text-xs font-medium hover:bg-[#ffe4e0]"
          >
            <XCircle className="h-4 w-4" />
            Reject &amp; Give Feedback
          </button>

          <button
            type="button"
            disabled={busy}
            onClick={handleApproveClick}
            className="btn btn-primary h-9 px-4 text-xs"
          >
            {delivery === "direct" ? (
              <GitBranch className="h-4 w-4" />
            ) : (
              <GitPullRequest className="h-4 w-4" />
            )}
            {busy
              ? "Executing MCP Tools…"
              : delivery === "direct"
                ? "Approve & Commit to Branch"
                : "Approve & Open Hotfix Draft PR"}
          </button>
        </div>
      </div>

      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <form onSubmit={handleRejectSubmit} className="panel w-full max-w-md bg-surface-1 p-6">
            <h3 className="text-sm font-semibold text-ink">
              Reject Proposed Patch &amp; Record Episodic Memory
            </h3>
            <p className="mt-1 text-xs text-ink-3">
              Your feedback is saved into the <code className="font-mono">incidents</code> table so
              Agent C remembers why this fix was rejected in future investigations.
            </p>
            <textarea
              required
              rows={3}
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="e.g. Don't fallback to discount_code here; raise 422 with deprecation header instead."
              className="input mt-4 resize-none focus:border-[#e4a29b] focus:shadow-[0_0_0_3px_#fff1ef]"
            />
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowRejectModal(false)}
                className="btn btn-ghost h-9 px-3 text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy}
                className="btn h-9 bg-[#b42318] px-3.5 text-xs font-semibold text-white hover:bg-[#921b12]"
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
