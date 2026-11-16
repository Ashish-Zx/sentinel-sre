"use client";

import { BookOpen, FileWarning, GitCommit } from "lucide-react";
import ReactMarkdown from "react-markdown";
import type { Incident } from "@/lib/types";

const QUICK_CARDS = [
  {
    icon: FileWarning,
    label: "CRASH SIGNATURE",
    tone: "status-danger",
    iconTone: "text-[#a32116]",
    title: "",
    sub: "",
  },
  {
    icon: GitCommit,
    label: "OFFENDING COMMIT",
    tone: "status-info",
    iconTone: "text-[#075985]",
    title: "",
    sub: "",
  },
  {
    icon: BookOpen,
    label: "SEMANTIC MEMORY HIT",
    tone: "status-violet",
    iconTone: "text-[#6941c6]",
    title: "",
    sub: "",
  },
];

export default function RootCauseTab({ incident }: { incident: Incident }) {
  const cards = [
    { ...QUICK_CARDS[0], title: incident.target_file_path ?? "api/checkout.py:84", sub: "KeyError: 'discount_code'" },
    { ...QUICK_CARDS[1], title: `#${incident.deployed_commit_sha ?? "9f3a1c2"}`, sub: "Renamed discount_code → promo_code" },
    { ...QUICK_CARDS[2], title: "Checkout Runbook PDF §4.2", sub: "pgvector similarity: 0.91 (Page 4)" },
  ];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="panel p-3.5">
              <div className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-medium ${card.tone}`}>
                <Icon className={`h-3 w-3 ${card.iconTone}`} />
                {card.label}
              </div>
              <div className="mt-2 truncate font-mono text-xs font-semibold text-ink">
                {card.title}
              </div>
              <div className="mt-0.5 text-[11px] text-ink-3">{card.sub}</div>
            </div>
          );
        })}
      </div>

      <div className="panel p-5">
        {incident.root_cause_report ? (
          <div className="prose prose-sm max-w-none space-y-3 text-ink-2">
            <ReactMarkdown>{incident.root_cause_report}</ReactMarkdown>
          </div>
        ) : (
          <div className="py-12 text-center font-mono text-xs text-ink-3">
            Waiting for Incident Commander Synthesizer to complete root cause analysis…
          </div>
        )}
      </div>

      {incident.raw_error_trace && (
        <div className="rounded-xl border border-edge bg-surface-1 p-4">
          <div className="mb-2 text-[11px] font-medium uppercase tracking-wider text-ink-3">
            Ingested Runtime Error Stack Trace
          </div>
          <pre className="overflow-x-auto font-mono text-xs leading-relaxed text-[#a32116]">
            {incident.raw_error_trace}
          </pre>
        </div>
      )}
    </div>
  );
}
