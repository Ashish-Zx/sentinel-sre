"use client";

import { useAuth } from "@clerk/nextjs";
import { Cpu, DollarSign, ShieldCheck, TrendingDown, Zap } from "lucide-react";
import { useEffect, useState } from "react";
import { fetchFinOpsSummary } from "@/lib/api";
import type { FinOpsSummary } from "@/lib/types";

type CardTone = "normal" | "live" | "info" | "violet";

function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  tone = "normal",
}: {
  label: string;
  value: string;
  sub: string;
  icon: typeof DollarSign;
  tone?: CardTone;
}) {
  const toneCls: Record<CardTone, string> = {
    normal: "text-signal",
    live: "text-signal",
    info: "text-[#075985]",
    violet: "text-[#6941c6]",
  };
  return (
    <div className="panel p-4">
      <div className="flex items-center justify-between text-xs text-ink-3">
        <span>{label}</span>
        <Icon className={`h-4 w-4 ${toneCls[tone]}`} />
      </div>
      <div className="tabular mt-2 text-2xl font-bold text-ink">{value}</div>
      <div className="mt-1 text-[11px] text-ink-3">{sub}</div>
    </div>
  );
}

export default function FinOpsAnalyticsPage() {
  const { getToken } = useAuth();
  const [summary, setSummary] = useState<FinOpsSummary | null>(null);

  useEffect(() => {
    void fetchFinOpsSummary(getToken).then(setSummary);
  }, [getToken]);

  if (!summary) {
    return (
      <div className="p-8 font-mono text-xs text-ink-3">
        Loading FinOps &amp; observability telemetry…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div>
        <h1 className="page-title">Observability &amp; FinOps Telemetry</h1>
        <p className="page-sub max-w-2xl">
          Cost and latency savings from routing fast agents to Haiku and frontier agents to Sonnet.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <KpiCard
          label="Actual Routed Spend"
          value={`$${summary.actual_cost_usd.toFixed(3)}`}
          sub={`vs $${summary.baseline_frontier_cost_usd.toFixed(3)} unrouted baseline`}
          icon={DollarSign}
        />
        <KpiCard
          label="Cost Router Savings"
          value={`${summary.savings_percentage.toFixed(1)}%`}
          sub={`$${summary.saved_usd.toFixed(3)} across ${summary.total_incidents} incidents`}
          icon={TrendingDown}
          tone="live"
        />
        <KpiCard
          label="Avg Parallel Latency"
          value={`${(summary.avg_latency_ms / 1000).toFixed(1)}s`}
          sub="Across 4 parallel agents"
          icon={Zap}
          tone="info"
        />
        <KpiCard
          label="L4 Verifier Catches"
          value={`${summary.verifier_catch_count}`}
          sub="Incorrect diffs caught and corrected"
          icon={ShieldCheck}
          tone="violet"
        />
      </div>

      <div className="panel space-y-4 p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-signal-edge bg-signal-dim text-signal">
              <Cpu className="h-4 w-4" />
            </span>
            Cost &amp; Latency Breakdown by LangGraph Agent Node
          </h2>
          <span className="font-mono text-xs text-ink-3">
            Source: Postgres <code className="text-ink">llm_traces</code>
          </span>
        </div>

        <div className="space-y-3">
          {summary.by_agent.length === 0 && (
            <div className="rounded-xl border border-edge bg-surface-1 p-6 text-center font-mono text-xs text-ink-3">
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
                className="space-y-2 rounded-xl border border-edge bg-surface-1 p-3.5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-semibold text-ink">
                      {item.agent_name}
                    </span>
                    <span
                      className={`badge font-mono text-[10px] ${
                        isFast ? "badge-live" : "badge-violet"
                      }`}
                    >
                      {item.primary_model}
                    </span>
                  </div>
                  <div className="tabular font-mono text-ink-2">
                    Actual:{" "}
                    <strong className="text-signal">
                      ${item.actual_cost_usd.toFixed(4)}
                    </strong>{" "}
                    / Baseline: ${item.baseline_cost_usd.toFixed(4)} · Avg{" "}
                    {item.avg_latency_ms}ms
                  </div>
                </div>

                <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
                  <div
                    className={`h-full rounded-full ${
                      isFast ? "bg-signal" : "bg-[#6941c6]"
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
