"use client";

import { CheckCircle2, CircleDot, Clock, Cpu, Loader2 } from "lucide-react";
import type { AgentStepState } from "@/lib/types";

export default function AgentTimeline({
  steps,
}: {
  steps: AgentStepState[];
}) {
  const totalCost = steps.reduce((acc, s) => acc + (s.cost_usd ?? 0), 0);

  return (
    <div className="flex h-full flex-col border-r border-edge bg-surface-1/40 p-5">
      <div className="mb-4 flex items-center justify-between border-b border-edge pb-3.5">
        <div>
          <h2 className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-ink-2">
            <Cpu className="h-3.5 w-3.5 text-signal" />
            LangGraph Execution Trace
          </h2>
          <p className="mt-0.5 text-[11px] text-ink-3">
            Total cost:{" "}
            <span className="tabular font-mono text-signal">${totalCost.toFixed(4)}</span>
          </p>
        </div>
      </div>

      <div className="space-y-3 overflow-y-auto pr-1">
        {steps.map((step) => {
          const isFastTier = step.tier === "fast";
          return (
            <div
              key={step.agent_name}
              className={`rounded-xl border p-3.5 transition-all ${
                step.status === "running"
                  ? "border-signal-edge bg-signal-dim/60"
                  : step.status === "completed"
                    ? "border-edge bg-surface-2/70"
                    : "border-edge bg-surface-1/40 opacity-60"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  {step.status === "running" ? (
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin text-signal" />
                  ) : step.status === "completed" ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-signal" />
                  ) : (
                    <CircleDot className="h-4 w-4 shrink-0 text-ink-3" />
                  )}
                  <span className="text-xs font-semibold text-ink">{step.label}</span>
                </div>

                <span
                  className={`badge shrink-0 font-mono text-[10px] ${
                    isFastTier ? "badge-live" : "badge-violet"
                  }`}
                >
                  {step.model_used ?? (isFastTier ? "claude-3-5-haiku" : "claude-3-7-sonnet")}
                </span>
              </div>

              <p className="mt-1.5 pl-6 text-[11px] leading-relaxed text-ink-2">
                {step.summary ?? step.description}
              </p>

              {step.status === "completed" && (
                <div className="mt-2.5 flex items-center gap-4 pl-6 font-mono text-[10px] text-ink-3">
                  <span className="tabular flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {step.latency_ms}ms
                  </span>
                  <span className="tabular text-signal">${(step.cost_usd ?? 0).toFixed(4)}</span>
                  <span className="text-ink-3">
                    {isFastTier ? "Fast tier" : "Frontier tier"}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
