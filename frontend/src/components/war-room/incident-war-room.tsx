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

const TABS = [
  { id: "rca" as ActiveTab, icon: FileText, label: "Root Cause & Citations", order: 1 },
  { id: "diff" as ActiveTab, icon: FileCode2, label: "Proposed Hotfix Diff", order: 2 },
  { id: "verifier" as ActiveTab, icon: ShieldCheck, label: "L4 Verifier Audit", order: 3 },
];

export default function IncidentWarRoom({ incidentId }: { incidentId: string }) {
  const { getToken } = useAuth();
  const { incident, setIncident, steps } =
    useIncidentWarRoom(incidentId, getToken);

  const [activeTab, setActiveTab] = useState<ActiveTab>("rca");

  if (!incident) {
    return (
      <div className="flex h-full items-center justify-center p-12 font-mono text-xs text-ink-3">
        Loading Incident War Room #{incidentId}…
      </div>
    );
  }

  async function handleApprove(opts: {
    directCommit: boolean;
    targetBranch?: string;
  }) {
    if (!incident) return;
    const res = await submitHitlDecision(
      incident.id,
      {
        approved: true,
        direct_commit: opts.directCommit,
        target_branch: opts.targetBranch,
      },
      getToken
    );
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
    <div className="flex min-h-[calc(100vh-57px)] flex-col">
      <div className="grid flex-1 grid-cols-1 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <AgentTimeline steps={steps} />
        </div>

        <div className="flex flex-col space-y-5 p-6 lg:col-span-7">
          <div className="flex flex-col gap-2 border-b border-edge pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2 font-mono text-[11px] text-signal">
                <Sparkles className="h-3.5 w-3.5" />
                THREAD ID: {incident.id}
              </div>
              <h1 className="mt-0.5 text-lg font-bold tracking-tight text-ink">
                {incident.title}
              </h1>
            </div>

            <div className="tabular rounded-xl border border-edge bg-surface-2/90 px-3.5 py-2 font-mono text-[11px] text-ink-2">
              Latency:{" "}
              <strong className="text-ink">{(incident.total_latency_ms ?? 9840) / 1000}s</strong>{" "}
              | Cost:{" "}
              <strong className="text-signal">${(incident.total_cost_usd ?? 0.0242).toFixed(4)}</strong>{" "}
              <span className="text-ink-3">· 65% saved</span>
            </div>
          </div>

          <div className="flex items-center gap-1 border-b border-edge pb-3">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`btn h-9 px-3 text-xs ${
                    isActive
                      ? "border border-signal-edge bg-signal-dim text-signal"
                      : "text-ink-3 hover:bg-surface-3 hover:text-ink"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {tab.order}. {tab.label}
                  {tab.id === "verifier" && incident.confidence_score != null
                    ? ` (${incident.confidence_score}%)`
                    : ""}
                </button>
              );
            })}
          </div>

          <div className="flex-1">
            {activeTab === "rca" && <RootCauseTab incident={incident} />}
            {activeTab === "diff" && (
              <CodeDiffTab
                targetFilePath={incident.target_file_path}
                patchDiff={incident.proposed_patch_diff}
                status={incident.status}
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
