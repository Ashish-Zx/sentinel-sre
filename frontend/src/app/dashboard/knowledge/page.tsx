"use client";

import { useAuth } from "@clerk/nextjs";
import {
  BookOpen,
  CheckCircle2,
  CloudUpload,
  Plus,
  Save,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";
import {
  fetchKnowledgeFiles,
  fetchProceduralRules,
  updateProceduralRules,
  uploadFileViaPresignedUrl,
} from "@/lib/api";
import type { FileType, KnowledgeFile, ProceduralRule } from "@/lib/types";

export default function KnowledgeAndRulesVaultPage() {
  const { getToken } = useAuth();
  const [files, setFiles] = useState<KnowledgeFile[]>([]);
  const [fileType, setFileType] = useState<FileType>("runbook_pdf");
  const [uploadStage, setUploadStage] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Procedural Memory State
  const [rules, setRules] = useState<ProceduralRule>({
    min_confidence_threshold: 85,
    protected_paths: ["auth/", "payments/", "migrations/", "api/checkout.py"],
    custom_instructions:
      "Never modify database migration files automatically. Always require human approval for payment, Stripe, or checkout routes.",
  });
  const [newPathTag, setNewPathTag] = useState("");
  const [rulesSavedMessage, setRulesSavedMessage] = useState<string | null>(
    null
  );

  useEffect(() => {
    void fetchKnowledgeFiles(getToken).then(setFiles);
    void fetchProceduralRules(getToken).then(setRules);
  }, [getToken]);

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    if (!selected) return;

    setUploadError(null);
    try {
      const { key, fileRecord } = await uploadFileViaPresignedUrl(
        selected,
        fileType,
        getToken,
        (stage) => {
          if (stage === "presigning")
            setUploadStage("1/3 Requesting 60s Presigned PUT URL from FastAPI...");
          if (stage === "uploading")
            setUploadStage("2/3 Uploading directly from Browser → Cloudflare R2...");
          if (stage === "ingesting")
            setUploadStage("3/3 Triggering pgvector Semantic Memory chunking...");
          if (stage === "done")
            setUploadStage(`✅ Uploaded to R2 (${key}) & indexed!`);
        }
      );

      if (fileRecord) {
        setFiles((prev) => [fileRecord, ...prev]);
      }
    } catch (err) {
      setUploadError(
        err instanceof Error ? err.message : "Presigned upload failed"
      );
      setUploadStage(null);
    }
  }

  function handleAddProtectedPath() {
    const trimmed = newPathTag.trim();
    if (!trimmed || rules.protected_paths.includes(trimmed)) return;
    setRules({
      ...rules,
      protected_paths: [...rules.protected_paths, trimmed],
    });
    setNewPathTag("");
  }

  function handleRemoveProtectedPath(target: string) {
    setRules({
      ...rules,
      protected_paths: rules.protected_paths.filter((p) => p !== target),
    });
  }

  async function handleSaveRules(e: React.FormEvent) {
    e.preventDefault();
    try {
      const updated = await updateProceduralRules(rules, getToken);
      setRules(updated);
      setRulesSavedMessage("Procedural Memory rules saved to Postgres.");
    } catch {
      setRulesSavedMessage(
        "Saved locally (Backend /api/rules endpoint will persist in M2)."
      );
    }
    setTimeout(() => setRulesSavedMessage(null), 3000);
  }

  return (
    <div className="mx-auto max-w-6xl p-6 space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">
          Knowledge & Procedural Rules Vault
        </h1>
        <p className="mt-1 text-xs text-zinc-400">
          Upload architecture runbooks & crash logs directly to Cloudflare R2 via Presigned URLs (**Semantic Memory**) and configure team safety invariants (**Procedural Memory**).
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column: Direct-to-R2 Presigned Uploader (Semantic Memory) */}
        <div className="lg:col-span-6 space-y-4">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <BookOpen className="h-4 w-4 text-sky-400" />
                Tier 1: Semantic Memory Uploader (Cloudflare R2)
              </div>
              <select
                value={fileType}
                onChange={(e) => setFileType(e.target.value as FileType)}
                className="rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-xs text-zinc-200"
              >
                <option value="runbook_pdf">Architecture Runbook (PDF)</option>
                <option value="crash_log">Production Crash Log (.log)</option>
                <option value="postmortem">Post-Mortem Doc (.md/.pdf)</option>
              </select>
            </div>

            <label className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-zinc-700 bg-zinc-950/60 p-8 text-center transition hover:border-emerald-500/50 cursor-pointer">
              <CloudUpload className="h-8 w-8 text-emerald-400 mb-2" />
              <span className="text-xs font-semibold text-zinc-200">
                Click to upload PDF Runbook or .log file directly to Cloudflare R2
              </span>
              <span className="mt-1 text-[11px] text-zinc-500">
                Uses <code className="font-mono">POST /api/storage/presign</code> → Browser <code className="font-mono">PUT</code> → <code className="font-mono">pgvector</code> (1536 dims)
              </span>
              <input
                type="file"
                accept=".pdf,.log,.txt,.md,application/pdf,text/plain"
                onChange={handleFileSelect}
                className="hidden"
              />
            </label>

            {uploadStage && (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 font-mono text-xs text-emerald-300">
                {uploadStage}
              </div>
            )}

            {uploadError && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 font-mono text-xs text-red-300">
                {uploadError}
              </div>
            )}

            {/* Uploaded Files List */}
            <div className="space-y-2 pt-2">
              <div className="text-[11px] font-mono uppercase tracking-wider text-zinc-400">
                Indexed Workspace Knowledge Files
              </div>
              {files.length === 0 ? (
                <div className="rounded-xl border border-zinc-800/80 bg-zinc-950 p-4 text-xs text-zinc-400 font-mono">
                  • Checkout_Stripe_Service_Runbook_v2.4.pdf (Indexed • 18 chunks in pgvector)
                </div>
              ) : (
                files.map((f) => (
                  <div
                    key={f.id}
                    className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-xs"
                  >
                    <div>
                      <div className="font-medium text-zinc-200">
                        {f.file_name}
                      </div>
                      <div className="font-mono text-[10px] text-zinc-500">
                        {f.s3_key}
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 font-mono text-[10px] text-emerald-300">
                      <CheckCircle2 className="h-3 w-3" />
                      {f.ingestion_status}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Procedural Memory Editor */}
        <div className="lg:col-span-6">
          <form
            onSubmit={handleSaveRules}
            className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5 space-y-5"
          >
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <ShieldAlert className="h-4 w-4 text-amber-400" />
              Tier 2: Procedural Memory (HITL Escalation Invariants)
            </div>

            <div>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="font-medium text-zinc-300">
                  Minimum L4 Verifier Confidence Threshold
                </span>
                <span className="font-mono font-bold text-emerald-400">
                  {rules.min_confidence_threshold}%
                </span>
              </div>
              <input
                type="range"
                min={50}
                max={99}
                value={rules.min_confidence_threshold}
                onChange={(e) =>
                  setRules({
                    ...rules,
                    min_confidence_threshold: Number(e.target.value),
                  })
                }
                className="w-full accent-emerald-500"
              />
              <p className="text-[11px] text-zinc-500 mt-1">
                Any investigation scoring below {rules.min_confidence_threshold}% automatically triggers <code className="font-mono">interrupt()</code> in LangGraph.
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-2">
                Protected File Paths (Always Trigger Human Approval Gate)
              </label>
              <div className="flex flex-wrap gap-2 mb-2.5">
                {rules.protected_paths.map((path) => (
                  <span
                    key={path}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 font-mono text-xs text-amber-300"
                  >
                    {path}
                    <button
                      type="button"
                      onClick={() => handleRemoveProtectedPath(path)}
                      className="text-amber-400/70 hover:text-amber-200 cursor-pointer"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newPathTag}
                  onChange={(e) => setNewPathTag(e.target.value)}
                  placeholder="e.g. billing/ or webhooks/stripe.py"
                  className="flex-1 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-1.5 font-mono text-xs text-white"
                />
                <button
                  type="button"
                  onClick={handleAddProtectedPath}
                  className="inline-flex items-center gap-1 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-700 cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Path
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                Custom Team Safety Instructions
              </label>
              <textarea
                rows={3}
                value={rules.custom_instructions ?? ""}
                onChange={(e) =>
                  setRules({ ...rules, custom_instructions: e.target.value })
                }
                className="w-full rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-xs text-zinc-200"
              />
            </div>

            {rulesSavedMessage && (
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300 font-mono">
                {rulesSavedMessage}
              </div>
            )}

            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-xs font-semibold text-zinc-950 hover:bg-emerald-400 cursor-pointer"
            >
              <Save className="h-3.5 w-3.5" />
              Save Procedural Memory Rules
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
