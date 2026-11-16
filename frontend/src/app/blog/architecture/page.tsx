/* eslint-disable react/no-unescaped-entities */
import type { Metadata } from "next";
import { PostLayout, DiagramFrame } from "@/components/blog/post-layout";
import { ArchitectureDiagram } from "@/components/blog/diagrams";

export const metadata: Metadata = {
  title: "Why We Built SentinelSRE: Turning a Stack Trace into a Verified Draft PR",
  description:
    "The end-to-end architecture of SentinelSRE: why we pivoted from generic PR reviewers, how we bridge runtime errors with GitHub code, and how Phase A & Phase B fit together.",
};

export default function ArchitecturePost() {
  return (
    <PostLayout
      tag="01 · System Design"
      readTime="7 min read"
      title="Why We Built SentinelSRE: Turning a Stack Trace into a Verified Draft PR"
      subtitle="How we connected runtime production errors, Cloudflare R2 object storage, Neon pgvector memory, parallel LangGraph agents, and MCP into a single auditable pipeline."
      nextPost={{
        href: "/blog/war-room",
        tag: "02 · Multi-Agent & Memory",
        title: "The Parallel War Room: 4 Specialists, 3-Tier Memory, and Live SSE",
      }}
    >
      <p>
        Imagine an e-commerce team deploys a routine refactor on Friday afternoon. Minutes later,{" "}
        <code>POST /api/checkout</code> starts failing with{" "}
        <code>500 KeyError: 'discount_code'</code>. In most engineering orgs, a senior engineer has
        to wake up, pull server logs from Railway or Vercel, inspect recent GitHub commits, search
        PDF architecture runbooks, check past post-mortems, write a patch, open a PR, and update
        Slack. That takes <strong>~2 hours</strong> of context switching.
      </p>

      <p>
        <strong>SentinelSRE</strong> compresses that investigation to roughly{" "}
        <strong>20 seconds</strong>: it investigates logs, Git history, runbooks, and safety rules
        in parallel, audits its own fix in an isolated verifier, pauses for human approval, and
        opens a draft pull request automatically.
      </p>

      <h2>Why Incident Response (and Not Another AI PR Reviewer)</h2>
      <p>
        When we designed this project, the easiest trap to fall into was building another generic
        "AI PR Review Agent." Every tutorial covers that, and half the components in a modern
        full-stack AI architecture—like Cloud Object Storage and multi-tier operational memory—feel
        bolted on for a simple diff reviewer.
      </p>
      <p>
        By applying the same multi-agent systems architecture to{" "}
        <strong>autonomous production incident engineering</strong>, every layer becomes
        genuinely necessary:
      </p>
      <ul>
        <li>
          <strong>Cloudflare R2 Presigned URLs</strong> are required because production{" "}
          <code>.log</code> dumps and architecture PDF runbooks can easily hit tens of megabytes.
        </li>
        <li>
          <strong>3-Tier Postgres + pgvector Memory</strong> is required because incident triage
          depends on architecture docs (Semantic), past outages (Episodic), and deployment safety
          rules (Procedural).
        </li>
        <li>
          <strong>Human-in-the-Loop (HITL) Checkpointing</strong> is required because no sane
          engineering team lets an LLM silently push unreviewed patches to <code>/payments</code> or{" "}
          <code>/auth</code>.
        </li>
      </ul>

      <DiagramFrame title="Interactive System Map — Click any stage in SentinelSRE to inspect how it works">
        <ArchitectureDiagram />
      </DiagramFrame>

      <h2>The Practical Runtime Reality: GitHub Alone Doesn't Know Production Broke</h2>
      <p>
        One of the most important design decisions we made early was acknowledging a simple truth:{" "}
        <strong>if you push code and production crashes, GitHub cannot tell you it broke.</strong>{" "}
        GitHub knows about your source code; your runtime platform (Railway, Render, Vercel,
        Docker) or error tracker (Sentry) knows about the exception.
      </p>
      <p>
        Instead of pretending there is a magical "get all production logs" button, we designed the
        MVP around an explicit, testable workflow:
      </p>
      <ul>
        <li>
          An engineer copies a sanitized stack trace from Sentry, Railway, or Vercel (stripping
          secrets and PII), selects the GitHub repo and deployed commit SHA, and optionally attaches
          a <code>.log</code> file.
        </li>
        <li>
          SentinelSRE compares the runtime error against the{" "}
          <strong>exact deployed code version</strong>, runs the investigation, and pauses at an
          approval gate before opening a <strong>draft pull request</strong>.
        </li>
        <li>
          Automated Sentry webhooks sit cleanly on top of this exact pipeline once the core manual
          loop is verified end-to-end.
        </li>
      </ul>

      <h2>Two Separate Flows: Phase A vs. Phase B</h2>
      <p>
        To keep the codebase clean and predictable, SentinelSRE separates{" "}
        <strong>setup and ingestion</strong> from <strong>live incident investigation</strong>:
      </p>

      <h3>Phase A: Auth, Direct R2 Uploads, and 3-Tier Memory</h3>
      <p>
        Authentication runs through <strong>Clerk</strong> on Next.js 16. Every request to our
        FastAPI backend carries a short-lived RS256 JWT (<code>Authorization: Bearer ...</code>),
        which FastAPI validates directly against Clerk's JWKS endpoint to extract{" "}
        <code>clerk_user_id</code> and enforce tenant isolation across all queries.
      </p>
      <p>
        When uploading a 50MB <code>.log</code> dump or an architecture PDF runbook, streaming the
        file through Next.js → FastAPI → Object Storage would spike backend RAM and risk OOM
        crashes. Instead, FastAPI generates a 60-second <strong>Cloudflare R2 Presigned PUT URL</strong>{" "}
        via <code>boto3</code> (S3 v4 signature), and the browser uploads bytes{" "}
        <strong>directly to R2</strong>. Only after the <code>PUT</code> succeeds does FastAPI kick
        off background chunking (600-token windows via <code>pymupdf</code>) and{" "}
        <code>VECTOR(1536)</code> embedding into Neon Postgres.
      </p>

      <h3>One Postgres Database, Six Canonical Tables</h3>
      <p>
        Rather than splitting state across separate vector databases, SQL stores, and checkpoint
        services, we consolidated everything into a single Neon Postgres instance with{" "}
        <code>pgvector</code>:
      </p>
      <ul>
        <li>
          <code>workspaces</code> — Multi-tenant workspace mapping synced with{" "}
          <code>clerk_user_id</code>, repo URLs, and Slack channel IDs.
        </li>
        <li>
          <code>knowledge_files</code> — Tracks uploaded R2 keys and ingestion status (
          <code>pending</code> → <code>processing</code> → <code>indexed</code>).
        </li>
        <li>
          <code>semantic_memory_chunks</code> — Tier 1 Semantic Memory storing{" "}
          <code>VECTOR(1536)</code> embeddings and page/section JSONB metadata.
        </li>
        <li>
          <code>procedural_rules</code> — Tier 2 Procedural Memory storing{" "}
          <code>min_confidence_threshold</code> (default 85%) and <code>protected_paths</code>.
        </li>
        <li>
          <code>incidents</code> — Tier 3 Episodic Memory (also doubling as the LangGraph{" "}
          <code>thread_id</code>) storing root-cause reports, diffs, human feedback, and PR URLs.
        </li>
        <li>
          <code>llm_traces</code> — FinOps telemetry logging model, tokens, latency, and USD cost
          per agent node.
        </li>
      </ul>

      <blockquote>
        Every architectural choice in SentinelSRE—presigned uploads, isolated Postgres tenants,
        parallel agents, and draft-only PRs—exists to make autonomous debugging safe enough for real
        production teams.
      </blockquote>
    </PostLayout>
  );
}
