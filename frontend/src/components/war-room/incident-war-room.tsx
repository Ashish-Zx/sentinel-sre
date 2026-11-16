"use client";

import { useAuth } from "@clerk/nextjs";
import { FileCode2, FileText, ShieldCheck, Sparkles } from "lucide-react";
import { useState } from "react";
import AgentTimeline from "@/components/war-room/AgentTimeline";
import CodeDiffTab from "@/components/war-room/CodeDiffTab";
import HitlActionBar from "@/components/war-room/HitlActionBar";
import RootCauseTab from "@/components/war-room/RootCauseTab";
import VerifierAuditTab from "@/components/war-room/VerifierAuditTab";
import { submitHitlDecision } from "@/lib/api";
import { useIncidentWarRoom } from "@/lib/sse";

type ActiveTab = "rca" | "diff" | "verifier";

export default function IncidentWarRoom({ incidentId }: { incidentId: string }) {
  const { getToken } = useAuth();
  const { incident, setIncident, steps, isStreaming, replayDemoInvestigation } =
    useIncidentWarRoom(incidentId, getToken);

  const [activeTab, setActiveTab] = useState<ActiveTab>("rca");

  if (!incident) {
    return (
      <div className="flex h-full items-center justify-center p-12 font-mono text-xs text-zinc-400">
        Loading Incident War Room #{incidentId}...
      </div>
    );
  }

  async function handleApprove() {
    if (!incident) return;
    const res = await submitHitlDecision(incident.id, { approved: true }, getToken);
    setIncident({
      ...incident,
      status: res.status,
      github_pr_url: res.github_pr_url ?? "https://github.com/acme-corp/ecommerce-checkout-api/pull/48",
    });
  }

  async function handleReject(feedback: string) {
    if (!incident) return;
    const res = await submitHitlDecision(incident.id, { approved: false, feedback }, getToken);
    setIncident({ ...incident, status: res.status, human_feedback: feedback });
  }

  return (
    <div className="flex flex-col min-h-[calc(100vh-57px)]">
      <div className="grid flex-1 grid-cols-1 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <AgentTimeline
            steps={steps}
            isStreaming={isStreaming}
            onReplayDemo={() => void replayDemoInvestigation()}
          />
        </div>

        <div className="lg:col-span-7 flex flex-col p-6 space-y-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-zinc-800 pb-4">
            <div>
              <div className="flex items-center gap-2 text-[11px] font-mono text-emerald-400">
                <Sparkles className="h-3.5 w-3.5" />
                THREAD ID: {incident.id}
              </div>
              <h1 className="text-lg font-bold text-white mt-0.5">{incident.title}</h1>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-900/90 px-3.5 py-2 font-mono text-[11px] text-zinc-300">
              Latency:{" "}
              <strong className="text-white">{(incident.total_latency_ms ?? 9840) / 1000}s</strong>{" "}
              | Cost:{" "}
              <strong className="text-emerald-400">${(incident.total_cost_usd ?? 0.0242).toFixed(4)}</strong>{" "}
              <span className="text-zinc-500">(Saved 65% via Haiku)</span>
            </div>
          </div>

          <div className="flex items-center gap-2 border-b border-zinc-800 pb-3">
            <button
              type="button"
              onClick={() => setActiveTab("rca")}
              className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-medium transition cursor-pointer ${
                activeTab === "rca"
                  ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                  : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
              }`}
            >
              <FileText className="h-3.5 w-3.5" />
              1. Root Cause & Citations
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("diff")}
              className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-medium transition cursor-pointer ${
                activeTab === "diff"
                  ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                  : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
              }`}
            >
              <FileCode2 className="h-3.5 w-3.5" />
              2. Proposed Hotfix Diff
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("verifier")}
              className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-medium transition cursor-pointer ${
                activeTab === "verifier"
                  ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                  : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
              }`}
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              3. L4 Verifier Audit ({incident.confidence_score ?? 94}%)
            </button>
          </div>

          <div className="flex-1">
            {activeTab === "rca" && <RootCauseTab incident={incident} />}
            {activeTab === "diff" && (
              <CodeDiffTab
                targetFilePath={incident.target_file_path}
                patchDiff={incident.proposed_patch_diff}
              />
            )}
            {activeTab === "verifier" && <VerifierAuditTab incident={incident} />}
          </div>
        </div>
      </div>

      <HitlActionBar incident={incident} onApprove={handleApprove} onReject={handleReject} />
    </div>
  );
}
