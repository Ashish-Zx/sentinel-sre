"use client";

import { Check, Copy, FileCode2 } from "lucide-react";
import { useState } from "react";

export default function CodeDiffTab({
  targetFilePath,
  patchDiff,
}: {
  targetFilePath: string | null;
  patchDiff: string | null;
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
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-12 text-center font-mono text-xs text-zinc-500">
        Generating Unified Git Diff patch...
      </div>
    );
  }

  const lines = patchDiff.split("\n");

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950 overflow-hidden">
      <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900/80 px-4 py-2.5">
        <div className="flex items-center gap-2 font-mono text-xs text-zinc-200">
          <FileCode2 className="h-4 w-4 text-emerald-400" />
          {targetFilePath ?? "api/checkout.py"}
          <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] text-emerald-300 border border-emerald-500/30">
            AST Syntax Validated
          </span>
        </div>

        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-[11px] font-medium text-zinc-300 hover:text-white cursor-pointer"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 text-emerald-400" />
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
              className={`px-3 py-0.5 rounded-sm whitespace-pre ${
                isAdd
                  ? "bg-emerald-500/15 text-emerald-300 border-l-2 border-emerald-400"
                  : isRemove
                    ? "bg-red-500/15 text-red-300 border-l-2 border-red-400"
                    : isHeader
                      ? "bg-sky-500/10 text-sky-300 font-semibold my-1"
                      : "text-zinc-300"
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
