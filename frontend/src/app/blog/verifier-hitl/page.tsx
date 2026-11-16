/* eslint-disable react/no-unescaped-entities */
import type { Metadata } from "next";
import { PostLayout, DiagramFrame } from "@/components/blog/post-layout";
import { VerifierHitlDiagram } from "@/components/blog/diagrams";

export const metadata: Metadata = {
  title: "Eliminating Hallucinations: Zero-History L4 Verification & Postgres HITL Gates",
  description:
    "How SentinelSRE combines deterministic Python AST checks, an isolated fresh-context verifier, and LangGraph PostgresSaver interrupt() gates to keep production safe.",
};

export default function VerifierHitlPost() {
  return (
    <PostLayout
      tag="03 · Reliability & Safety"
      readTime="6 min read"
      title="Eliminating Hallucinations: Zero-History L4 Verification & Postgres HITL Gates"
      subtitle="Why multi-agent chains get tunnel vision, how we strip agent chatter before auditing a patch, and why LangGraph checkpoints every sensitive fix in Neon Postgres."
      nextPost={{
        href: "/blog/finops-routing",
        tag: "04 · FinOps & Telemetry",
        title: "Cost-Aware Model Routing: Cutting Investigation Spend by 65% Without Losing Quality",
      }}
    >
      <p>
        The hardest problem in autonomous code remediation is not generating a plausible-looking
        diff—it is <strong>preventing the AI from rationalizing a broken fix</strong>. After four
        specialists and a synthesizer exchange thousands of tokens, the conversation history itself
        becomes a source of bias.
      </p>

      <h2>Why Agents Hallucinate in Multi-Step Pipelines</h2>
      <p>
        If you ask the same LLM session that diagnosed a bug to also grade its own patch, it already
        believes its own narrative. It overlooks an undefined variable, misses a syntax error, or
        ignores a constraint from the runbook because its context window is saturated with
        justifications.
      </p>
      <p>
        Our solution is a two-layer defense: a <strong>deterministic code validator</strong> paired
        with an <strong>L4 Fresh-Context Verifier</strong>, followed by a{" "}
        <strong>durable Human-in-the-Loop (HITL) escalation gate</strong>.
      </p>

      <DiagramFrame title="Interactive Verification & Escalation Simulator — Toggle scenarios to see how the gate behaves">
        <VerifierHitlDiagram />
      </DiagramFrame>

      <h2>Layer 1: Deterministic Checks at $0 LLM Cost</h2>
      <p>
        Before invoking any reasoning model to audit a proposed fix, <code>verifier_node</code> runs
        fast deterministic checks in Python:
      </p>
      <ul>
        <li>
          <strong>Non-empty Unified Diff:</strong> Computes{" "}
          <code>difflib.unified_diff(original_lines, patched_lines)</code> and verifies the patch
          actually modifies the target file.
        </li>
        <li>
          <strong>Python AST Syntax Validation:</strong> For <code>.py</code> files, runs{" "}
          <code>ast.parse(patched_file_content)</code>. If a syntax error exists, the verifier
          immediately returns <code>is_valid=False</code> and <code>confidence_score=0</code> with
          the exact <code>SyntaxError</code> line—routing back to the Synthesizer without burning
          frontier tokens.
        </li>
      </ul>

      <h2>Layer 2: The Zero-History L4 Fresh-Context Verifier</h2>
      <p>
        Once deterministic checks pass, SentinelSRE spawns an isolated verifier prompt. Crucially,{" "}
        <strong>
          we strip <code>specialist_findings</code> and <code>root_cause_report</code> completely
        </strong>
        . The verifier sees only four raw artifacts:
      </p>
      <ul>
        <li>The raw runtime stack trace from Sentry/Railway/Vercel.</li>
        <li>The raw target file contents fetched directly from GitHub.</li>
        <li>The proposed unified Git diff.</li>
        <li>The workspace's <code>procedural_rules</code>.</li>
      </ul>
      <p>
        Acting like a strict senior reviewer with zero prior bias, it outputs a structured{" "}
        <code>VerifierOutput(is_valid, confidence_score, critique)</code>. If{" "}
        <code>is_valid</code> is false and <code>retry_count &lt; 2</code>, LangGraph loops back
        to the Synthesizer with the verifier's exact critique so it can self-correct before a human
        ever sees it.
      </p>

      <h2>Layer 3: Durable HITL Checkpointing with PostgresSaver &amp; interrupt()</h2>
      <p>
        Verification proves a patch is syntactically sound and addresses the stack trace—but{" "}
        <strong>verification is not authorization</strong>. Whenever{" "}
        <code>confidence_score &lt; min_confidence_threshold</code> (default 85%) or the target
        file matches <code>protected_paths</code> (such as <code>api/checkout.py</code>,{" "}
        <code>payments/</code>, <code>auth/</code>, or <code>migrations/</code>), the{" "}
        <code>escalation_gate_node</code> calls LangGraph's <code>interrupt()</code>.
      </p>
      <p>
        Because the graph is compiled with <code>AsyncPostgresSaver</code> backed by Neon Postgres,
        pausing at <code>interrupt()</code> freezes the entire <code>IncidentState</code> snapshot
        under <code>thread_id = incident.id</code>. Even if the FastAPI container restarts or scales
        down, the paused investigation survives intact.
      </p>
      <p>
        In the Split-Screen War Room, the engineer inspects the side-by-side diff, the citations,
        and the verifier's confidence meter. Clicking{" "}
        <strong>Approve &amp; Open Hotfix Draft PR</strong> calls{" "}
        <code>POST /api/incidents/&#123;id&#125;/decision</code>, resumes the exact Postgres
        checkpoint via <code>Command(resume=...)</code>, invokes the <strong>GitHub MCP</strong>{" "}
        and <strong>Slack MCP</strong> servers to open a <strong>draft PR</strong> (never mutating{" "}
        <code>main</code> directly), and saves the decision into Episodic Memory.
      </p>

      <blockquote>
        Software verifies correctness; humans authorize production impact. And if an engineer
        rejects a patch with feedback, Episodic Memory ensures SentinelSRE doesn't make the same
        mistake twice.
      </blockquote>
    </PostLayout>
  );
}
