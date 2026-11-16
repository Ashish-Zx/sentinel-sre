import {
  Activity,
  ArrowRight,
  GitPullRequest,
  Radio,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import Link from "next/link";

const PIPELINE = [
  {
    icon: Radio,
    step: "01",
    delay: "motion-delay-1",
    title: "Ingest the failure",
    desc: "Paste a real runtime stack trace or drop a log dump. No YAML, no setup — just the error.",
  },
  {
    icon: Activity,
    step: "02",
    delay: "motion-delay-2",
    title: "Run the parallel war room",
    desc: "Log, Git, runbook and security agents investigate in parallel and stream every step live.",
  },
  {
    icon: ShieldCheck,
    step: "03",
    delay: "motion-delay-3",
    title: "Verify with zero history",
    desc: "A fresh-context L4 verifier audits the proposed diff for hallucinations and safety invariants.",
  },
  {
    icon: GitPullRequest,
    step: "04",
    delay: "motion-delay-3",
    title: "Approve a clean hotfix",
    desc: "Engineers review, approve, and the fix ships as a draft PR — gate-kept on payment & checkout paths.",
  },
];

export default function Home() {
  return (
    <div className="flex flex-1 flex-col font-sans">
      {/* Hero */}
      <section className="relative mx-auto w-full max-w-6xl px-6 pt-24 pb-16 sm:pt-32 text-center">
        <div className="motion-enter mx-auto inline-flex items-center gap-2 rounded-full border border-edge-strong bg-surface-2 px-3.5 py-1.5 text-xs text-ink-2">
          <span className="live-dot" />
          Autonomous Incident &amp; Root-Cause Engineering
        </div>

        <h1 className="motion-enter motion-delay-1 mx-auto mt-7 max-w-4xl text-4xl font-bold tracking-tight text-ink text-balance sm:text-6xl">
          Your production crash, resolved before your coffee goes cold.
        </h1>

        <p className="motion-enter motion-delay-2 mx-auto mt-6 max-w-2xl text-base leading-relaxed text-ink-2 text-pretty sm:text-lg">
          SentinelSRE investigates a stack trace across logs, Git history, and runbooks, then hands back a
          verified, ready-to-merge hotfix.
        </p>

        <div className="motion-enter motion-delay-2 mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/sign-in"
            className="btn btn-primary h-11 px-6 text-sm"
          >
            Open the war room
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/dashboard/incidents/demo-inc-992"
            className="btn btn-secondary h-11 px-6 text-sm"
          >
            <Sparkles className="h-4 w-4 text-signal" />
            Watch a live demo
          </Link>
        </div>

        <div className="motion-enter motion-delay-3 mx-auto mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-ink-3">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-signal" />
            L4 verifier on every patch
          </span>
          <span className="flex items-center gap-1.5">
            <Radio className="h-3.5 w-3.5 text-signal" />
            Live SSE progress streaming
          </span>
          <span className="flex items-center gap-1.5">
            <GitPullRequest className="h-3.5 w-3.5 text-signal" />
            HITL safety gates on hot paths
          </span>
        </div>
      </section>

      {/* Pipeline */}
      <section className="mx-auto w-full max-w-6xl px-6 pb-24">
        <div className="panel panel-hover motion-enter p-8 sm:p-10">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4">
            {PIPELINE.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.step} className={`motion-enter ${item.delay}`}>
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-edge-strong bg-surface-3 text-signal">
                      <Icon className="h-4.5 w-4.5" />
                    </span>
                    <span className="font-mono text-xs text-ink-3">{item.step}</span>
                  </div>
                  <h3 className="mt-4 text-sm font-semibold text-ink">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink-2">
                    {item.desc}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
