import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, PlayCircle } from "lucide-react";

export const metadata: Metadata = {
  title: "Engineering Blog — SentinelSRE",
  description:
    "Deep dives into what we built in SentinelSRE and why: decoupled Clerk auth, Cloudflare R2 presigned uploads, 3-tier pgvector memory, parallel LangGraph specialists, L4 verification, and FinOps model routing.",
};

const POSTS = [
  {
    href: "/blog/architecture",
    tag: "01 · System Design",
    title: "Why We Built SentinelSRE: Turning a Stack Trace into a Verified Draft PR",
    excerpt:
      "Why we pivoted away from generic AI PR reviewers, how we solved the GitHub-vs-runtime-error gap, and why we split the system into Phase A (Clerk + R2 Presigned URLs + 6-table Neon Postgres) and Phase B (Live LangGraph investigation).",
    readTime: "7 min read",
  },
  {
    href: "/blog/war-room",
    tag: "02 · Multi-Agent & Memory",
    title: "The Parallel War Room: 4 Specialists, 3-Tier Memory, and Live SSE",
    excerpt:
      "How LangGraph Send() runs Log, Git MCP, Runbook/Episodic Memory, and Security agents concurrently—eliminating confirmation bias and streaming every finding live over authenticated Server-Sent Events.",
    readTime: "6 min read",
  },
  {
    href: "/blog/verifier-hitl",
    tag: "03 · Reliability & Safety",
    title: "Eliminating Hallucinations: Zero-History L4 Verification & Postgres HITL Gates",
    excerpt:
      "Why multi-agent pipelines get tunnel vision, how Python ast.parse() + an isolated fresh-context verifier catches bad diffs, and how PostgresSaver + interrupt() pauses execution on /payments and /checkout routes.",
    readTime: "6 min read",
  },
  {
    href: "/blog/finops-routing",
    tag: "04 · FinOps & Telemetry",
    title: "Cost-Aware Model Routing: Cutting Investigation Spend by 65% Without Losing Quality",
    excerpt:
      "Routing triage and parallel extraction to Haiku while reserving Sonnet for synthesis and verification—with every token, millisecond, and dollar audited in Postgres llm_traces.",
    readTime: "5 min read",
  },
];

export default function BlogIndexPage() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-12 sm:py-16">
      <header className="max-w-2xl">
        <div className="flex items-center gap-3">
          <span className="badge badge-live font-mono text-[10px] uppercase tracking-wider">
            Engineering Blog · What We Built &amp; Why
          </span>
        </div>
        <h1 className="mt-4 text-3xl font-bold tracking-tight text-ink sm:text-4xl">
          Inside SentinelSRE
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-2">
          A four-part engineering breakdown of the exact architecture, database schema,
          verification invariants, and cost-routing decisions behind SentinelSRE—from
          a Friday afternoon <code className="rounded bg-signal-dim px-1.5 py-0.5 font-mono text-xs text-signal">500 KeyError</code> to a human-approved draft PR.
        </p>
      </header>

      <div className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-2">
        {POSTS.map((post) => (
          <Link
            key={post.href}
            href={post.href}
            className="group panel panel-hover flex flex-col p-6"
          >
            <div className="flex items-center justify-between">
              <span className="badge badge-neutral font-mono text-[10px] uppercase tracking-wider">
                {post.tag}
              </span>
              <span className="font-mono text-[11px] text-ink-3">{post.readTime}</span>
            </div>
            <h2 className="mt-4 text-lg font-semibold leading-snug text-ink group-hover:text-signal transition-colors">
              {post.title}
            </h2>
            <p className="mt-2.5 flex-1 text-sm leading-relaxed text-ink-2">
              {post.excerpt}
            </p>
            <span className="mt-5 inline-flex items-center gap-1.5 text-xs font-medium text-signal">
              Read engineering deep-dive
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </span>
          </Link>
        ))}
      </div>

      <div className="mt-10 panel flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-sm font-semibold text-ink">
            Want to inspect the live incident flow first?
          </div>
          <p className="mt-1 text-xs text-ink-2">
            Launch Incident #992 (<code className="font-mono text-signal">KeyError: &apos;discount_code&apos;</code> on <code className="font-mono text-signal">POST /api/checkout</code>) in the Split-Screen War Room.
          </p>
        </div>
        <Link
          href="/dashboard/incidents/demo-inc-992"
          className="btn btn-primary px-4 py-2.5 text-xs shrink-0"
        >
          <PlayCircle className="h-3.5 w-3.5" />
          Try 1-Click Demo Incident
        </Link>
      </div>
    </div>
  );
}
