"use client";

import { useAuth } from "@clerk/nextjs";
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileUp,
  Plus,
  Sparkles,
  XCircle,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  fetchIncidents,
  startIncidentInvestigation,
  uploadFileViaPresignedUrl,
} from "@/lib/api";
import type { Incident, IncidentStatus } from "@/lib/types";

function StatusBadge({ status }: { status: IncidentStatus }) {
  switch (status) {
    case "awaiting_approval":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 border border-amber-500/40 px-2.5 py-0.5 text-xs font-medium text-amber-300">
          <AlertTriangle className="h-3 w-3" />
          Awaiting HITL Approval
        </span>
      );
    case "resolved":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/40 px-2.5 py-0.5 text-xs font-medium text-emerald-300">
          <CheckCircle2 className="h-3 w-3" />
          Resolved (Draft PR Open)
        </span>
      );
    case "rejected":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/15 border border-red-500/40 px-2.5 py-0.5 text-xs font-medium text-red-300">
          <XCircle className="h-3 w-3" />
          Rejected by Engineer
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-500/15 border border-sky-500/40 px-2.5 py-0.5 text-xs font-medium text-sky-300">
          <Clock className="h-3 w-3 animate-spin" />
          Investigating...
        </span>
      );
  }
}

export default function DashboardIncidentsPage() {
  const { getToken } = useAuth();
  const router = useRouter();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewModal, setShowNewModal] = useState(false);

  // New Incident Form State (Matches Section 8 Runtime Error Ingestion Strategy)
  const [title, setTitle] = useState(
    "500 KeyError: 'discount_code' on POST /api/checkout"
  );
  const [githubRepoUrl, setGithubRepoUrl] = useState(
    "https://github.com/acme-corp/ecommerce-checkout-api"
  );
  const [commitSha, setCommitSha] = useState("9f3a1c2");
  const [rawStackTrace, setRawStackTrace] = useState(
    `POST /api/checkout -> 500 Internal Server Error\nFile "/app/api/checkout.py", line 84, in create_order\n    discount = payload["discount_code"]\nKeyError: 'discount_code'`
  );
  const [logFile, setLogFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);

  useEffect(() => {
    void fetchIncidents(getToken).then((data) => {
      setIncidents(data);
      setLoading(false);
    });
  }, [getToken]);

  async function handleSimulateDemoCrash() {
    router.push("/dashboard/incidents/demo-inc-992");
  }

  async function handleCreateIncident(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setUploadStatus(null);

    try {
      let uploadedS3Key: string | undefined;
      if (logFile) {
        const res = await uploadFileViaPresignedUrl(
          logFile,
          "crash_log",
          getToken,
          (stage) => setUploadStatus(`R2 Presigned Upload: ${stage}...`)
        );
        uploadedS3Key = res.key;
      }

      const started = await startIncidentInvestigation(
        {
          title,
          github_repo_url: githubRepoUrl,
          deployed_commit_sha: commitSha,
          raw_error_trace: rawStackTrace,
          raw_error_log_s3_key: uploadedS3Key,
          is_demo: false,
        },
        getToken
      );

      setShowNewModal(false);
      router.push(`/dashboard/incidents/${started.incident_id}`);
    } catch (err) {
      setUploadStatus(
        err instanceof Error ? err.message : "Failed to start incident"
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl p-6 space-y-6">
      {/* Top Action Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-zinc-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Production Incidents
          </h1>
          <p className="mt-1 text-xs text-zinc-400">
            Paste a runtime stack trace from Sentry/Railway/Vercel or trigger the 1-Click Sample Crash to launch the parallel multi-agent War Room.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleSimulateDemoCrash}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-xs font-semibold text-zinc-950 shadow-md shadow-emerald-500/15 transition hover:bg-emerald-400 cursor-pointer"
          >
            <Zap className="h-4 w-4" />
            Simulate Production Crash (Demo)
          </button>

          <button
            type="button"
            onClick={() => setShowNewModal(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-xs font-medium text-zinc-100 transition hover:bg-zinc-800 cursor-pointer"
          >
            <Plus className="h-4 w-4 text-emerald-400" />
            New Incident (Paste Stack Trace / Upload Log)
          </button>
        </div>
      </div>

      {/* Incidents Table */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-zinc-800 text-[11px] font-mono uppercase tracking-wider text-zinc-400 bg-zinc-900/70">
                <th className="py-3.5 px-4">Incident & Error Summary</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">L4 Confidence</th>
                <th className="py-3.5 px-4">Routed Cost / Latency</th>
                <th className="py-3.5 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/70 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-zinc-400">
                    Loading workspace incidents...
                  </td>
                </tr>
              ) : (
                incidents.map((inc) => (
                  <tr
                    key={inc.id}
                    className="transition-colors hover:bg-zinc-900/80"
                  >
                    <td className="py-4 px-4">
                      <Link
                        href={`/dashboard/incidents/${inc.id}`}
                        className="font-semibold text-zinc-100 hover:text-emerald-400 flex items-center gap-1.5"
                      >
                        {inc.title}
                        <ArrowUpRight className="h-3.5 w-3.5 text-zinc-500" />
                      </Link>
                      <div className="mt-1 text-[11px] text-zinc-400 font-mono">
                        Target: {inc.target_file_path ?? "api/checkout.py"} • Commit:{" "}
                        {inc.deployed_commit_sha ?? "9f3a1c2"}
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <StatusBadge status={inc.status} />
                    </td>
                    <td className="py-4 px-4">
                      {inc.confidence_score != null ? (
                        <span className="font-mono font-semibold text-emerald-400">
                          {inc.confidence_score}%
                        </span>
                      ) : (
                        <span className="text-zinc-500">—</span>
                      )}
                    </td>
                    <td className="py-4 px-4 font-mono text-zinc-300">
                      ${(inc.total_cost_usd ?? 0.0242).toFixed(4)} •{" "}
                      {((inc.total_latency_ms ?? 9840) / 1000).toFixed(1)}s
                    </td>
                    <td className="py-4 px-4 text-right">
                      <div className="inline-flex items-center gap-2">
                        {inc.github_pr_url && (
                          <a
                            href={inc.github_pr_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 text-[11px] text-zinc-300 hover:text-white"
                          >
                            PR <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                        <Link
                          href={`/dashboard/incidents/${inc.id}`}
                          className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 px-3 py-1.5 text-xs font-medium text-emerald-300 hover:bg-emerald-500/25"
                        >
                          Open War Room
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Incident Modal */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-emerald-400" />
                <h2 className="text-base font-semibold text-white">
                  Investigate Runtime Production Error
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowNewModal(false)}
                className="text-xs text-zinc-400 hover:text-white cursor-pointer"
              >
                Close ✕
              </button>
            </div>

            <form onSubmit={handleCreateIncident} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Incident Title / Failing Endpoint
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-zinc-300 mb-1">
                    GitHub Repository URL
                  </label>
                  <input
                    type="url"
                    required
                    value={githubRepoUrl}
                    onChange={(e) => setGithubRepoUrl(e.target.value)}
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 font-mono text-xs text-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">
                    Deployed Commit SHA
                  </label>
                  <input
                    type="text"
                    value={commitSha}
                    onChange={(e) => setCommitSha(e.target.value)}
                    placeholder="e.g. 9f3a1c2"
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 font-mono text-xs text-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Sanitized Stack Trace (From Sentry / Railway / Vercel / Docker Logs)
                </label>
                <textarea
                  rows={5}
                  required
                  value={rawStackTrace}
                  onChange={(e) => setRawStackTrace(e.target.value)}
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-900 p-3 font-mono text-xs text-emerald-300 focus:border-emerald-500 focus:outline-none"
                />
                <p className="mt-1 text-[11px] text-zinc-500">
                  Remove API keys, passwords, or PII before pasting.
                </p>
              </div>

              <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/50 p-3.5">
                <label className="flex items-center justify-between cursor-pointer">
                  <div className="flex items-center gap-2.5">
                    <FileUp className="h-4 w-4 text-sky-400" />
                    <div>
                      <span className="text-xs font-medium text-zinc-200">
                        Optional: Attach Full <code className="font-mono">.log</code> Dump (Direct-to-R2 Presigned PUT)
                      </span>
                      <p className="text-[11px] text-zinc-500">
                        {logFile
                          ? `Selected: ${logFile.name} (${(logFile.size / 1024).toFixed(1)} KB)`
                          : "Bypasses FastAPI RAM via Cloudflare R2 presigned URL"}
                      </p>
                    </div>
                  </div>
                  <input
                    type="file"
                    accept=".log,.txt"
                    onChange={(e) => setLogFile(e.target.files?.[0] ?? null)}
                    className="hidden"
                  />
                  <span className="rounded-lg border border-zinc-700 bg-zinc-800 px-2.5 py-1 text-[11px] text-zinc-200">
                    Choose .log
                  </span>
                </label>
              </div>

              {uploadStatus && (
                <div className="rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-xs text-sky-300 font-mono">
                  {uploadStatus}
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className="rounded-lg border border-zinc-800 px-4 py-2 text-xs text-zinc-400 hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-xs font-semibold text-zinc-950 hover:bg-emerald-400 disabled:opacity-50 cursor-pointer"
                >
                  <Zap className="h-3.5 w-3.5" />
                  {submitting ? "Launching Agents..." : "Start Parallel Investigation"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
