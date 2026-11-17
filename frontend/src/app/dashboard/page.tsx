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
  Trash2,
  XCircle,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import {
  deleteIncident,
  fetchGithubCommits,
  fetchGithubRepos,
  fetchIncidents,
  startIncidentInvestigation,
  uploadFileViaPresignedUrl,
} from "@/lib/api";
import type { Incident, IncidentStatus } from "@/lib/types";
import GithubConnect from "@/components/github-connect";
import SlackConnect from "@/components/slack-connect";

function StatusBadge({
  status,
  githubPrUrl,
}: {
  status: IncidentStatus;
  githubPrUrl?: string | null;
}) {
  switch (status) {
    case "awaiting_approval":
      return (
        <span className="badge badge-warn">
          <AlertTriangle className="h-3 w-3" />
          Awaiting HITL Approval
        </span>
      );
    case "resolved":
      const isDraftPr = !!githubPrUrl && /\/pull\//.test(githubPrUrl);
      return (
        <span className="badge badge-live">
          <CheckCircle2 className="h-3 w-3" />
          {isDraftPr ? "Resolved · Draft PR Open" : "Resolved · Commit Pushed"}
        </span>
      );
    case "rejected":
      return (
        <span className="badge badge-danger">
          <XCircle className="h-3 w-3" />
          Rejected by Engineer
        </span>
      );
    default:
      return (
        <span className="badge badge-info">
          <Clock className="h-3 w-3 animate-spin" />
          Investigating…
        </span>
      );
  }
}

export default function DashboardIncidentsPage() {
  const { getToken } = useAuth();
  const router = useRouter();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);

  const [title, setTitle] = useState("");
  const [githubRepoUrl, setGithubRepoUrl] = useState("");
  const [commitSha, setCommitSha] = useState("");
  const [rawStackTrace, setRawStackTrace] = useState("");
  const [logFile, setLogFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [githubRepos, setGithubRepos] = useState<string[]>([]);
  const [githubReposLoading, setGithubReposLoading] = useState(false);
  const [commits, setCommits] = useState<{ sha: string; message: string }[]>([]);
  const [commitsLoading, setCommitsLoading] = useState(false);

  useEffect(() => {
    void fetchIncidents(getToken).then((data) => {
      setIncidents(data);
      setLoading(false);
    });
  }, [getToken]);

  function openNewModal() {
    setShowNewModal(true);
    setTitle("");
    setGithubRepoUrl("");
    setCommitSha("");
    setRawStackTrace("");
    setGithubRepos([]);
    setGithubReposLoading(true);
    setCommits([]);
    setCommitsLoading(true);
  }

  useEffect(() => {
    if (!showNewModal) return;
    void fetchGithubRepos(getToken).then((res) => {
      if (res.connected && res.repos.length) {
        setGithubRepos(res.repos);
      }
      setGithubReposLoading(false);
    });
  }, [showNewModal, getToken]);

  useEffect(() => {
    if (!showNewModal || githubRepos.length === 0 || !githubRepoUrl) return;
    let cancelled = false;
    void fetchGithubCommits(getToken, githubRepoUrl).then((res) => {
      if (cancelled) return;
      if (res.connected && res.commits.length) {
        setCommits(res.commits);
      } else {
        setCommits([]);
      }
      setCommitsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [showNewModal, githubRepoUrl, githubRepos.length, getToken]);

  function handleRepoChange(value: string) {
    setGithubRepoUrl(value);
    setCommits([]);
    setCommitsLoading(true);
    setCommitSha("");
  }

  async function handleSimulateDemoCrash() {
    router.push("/dashboard/incidents/demo-inc-992");
  }

  async function handleDeleteIncident(id: string) {
    if (!window.confirm("Delete this incident permanently?")) return;
    setDeletingId(id);
    try {
      await deleteIncident(id, getToken);
      setIncidents((prev) => prev.filter((i) => i.id !== id));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete incident");
    } finally {
      setDeletingId(null);
    }
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
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <Suspense fallback={null}>
        <GithubConnect getToken={getToken} />
      </Suspense>
      <Suspense fallback={null}>
        <SlackConnect getToken={getToken} />
      </Suspense>

      {/* Page header */}
      <div className="page-head">
        <div>
          <h1 className="page-title">Production Incidents</h1>
          <p className="page-sub max-w-xl">
            Paste a runtime stack trace or simulate a production crash to launch a multi-agent investigation.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleSimulateDemoCrash}
            className="btn btn-primary h-9 px-4 text-xs"
          >
            <Zap className="h-4 w-4" />
            Simulate Production Crash (Demo)
          </button>

          <button
            type="button"
            onClick={openNewModal}
            className="btn btn-secondary h-9 px-4 text-xs"
          >
            <Plus className="h-4 w-4 text-signal" />
            New Incident
          </button>
        </div>
      </div>

      {/* Incidents table */}
      <div className="panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-edge text-[11px] font-medium uppercase tracking-wider text-ink-3">
                <th className="px-5 py-3.5">Incident &amp; Error Summary</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5">L4 Confidence</th>
                <th className="px-5 py-3.5">Routed Cost / Latency</th>
                <th className="px-5 py-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-edge text-sm">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-xs text-ink-3">
                    Loading workspace incidents…
                  </td>
                </tr>
              ) : (
                incidents.map((inc) => (
                  <tr key={inc.id} className="transition-colors hover:bg-surface-2">
                    <td className="px-5 py-4">
                      <Link
                        href={`/dashboard/incidents/${inc.id}`}
                        className="group flex items-center gap-1.5 font-medium text-ink hover:text-signal"
                      >
                        {inc.title}
                        <ArrowUpRight className="h-3.5 w-3.5 text-ink-3 transition-colors group-hover:text-signal" />
                      </Link>
                      <div className="mt-1 font-mono text-[11px] text-ink-3">
                        Target: {inc.target_file_path ?? "api/checkout.py"} · Commit:{" "}
                        {inc.deployed_commit_sha ?? "9f3a1c2"}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <StatusBadge status={inc.status} githubPrUrl={inc.github_pr_url} />
                    </td>
                    <td className="px-5 py-4">
                      {inc.confidence_score != null ? (
                        <span className="tabular font-semibold text-signal">
                          {inc.confidence_score}%
                        </span>
                      ) : (
                        <span className="text-ink-3">—</span>
                      )}
                    </td>
                    <td className="tabular px-5 py-4 font-mono text-xs text-ink-2">
                      ${(inc.total_cost_usd ?? 0.0242).toFixed(4)} ·{" "}
                      {((inc.total_latency_ms ?? 9840) / 1000).toFixed(1)}s
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="inline-flex items-center gap-2">
                        {inc.github_pr_url && (
                          <a
                            href={inc.github_pr_url}
                            target="_blank"
                            rel="noreferrer"
                            className="btn btn-ghost h-8 px-2.5 text-[11px]"
                          >
                            {/\/pull\//.test(inc.github_pr_url) ? "PR" : "Commit"}{" "}
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                        <Link
                          href={`/dashboard/incidents/${inc.id}`}
                          className="btn h-8 border border-signal-edge bg-signal-dim px-3 text-xs font-medium text-signal hover:bg-signal-dim/80"
                        >
                          Open War Room
                        </Link>
                        <button
                          type="button"
                          title="Delete incident"
                          aria-label="Delete incident"
                          disabled={deletingId === inc.id}
                          onClick={() => handleDeleteIncident(inc.id)}
                          className="btn h-8 w-8 items-center justify-center p-0 text-ink-3 hover:text-[#a32116] disabled:opacity-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Incident modal */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="panel w-full max-w-2xl bg-surface-1 p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-edge pb-4">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-signal-edge bg-signal-dim text-signal">
                  <Sparkles className="h-4 w-4" />
                </span>
                <h2 className="text-base font-semibold text-ink">
                  Investigate Runtime Production Error
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowNewModal(false)}
                className="text-xs text-ink-3 hover:text-ink cursor-pointer"
              >
                Close ✕
              </button>
            </div>

            <form onSubmit={handleCreateIncident} className="mt-5 space-y-4">
              <div>
                <label className="field-label">Incident Title / Failing Endpoint</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. 500 KeyError in POST /api/checkout"
                  className="input"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="sm:col-span-2">
                  <label className="field-label">GitHub Repository</label>
                  {githubRepos.length > 0 ? (
                    <>
                      <select
                        value={githubRepoUrl}
                        onChange={(e) => handleRepoChange(e.target.value)}
                        className="input font-mono text-xs"
                      >
                        <option value="" disabled>
                          Select a repository…
                        </option>
                        {githubRepos.map((repo) => (
                          <option key={repo} value={repo}>
                            {repo}
                          </option>
                        ))}
                      </select>
                      <p className="mt-1.5 text-[11px] text-ink-3">
                        From your connected GitHub account.
                      </p>
                    </>
                  ) : (
                    <>
                      <input
                        type="url"
                        required={githubRepos.length === 0}
                        value={githubRepoUrl}
                        onChange={(e) => setGithubRepoUrl(e.target.value)}
                        placeholder={
                          githubReposLoading
                            ? "Loading your repos…"
                            : "https://github.com/owner/repo"
                        }
                        className="input font-mono text-xs"
                      />
                      <p className="mt-1.5 text-[11px] text-ink-3">
                        {githubReposLoading
                          ? ""
                          : "Connect GitHub above to choose from your repositories."}
                      </p>
                    </>
                  )}
                </div>
                <div>
                  <label className="field-label">Deployed Commit</label>
                  {commits.length > 0 ? (
                    <>
                      <select
                        value={commitSha}
                        onChange={(e) => setCommitSha(e.target.value)}
                        className="input font-mono text-xs"
                      >
                        <option value="" disabled>
                          Select a commit…
                        </option>
                        {commits.map((c) => (
                          <option key={c.sha} value={c.sha}>
                            {c.sha.slice(0, 7)} · {c.message}
                          </option>
                        ))}
                      </select>
                      <p className="mt-1.5 text-[11px] text-ink-3">
                        Most recent commit from the selected repo.
                      </p>
                    </>
                  ) : (
                    <>
                      <input
                        type="text"
                        value={commitSha}
                        onChange={(e) => setCommitSha(e.target.value)}
                        placeholder={
                          commitsLoading ? "Loading commits…" : "e.g. 9f3a1c2"
                        }
                        className="input font-mono text-xs"
                      />
                      <p className="mt-1.5 text-[11px] text-ink-3">
                        {commitsLoading
                          ? ""
                          : githubRepos.length > 0
                            ? "No commits available for this repo."
                            : "Connect GitHub to pick a commit."}
                      </p>
                    </>
                  )}
                </div>
              </div>

              <div>
                <label className="field-label">Stack Trace</label>
                <textarea
                  rows={5}
                  required
                  value={rawStackTrace}
                  onChange={(e) => setRawStackTrace(e.target.value)}
                  placeholder="Paste your stack trace here…"
                  className="input resize-none font-mono text-xs text-signal"
                />
                <p className="mt-1.5 text-[11px] text-ink-3">
                  Remove API keys, passwords, or PII before pasting.
                </p>
              </div>

              <div className="rounded-xl border border-dashed border-edge-strong bg-surface-1 p-3.5">
                <label className="flex cursor-pointer items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <FileUp className="h-4 w-4 text-[#075985]" />
                    <div>
                      <span className="text-xs font-medium text-ink-2">
                        Optional: Attach a <code className="font-mono">.log</code> dump
                      </span>
                      <p className="text-[11px] text-ink-3">
                        {logFile
                          ? `Selected: ${logFile.name} (${(logFile.size / 1024).toFixed(1)} KB)`
                          : "Uploaded directly to object storage"}
                      </p>
                    </div>
                  </div>
                  <input
                    type="file"
                    accept=".log,.txt"
                    onChange={(e) => setLogFile(e.target.files?.[0] ?? null)}
                    className="hidden"
                  />
                  <span className="btn btn-secondary h-7 px-2.5 text-[11px]">
                    Choose .log
                  </span>
                </label>
              </div>

              {uploadStatus && (
                <div className="status-info rounded-lg px-3 py-2 font-mono text-xs">
                  {uploadStatus}
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className="btn btn-ghost h-9 px-4 text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn btn-primary h-9 px-4 text-xs"
                >
                  <Zap className="h-3.5 w-3.5" />
                  {submitting ? "Launching Agents…" : "Start Parallel Investigation"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
