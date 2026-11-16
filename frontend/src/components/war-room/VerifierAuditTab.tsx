"use client";

import { CheckCircle2, Lock, ShieldAlert, ShieldCheck } from "lucide-react";
import type { Incident } from "@/lib/types";

export default function VerifierAuditTab({ incident }: { incident: Incident }) {
  const score = incident.confidence_score ?? 0;

  return (
    <div className="space-y-4">
      <div className="panel p-5">
        <div className="flex items-center justify-between">
          <div>
            <span className="font-mono text-[11px] uppercase tracking-wider text-[#6941c6]">
              L4 Fresh-Context Verifier Shield
            </span>
            <h3 className="mt-0.5 text-base font-semibold text-ink">
              Zero-History Hallucination &amp; Invariant Audit
            </h3>
          </div>
          <div className="text-right">
            <span className="tabular font-mono text-2xl font-bold text-signal">{score}%</span>
            <span className="block font-mono text-[10px] text-ink-3">Threshold: 85%</span>
          </div>
        </div>

        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-surface-3">
          <div
            className="h-full rounded-full bg-signal transition-all duration-500"
            style={{ width: `${Math.min(100, score)}%` }}
          />
        </div>

        <p className="mt-4 rounded-xl border border-edge bg-surface-1 p-3.5 font-mono text-xs leading-relaxed text-ink-2">
          {incident.verifier_critique ?? "Verifier awaits synthesizer patch output…"}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="panel space-y-2 p-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-signal">
            <ShieldCheck className="h-4 w-4" />
            Isolated Prompt Context (No Agent Chatter)
          </div>
          <p className="text-xs leading-relaxed text-ink-2">
            The L4 Verifier Node never sees the 4 specialist agents&apos; reasoning chain. It inspects only:
          </p>
          <ul className="space-y-1 pl-4 font-mono text-xs text-ink-2 [list-style:disc]">
            <li>1. Raw stack trace line (`KeyError: &apos;discount_code&apos;`)</li>
            <li>2. Raw file from GitHub (`api/checkout.py`)</li>
            <li>3. Proposed Unified Diff + Python AST parse check</li>
          </ul>
        </div>

        <div className="status-warning rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold">
            <ShieldAlert className="h-4 w-4" />
            Why HITL Escalation Gate Triggered
          </div>
          <p className="text-xs leading-relaxed text-ink-2">
            {incident.escalation_reason ??
              "Protected path rule matched: files touching /payments or checkout.py require explicit human approval before opening a GitHub PR."}
          </p>
          <div className="flex items-center gap-2 pt-1 font-mono text-[11px]">
            <Lock className="h-3.5 w-3.5" />
            LangGraph state checkpointed in Postgres (thread_id = {incident.id})
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between rounded-xl border border-edge bg-surface-1 p-4 text-xs">
        <span className="flex items-center gap-2 text-ink-2">
          <CheckCircle2 className="h-4 w-4 text-signal" />
          Deterministic Python <code className="font-mono">ast.parse()</code> &amp; line-range validation
        </span>
        <span className="tabular font-mono text-signal">PASSED (0 retries)</span>
      </div>
    </div>
  );
}
