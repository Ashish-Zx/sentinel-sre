/* eslint-disable react/no-unescaped-entities */
import type { Metadata } from "next";
import { PostLayout, DiagramFrame } from "@/components/blog/post-layout";
import { WarRoomDiagram } from "@/components/blog/diagrams";

export const metadata: Metadata = {
  title: "The Parallel War Room: 4 Specialists, 3-Tier Memory, and Live SSE",
  description:
    "Why SentinelSRE uses LangGraph Send() to run 4 specialist agents concurrently, how 3-tier Postgres memory works, and how findings stream live over SSE.",
};

export default function WarRoomPost() {
  return (
    <PostLayout
      tag="02 · Multi-Agent & Memory"
      readTime="6 min read"
      title="The Parallel War Room: 4 Specialists, 3-Tier Memory, and Live SSE"
      subtitle="Inside Phase B: how LangGraph Send() eliminates confirmation bias, how Semantic, Episodic, and Procedural memory work together, and how the Split-Screen War Room streams live."
      nextPost={{
        href: "/blog/verifier-hitl",
        tag: "03 · Reliability & Safety",
        title: "Eliminating Hallucinations: Zero-History L4 Verification & Postgres HITL Gates",
      }}
    >
      <p>
        When a production endpoint crashes, a human engineer does not investigate one clue, wait
        ten minutes, and only then look at the next clue. You open logs, Git blame, architecture
        runbooks, and security boundaries at the same time. Serializing those lookups inside one
        giant LLM prompt is both slow and cognitively flawed.
      </p>

      <h2>Why 4 Independent Specialists Instead of One Monolithic Agent</h2>
      <p>
        A single agent looping through 15 tool calls suffers from two failure modes:
      </p>
      <ul>
        <li>
          <strong>Wall-clock latency adds up linearly:</strong> Waiting for log parsing, then GitHub
          API calls, then vector search, then rule checks turns a 3-second investigation into a
          15-second wait.
        </li>
        <li>
          <strong>Confirmation bias ("anchoring"):</strong> If a single agent misreads a noisy log
          line on step 1, that wrong hypothesis pollutes its GitHub search queries on step 2 and its
          runbook lookup on step 3.
        </li>
      </ul>
      <p>
        In SentinelSRE, the <strong>Triage &amp; Router Node</strong> extracts only the core error
        signature (for example, <code>KeyError: 'discount_code'</code> at{" "}
        <code>api/checkout.py:84</code>), loads the workspace's Procedural Rules, and fans out{" "}
        <strong>four independent specialists concurrently</strong> via LangGraph's{" "}
        <code>Send()</code> API. None of the four agents can see what the others are thinking.
      </p>

      <DiagramFrame title="Interactive Parallel War Room — Click Simulate Parallel SSE to watch concurrent execution">
        <WarRoomDiagram />
      </DiagramFrame>

      <h2>What Each Specialist Actually Does</h2>
      <ul>
        <li>
          <strong>2A. Log &amp; StackTrace Specialist:</strong> Reads the pasted stack trace or pulls
          the raw <code>.log</code> dump from Cloudflare R2, strips thousands of lines of healthcheck
          noise, and isolates the exact failing request payload (e.g.{" "}
          <code>&#123;"cart_id": "c_8821", "promo_code": "SAVE20"&#125;</code>).
        </li>
        <li>
          <strong>2B. Git &amp; Codebase Specialist (GitHub MCP):</strong> Connects via our Python{" "}
          <code>mcp</code> SDK client to the <strong>GitHub MCP Server</strong>, calling{" "}
          <code>list_commits</code> and <code>get_file_contents</code>. In our checkout scenario, it
          discovers Commit <code>#9f3a1c2</code> renamed <code>discount_code</code> to{" "}
          <code>promo_code</code> in <code>models/order.py</code> 22 minutes ago without updating{" "}
          <code>api/checkout.py:84</code>.
        </li>
        <li>
          <strong>2C. Runbook &amp; History Specialist (Semantic + Episodic Memory):</strong>{" "}
          Queries <code>semantic_memory_chunks</code> in Neon <code>pgvector</code> and finds Page
          4, Section 4.2 of the uploaded Checkout Runbook PDF: payload readers must accept both{" "}
          <code>promo_code</code> and legacy <code>discount_code</code> for 30 days. It also queries
          past resolved/rejected rows in <code>incidents</code>.
        </li>
        <li>
          <strong>2D. Security &amp; Blast-Radius Specialist:</strong> Cross-checks{" "}
          <code>api/checkout.py</code> against <code>procedural_rules.protected_paths</code> (
          <code>auth/</code>, <code>payments/</code>, <code>migrations/</code>,{" "}
          <code>checkout.py</code>) and flags mandatory human review.
        </li>
      </ul>

      <h2>Why 3-Tier Memory Lives in Postgres</h2>
      <p>
        We intentionally modeled three distinct memory types in Postgres rather than throwing
        everything into one vector bucket:
      </p>
      <ul>
        <li>
          <strong>Semantic Memory (<code>semantic_memory_chunks</code>):</strong> Static domain
          knowledge—PDF runbooks and post-mortems chunked into 600-token blocks with page metadata.
        </li>
        <li>
          <strong>Episodic Memory (<code>incidents</code>):</strong> Time-ordered history of past
          outages, including whether a human engineer <em>approved</em> or <em>rejected</em> the
          AI's previous patch and why.
        </li>
        <li>
          <strong>Procedural Memory (<code>procedural_rules</code>):</strong> Deterministic team
          guardrails—confidence thresholds and protected file paths—that cannot be overridden by
          prompt persuasion.
        </li>
      </ul>

      <h2>Streaming Live Progress Over Authenticated SSE</h2>
      <p>
        An investigation dashboard shouldn't feel like a black-box spinner. FastAPI exposes{" "}
        <code>GET /api/incidents/&#123;id&#125;/stream</code> using{" "}
        <code>StreamingResponse(..., media_type="text/event-stream")</code> over LangGraph's{" "}
        <code>astream_events</code>. On the Next.js frontend, we use{" "}
        <code>@microsoft/fetch-event-source</code> instead of the browser's native{" "}
        <code>EventSource</code> specifically because native <code>EventSource</code> cannot send{" "}
        <code>Authorization: Bearer &lt;clerk_jwt&gt;</code> headers.
      </p>
      <p>
        As each specialist finishes, the Left Panel of the Split-Screen War Room updates in real
        time with the exact model badge, millisecond latency, and USD cost—before the Incident
        Commander Synthesizer reconciles all four structured JSON reports into a unified root-cause
        narrative and patch.
      </p>

      <blockquote>
        Parallelism compresses investigation time to the slowest single branch (~1.8s), while
        structured isolation gives the Synthesizer four uncorrelated sources of truth.
      </blockquote>
    </PostLayout>
  );
}
