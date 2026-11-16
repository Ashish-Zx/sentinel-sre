"use client";

import {
  CheckCircle2,
  CircleDot,
  Clock,
  Cpu,
  Loader2,
  RotateCcw,
} from "lucide-react";
import type { AgentStepState } from "@/lib/types";

export default function AgentTimeline({
  steps,
  isStreaming,
  onReplayDemo,
}: {
  steps: AgentStepState[];
  isStreaming: boolean;
  onReplayDemo: () => void;
}) {
  const totalCost = steps.reduce((acc, s) => acc + (s.cost_usd ?? 0), 0);

  return (
    <div className="flex flex-col h-full border-r border-zinc-800 bg-zinc-950/60 p-5">
      <div className="flex items-center justify-between border-b border-zinc-800 pb-3.5 mb-4">
        <div>
          <h2 className="text-xs font-mono uppercase tracking-wider text-zinc-300 flex items-center gap-2">
            <Cpu className="h-3.5 w-3.5 text-emerald-400" />
            LangGraph Parallel Execution Trace
          </h2>
          <p className="text-[11px] text-zinc-500 mt-0.5">
            Live SSE stream • Total Cost:{" "}
            <span className="font-mono text-emerald-400">${totalCost.toFixed(4)}</span>
          </p>
        </div>

        <button
          type="button"
          disabled={isStreaming}
          onClick={onReplayDemo}
          className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 text-[11px] font-medium text-zinc-300 hover:bg-zinc-800 disabled:opacity-50 cursor-pointer"
        >
          <RotateCcw className={`h-3 w-3 ${isStreaming ? "animate-spin" : ""}`} />
          {isStreaming ? "Running Live..." : "Replay Live Trace"}
        </button>
      </div>

      <div className="space-y-3 overflow-y-auto pr-1">
        {steps.map((step) => {
          const isFastTier = step.tier === "fast";
          return (
            <div
              key={step.agent_name}
              className={`rounded-xl border p-3.5 transition-all ${
                step.status === "running"
                  ? "border-emerald-500/60 bg-emerald-500/5 shadow-sm shadow-emerald-500/10"
                  : step.status === "completed"
                    ? "border-zinc-800 bg-zinc-900/60"
                    : "border-zinc-900 bg-zinc-950/50 opacity-60"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  {step.status === "running" ? (
                    <Loader2 className="h-4 w-4 text-emerald-400 animate-spin shrink-0" />
                  ) : step.status === "completed" ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                  ) : (
                    <CircleDot className="h-4 w-4 text-zinc-600 shrink-0" />
                  )}
                  <span className="text-xs font-semibold text-zinc-100">{step.label}</span>
                </div>

                <span
                  className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-medium shrink-0 border ${
                    isFastTier
                      ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
                      : "bg-violet-500/15 text-violet-300 border-violet-500/30"
                  }`}
                >
                  {step.model_used ?? (isFastTier ? "claude-3-5-haiku" : "claude-3-7-sonnet")}
                </span>
              </div>

              <p className="mt-1.5 pl-6 text-[11px] text-zinc-400 leading-relaxed">
                {step.summary ?? step.description}
              </p>

              {step.status === "completed" && (
                <div className="mt-2.5 pl-6 flex items-center gap-4 text-[10px] font-mono text-zinc-400">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3 text-zinc-500" />
                    {step.latency_ms}ms
                  </span>
                  <span className="text-emerald-400">${(step.cost_usd ?? 0).toFixed(4)}</span>
                  <span className="text-zinc-500">
                    {isFastTier ? "Fast/Cheap Tier" : "Frontier Reasoning Tier"}
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
