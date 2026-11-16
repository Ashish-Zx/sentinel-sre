"use client";

import { BookOpen, FileWarning, GitCommit } from "lucide-react";
import ReactMarkdown from "react-markdown";
import type { Incident } from "@/lib/types";

export default function RootCauseTab({ incident }: { incident: Incident }) {
  return (
    <div className="space-y-5">
      {/* Citation Quick-Cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3.5">
          <div className="flex items-center gap-1.5 text-[11px] font-mono text-red-400">
            <FileWarning className="h-3.5 w-3.5" />
            CRASH SIGNATURE
          </div>
          <div className="mt-1 font-mono text-xs font-semibold text-zinc-100 truncate">
            {incident.target_file_path ?? "api/checkout.py"}:84
          </div>
          <div className="mt-0.5 text-[11px] text-zinc-400">
            KeyError: &apos;discount_code&apos;
          </div>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3.5">
          <div className="flex items-center gap-1.5 text-[11px] font-mono text-sky-400">
            <GitCommit className="h-3.5 w-3.5" />
            OFFENDING COMMIT (MCP)
          </div>
          <div className="mt-1 font-mono text-xs font-semibold text-zinc-100">
            #{incident.deployed_commit_sha ?? "9f3a1c2"}
          </div>
          <div className="mt-0.5 text-[11px] text-zinc-400">
            Renamed discount_code → promo_code
          </div>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3.5">
          <div className="flex items-center gap-1.5 text-[11px] font-mono text-violet-400">
            <BookOpen className="h-3.5 w-3.5" />
            SEMANTIC MEMORY HIT
          </div>
          <div className="mt-1 font-mono text-xs font-semibold text-zinc-100">
            Checkout Runbook PDF §4.2
          </div>
          <div className="mt-0.5 text-[11px] text-zinc-400">
            pgvector similarity: 0.91 (Page 4)
          </div>
        </div>
      </div>

      {/* Rendered Markdown Root Cause Analysis */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
        {incident.root_cause_report ? (
          <div className="prose prose-invert prose-sm max-w-none text-zinc-300 space-y-3 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:text-white [&_h3]:mt-4 [&_strong]:text-zinc-100 [&_code]:rounded [&_code]:bg-zinc-800 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-emerald-300 [&_ul]:list-disc [&_ul]:pl-5 [&_li]:my-1">
            <ReactMarkdown>{incident.root_cause_report}</ReactMarkdown>
          </div>
        ) : (
          <div className="py-12 text-center text-xs text-zinc-500 font-mono">
            Waiting for Incident Commander Synthesizer to complete root cause analysis...
          </div>
        )}
      </div>

      {/* Raw Stack Trace Box */}
      {incident.raw_error_trace && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
          <div className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 mb-2">
            Ingested Runtime Error Stack Trace
          </div>
          <pre className="overflow-x-auto font-mono text-xs text-red-300 leading-relaxed">
            {incident.raw_error_trace}
          </pre>
        </div>
      )}
    </div>
  );
}
