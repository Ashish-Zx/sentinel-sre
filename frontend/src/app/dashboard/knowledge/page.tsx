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

  const [rules, setRules] = useState<ProceduralRule>({
    min_confidence_threshold: 85,
    protected_paths: ["auth/", "payments/", "migrations/", "api/checkout.py"],
    custom_instructions:
      "Never modify database migration files automatically. Always require human approval for payment, Stripe, or checkout routes.",
  });
  const [newPathTag, setNewPathTag] = useState("");
  const [rulesSavedMessage, setRulesSavedMessage] = useState<string | null>(null);

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
            setUploadStage("1/3 Requesting 60s Presigned PUT URL from FastAPI…");
          if (stage === "uploading")
            setUploadStage("2/3 Uploading directly from Browser → Cloudflare R2…");
          if (stage === "ingesting")
            setUploadStage("3/3 Triggering pgvector Semantic Memory chunking…");
          if (stage === "done")
            setUploadStage("✅ Uploaded to R2 & indexed!");
        }
      );

      if (fileRecord) {
        setFiles((prev) => [fileRecord, ...prev]);
      }

      setUploadStage(`✅ Uploaded to R2 (${key}) & indexed!`);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Presigned upload failed");
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
      setRulesSavedMessage("Saved locally (Backend /api/rules endpoint will persist in M2).");
    }
    setTimeout(() => setRulesSavedMessage(null), 3000);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-6">
      <div>
        <h1 className="page-title">Knowledge &amp; Procedural Rules Vault</h1>
        <p className="page-sub max-w-2xl">
          Upload architecture runbooks &amp; crash logs directly to Cloudflare R2 via presigned URLs
          (Semantic Memory) and configure team safety invariants (Procedural Memory).
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left: Semantic Memory uploader */}
        <div className="space-y-4 lg:col-span-6">
          <div className="panel space-y-4 p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="status-info flex h-8 w-8 items-center justify-center rounded-lg">
                  <BookOpen className="h-4 w-4" />
                </span>
                <div>
                  <div className="text-sm font-semibold text-ink">
                    Semantic Memory Uploader
                  </div>
                  <div className="text-[11px] text-ink-3">Cloudflare R2 · pgvector</div>
                </div>
              </div>
              <select
                value={fileType}
                onChange={(e) => setFileType(e.target.value as FileType)}
                className="input h-8 w-auto text-xs"
                style={{ paddingBlock: 0 }}
              >
                <option value="runbook_pdf">Architecture Runbook (PDF)</option>
                <option value="crash_log">Production Crash Log (.log)</option>
                <option value="postmortem">Post-Mortem Doc (.md/.pdf)</option>
              </select>
            </div>

            <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-edge-strong bg-surface-1 p-8 text-center transition hover:border-signal-edge">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-signal-edge bg-signal-dim text-signal">
                <CloudUpload className="h-6 w-6" />
              </span>
              <span className="mt-3 text-sm font-semibold text-ink">
                Click to upload a runbook or crash log
              </span>
              <span className="mt-1 text-[11px] text-ink-3">
                Stored in object storage and indexed for semantic retrieval
              </span>
              <input
                type="file"
                accept=".pdf,.log,.txt,.md,application/pdf,text/plain"
                onChange={handleFileSelect}
                className="hidden"
              />
            </label>

            {uploadStage && (
              <div className="rounded-xl border border-signal-edge bg-signal-dim p-3 font-mono text-xs text-signal">
                {uploadStage}
              </div>
            )}

            {uploadError && (
              <div className="status-danger rounded-xl p-3 font-mono text-xs">
                {uploadError}
              </div>
            )}

            <div className="space-y-2 pt-1">
              <div className="text-[11px] font-medium uppercase tracking-wider text-ink-3">
                Knowledge Files
              </div>
              {files.length === 0 ? (
                <div className="rounded-xl border border-edge bg-surface-1 p-4 font-mono text-xs text-ink-3">
                  • Checkout_Stripe_Service_Runbook_v2.4.pdf (Indexed · 18 chunks in pgvector)
                </div>
              ) : (
                files.map((f) => (
                  <div
                    key={f.id}
                    className="flex items-center justify-between rounded-xl border border-edge bg-surface-1 px-3.5 py-2.5 text-xs"
                  >
                    <div>
                      <div className="font-medium text-ink">{f.file_name}</div>
                      <div className="font-mono text-[10px] text-ink-3">{f.s3_key}</div>
                    </div>
                    <span className="badge badge-live font-mono text-[10px]">
                      <CheckCircle2 className="h-3 w-3" />
                      {f.ingestion_status}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right: Procedural Memory editor */}
        <div className="lg:col-span-6">
          <form onSubmit={handleSaveRules} className="panel space-y-5 p-5">
            <div className="flex items-center gap-2.5">
              <span className="status-warning flex h-8 w-8 items-center justify-center rounded-lg">
                <ShieldAlert className="h-4 w-4" />
              </span>
              <div>
                <div className="text-sm font-semibold text-ink">Procedural Memory</div>
                <div className="text-[11px] text-ink-3">HITL escalation invariants</div>
              </div>
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between text-xs">
                <span className="font-medium text-ink-2">
                  Min L4 verifier confidence threshold
                </span>
                <span className="tabular font-bold text-signal">
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
              <p className="mt-1 text-[11px] text-ink-3">
                Investigations below {rules.min_confidence_threshold}% require human approval.
              </p>
            </div>

            <div>
              <label className="field-label">Protected file paths (always gate on human approval)</label>
              <div className="mb-2.5 flex flex-wrap gap-2">
                {rules.protected_paths.map((path) => (
                  <span
                    key={path}
                    className="status-warning inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 font-mono text-xs"
                  >
                    {path}
                    <button
                      type="button"
                      onClick={() => handleRemoveProtectedPath(path)}
                      className="cursor-pointer opacity-70 hover:opacity-100"
                      aria-label={`Remove ${path}`}
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
                  className="input font-mono text-xs"
                />
                <button
                  type="button"
                  onClick={handleAddProtectedPath}
                  className="btn btn-secondary h-9 shrink-0 px-3 text-xs"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Path
                </button>
              </div>
            </div>

            <div>
              <label className="field-label">Custom team safety instructions</label>
              <textarea
                rows={3}
                value={rules.custom_instructions ?? ""}
                onChange={(e) =>
                  setRules({ ...rules, custom_instructions: e.target.value })
                }
                className="input resize-none"
              />
            </div>

            {rulesSavedMessage && (
              <div className="rounded-lg border border-signal-edge bg-signal-dim px-3 py-2 font-mono text-xs text-signal">
                {rulesSavedMessage}
              </div>
            )}

            <button type="submit" className="btn btn-primary h-10 px-5 text-xs">
              <Save className="h-3.5 w-3.5" />
              Save Procedural Memory Rules
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
