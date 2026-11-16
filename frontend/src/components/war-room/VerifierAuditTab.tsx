"use client";

import { CheckCircle2, Lock, ShieldAlert, ShieldCheck } from "lucide-react";
import type { Incident } from "@/lib/types";

export default function VerifierAuditTab({ incident }: { incident: Incident }) {
  const score = incident.confidence_score ?? 0;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[11px] font-mono uppercase tracking-wider text-violet-400">
              L4 Fresh-Context Verifier Shield
            </span>
            <h3 className="text-base font-semibold text-white mt-0.5">
              Zero-History Hallucination & Invariant Audit
            </h3>
          </div>
          <div className="text-right">
            <span className="font-mono text-2xl font-bold text-emerald-400">{score}%</span>
            <span className="block text-[10px] font-mono text-zinc-400">Threshold: 85%</span>
          </div>
        </div>

        <div className="mt-3 h-2.5 w-full rounded-full bg-zinc-800 overflow-hidden">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all duration-500"
            style={{ width: `${Math.min(100, score)}%` }}
          />
        </div>

        <p className="mt-4 text-xs text-zinc-300 leading-relaxed rounded-xl border border-zinc-800 bg-zinc-950 p-3.5 font-mono">
          {incident.verifier_critique ?? "Verifier awaits synthesizer patch output..."}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-300">
            <ShieldCheck className="h-4 w-4" />
            Isolated Prompt Context (No Agent Chatter)
          </div>
          <p className="text-xs text-zinc-400 leading-relaxed">
            The L4 Verifier Node never sees the 4 specialist agents&apos; reasoning chain. It inspects only:
          </p>
          <ul className="text-xs text-zinc-300 space-y-1 font-mono pl-4 list-disc">
            <li>1. Raw stack trace line (`KeyError: &apos;discount_code&apos;`)</li>
            <li>2. Raw file from GitHub (`api/checkout.py`)</li>
            <li>3. Proposed Unified Diff + Python AST parse check</li>
          </ul>
        </div>

        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-amber-300">
            <ShieldAlert className="h-4 w-4" />
            Why HITL Escalation Gate Triggered
          </div>
          <p className="text-xs text-zinc-300 leading-relaxed">
            {incident.escalation_reason ??
              "Protected path rule matched: files touching /payments or checkout.py require explicit human approval before opening a GitHub PR."}
          </p>
          <div className="pt-1 flex items-center gap-2 text-[11px] font-mono text-amber-300">
            <Lock className="h-3.5 w-3.5" />
            LangGraph state checkpointed in Postgres (`thread_id = {incident.id}`)
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4 flex items-center justify-between text-xs">
        <span className="flex items-center gap-2 text-zinc-300">
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          Deterministic Python <code className="font-mono">ast.parse()</code> & line-range validation
        </span>
        <span className="font-mono text-emerald-400">PASSED (0 retries)</span>
      </div>
    </div>
  );
}
