"use client";

import { Check, Copy, FileCode2 } from "lucide-react";
import { useState } from "react";

export default function CodeDiffTab({
  targetFilePath,
  patchDiff,
  status,
}: {
  targetFilePath: string | null;
  patchDiff: string | null;
  status?: "investigating" | "awaiting_approval" | "resolved" | "rejected";
}) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    if (!patchDiff) return;
    void navigator.clipboard.writeText(patchDiff);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (!patchDiff) {
    return (
      <div className="panel p-12 text-center font-mono text-xs text-ink-3">
        {status === "investigating"
          ? "Generating Unified Git Diff patch…"
          : "No hotfix patch was produced for this incident."}
      </div>
    );
  }

  const lines = patchDiff.split("\n");

  return (
    <div className="panel overflow-hidden bg-surface-1">
      <div className="flex items-center justify-between border-b border-edge bg-surface-2/80 px-4 py-2.5">
        <div className="flex items-center gap-2 font-mono text-xs text-ink-2">
          <FileCode2 className="h-4 w-4 text-signal" />
          {targetFilePath ?? "target file"}
          <span className="badge badge-live text-[10px]">AST Syntax Validated</span>
        </div>

        <button type="button" onClick={handleCopy} className="btn btn-secondary h-8 px-2.5 text-[11px]">
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 text-signal" />
              Copied Diff
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" />
              Copy Unified Diff
            </>
          )}
        </button>
      </div>

      <div className="overflow-x-auto p-4 font-mono text-xs leading-6">
        {lines.map((line, index) => {
          const isAdd = line.startsWith("+") && !line.startsWith("+++");
          const isRemove = line.startsWith("-") && !line.startsWith("---");
          const isHeader = line.startsWith("@@") || line.startsWith("---") || line.startsWith("+++");

          return (
            <div
              key={`${index}-${line.slice(0, 12)}`}
              className={`whitespace-pre rounded-sm px-3 py-0.5 ${
                isAdd
                  ? "border-l-2 border-signal bg-signal-dim/60 text-signal"
                  : isRemove
                    ? "border-l-2 border-[#e4a29b] bg-[#fff1ef] text-[#a32116]"
                    : isHeader
                      ? "my-1 bg-[#eef8fd] font-semibold text-[#075985]"
                      : "text-ink-2"
              }`}
            >
              {line}
            </div>
          );
        })}
      </div>
    </div>
  );
}
