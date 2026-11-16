"use client";

import { useAuth } from "@clerk/nextjs";
import { Cpu, DollarSign, ShieldCheck, TrendingDown, Zap } from "lucide-react";
import { useEffect, useState } from "react";
import { fetchFinOpsSummary } from "@/lib/api";
import type { FinOpsSummary } from "@/lib/types";

export default function FinOpsAnalyticsPage() {
  const { getToken } = useAuth();
  const [summary, setSummary] = useState<FinOpsSummary | null>(null);

  useEffect(() => {
    void fetchFinOpsSummary(getToken).then(setSummary);
  }, [getToken]);

  if (!summary) {
    return (
      <div className="p-8 font-mono text-xs text-zinc-400">
        Loading FinOps & Observability telemetry...
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">
          Observability & FinOps Telemetry
        </h1>
        <p className="mt-1 text-xs text-zinc-400">
          Real-time token cost savings from routing Triage & Parallel Specialists to{" "}
          <code className="font-mono text-emerald-300">claude-3-5-haiku</code> and reserving{" "}
          <code className="font-mono text-violet-300">claude-3-7-sonnet</code> for Root-Cause Synthesis & L4 Verification.
        </p>
      </div>

      {/* Top KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span>Actual Routed Spend</span>
            <DollarSign className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="mt-2 font-mono text-2xl font-bold text-white">
            ${summary.actual_cost_usd.toFixed(3)}
          </div>
          <div className="mt-1 text-[11px] text-zinc-400">
            vs ${summary.baseline_frontier_cost_usd.toFixed(3)} unrouted baseline
          </div>
        </div>

        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4">
          <div className="flex items-center justify-between text-xs text-emerald-300">
            <span>Cost Router Savings</span>
            <TrendingDown className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="mt-2 font-mono text-2xl font-bold text-emerald-400">
            {summary.savings_percentage.toFixed(1)}%
          </div>
          <div className="mt-1 text-[11px] text-emerald-200/80">
            Saved ${summary.saved_usd.toFixed(3)} across {summary.total_incidents} incidents
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span>Avg Parallel Latency</span>
            <Zap className="h-4 w-4 text-sky-400" />
          </div>
          <div className="mt-2 font-mono text-2xl font-bold text-white">
            {(summary.avg_latency_ms / 1000).toFixed(1)}s
          </div>
          <div className="mt-1 text-[11px] text-zinc-400">
            4 specialists executed via LangGraph Send()
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span>L4 Verifier Catches</span>
            <ShieldCheck className="h-4 w-4 text-violet-400" />
          </div>
          <div className="mt-2 font-mono text-2xl font-bold text-violet-400">
            {summary.verifier_catch_count}
          </div>
          <div className="mt-1 text-[11px] text-zinc-400">
            Hallucinated diffs caught & self-corrected
          </div>
        </div>
      </div>

      {/* Per-Agent Cost & Latency Breakdown */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <Cpu className="h-4 w-4 text-emerald-400" />
            Cost & Latency Breakdown by LangGraph Agent Node
          </h2>
          <span className="font-mono text-xs text-zinc-400">
            Source: Postgres <code className="text-zinc-200">llm_traces</code> table
          </span>
        </div>

        <div className="space-y-3">
          {summary.by_agent.length === 0 && (
            <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-6 text-center font-mono text-xs text-zinc-500">
              No LLM traces yet — run an investigation to populate telemetry.
            </div>
          )}
          {summary.by_agent.map((item) => {
            const ratio = Math.min(
              100,
              Math.round((item.actual_cost_usd / item.baseline_cost_usd) * 100)
            );
            const isFast = item.primary_model.includes("haiku");
            return (
              <div
                key={item.agent_name}
                className="rounded-xl border border-zinc-800 bg-zinc-950 p-3.5 space-y-2"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-semibold text-zinc-100">
                      {item.agent_name}
                    </span>
                    <span
                      className={`rounded px-1.5 py-0.5 font-mono text-[10px] border ${
                        isFast
                          ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
                          : "bg-violet-500/15 text-violet-300 border-violet-500/30"
                      }`}
                    >
                      {item.primary_model}
                    </span>
                  </div>
                  <div className="font-mono text-zinc-300">
                    Actual:{" "}
                    <strong className="text-emerald-400">
                      ${item.actual_cost_usd.toFixed(4)}
                    </strong>{" "}
                    / Baseline: ${item.baseline_cost_usd.toFixed(4)} • Avg{" "}
                    {item.avg_latency_ms}ms
                  </div>
                </div>

                <div className="h-2 w-full rounded-full bg-zinc-800 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      isFast ? "bg-emerald-500" : "bg-violet-500"
                    }`}
                    style={{ width: `${ratio}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
