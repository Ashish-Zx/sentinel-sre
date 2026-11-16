/* eslint-disable react/no-unescaped-entities */
import type { Metadata } from "next";
import { PostLayout, DiagramFrame } from "@/components/blog/post-layout";
import { CostRouterDiagram } from "@/components/blog/diagrams";

export const metadata: Metadata = {
  title: "Cost-Aware Model Routing: Cutting Investigation Spend by 65% Without Losing Quality",
  description:
    "How SentinelSRE routes triage and parallel specialist extraction to fast models while reserving frontier reasoning models for synthesis and verification.",
};

export default function FinOpsRoutingPost() {
  return (
    <PostLayout
      tag="04 · FinOps & Telemetry"
      readTime="5 min read"
      title="Cost-Aware Model Routing: Cutting Investigation Spend by 65% Without Losing Quality"
      subtitle="Parallel agents multiply token volume. Here is how our Cost-Aware Router and Postgres llm_traces table keep every incident investigation under $0.03."
      nextPost={{
        href: "/blog/architecture",
        tag: "01 · System Design",
        title: "Why We Built SentinelSRE: Turning a Stack Trace into a Verified Draft PR",
      }}
    >
      <p>
        Running four specialist agents in parallel, a synthesizer, and an isolated verifier means a
        single incident investigation executes <strong>seven or more LLM calls</strong>. If you
        blindly send every step to a frontier reasoning model like{" "}
        <code>claude-3-7-sonnet</code> or <code>gpt-4o</code>, token costs climb fast—even though
        most of those tokens are spent on simple log filtering and structured extraction.
      </p>

      <p>
        In SentinelSRE, we built a dedicated <strong>Cost-Aware Model Router</strong> (
        <code>backend/app/agents/router.py</code>) paired with per-step telemetry in Postgres so
        every node uses only the model tier its task actually requires.
      </p>

      <DiagramFrame title="Interactive FinOps Comparison — Toggle between Cost-Aware Routed and 100% Frontier Baseline">
        <CostRouterDiagram />
      </DiagramFrame>

      <h2>Task-to-Tier Routing: Fast Extraction vs. Deep Reasoning</h2>
      <p>
        Instead of hardcoding one model across the entire graph, every node requests either{" "}
        <code>tier="fast"</code> or <code>tier="reasoning"</code>:
      </p>
      <ul>
        <li>
          <strong>Fast Tier (<code>claude-3-5-haiku</code> / <code>gpt-4o-mini</code>):</strong>{" "}
          Handles the Triage Router and all four parallel specialists (<code>log_agent</code>,{" "}
          <code>git_agent</code>, <code>runbook_agent</code>, <code>security_agent</code>). These
          tasks have narrow, well-defined schemas: extract a file path and line number, filter
          noisy stack frames, inspect a commit diff, or match a path against{" "}
          <code>protected_paths</code>.
        </li>
        <li>
          <strong>Reasoning Tier (<code>claude-3-7-sonnet</code> / <code>gpt-4o</code>):</strong>{" "}
          Reserved strictly for the <strong>Incident Commander Synthesizer</strong> (reconciling
          four independent evidence streams into an exact code patch) and the{" "}
          <strong>L4 Fresh-Context Verifier</strong> (adversarial correctness auditing).
        </li>
      </ul>

      <h2>Auditing Real Savings in Postgres (<code>llm_traces</code>)</h2>
      <p>
        Claiming "we save money with routing" means nothing without numbers. Every call through{" "}
        <code>invoke_routed_llm()</code> measures wall-clock latency with{" "}
        <code>time.perf_counter()</code>, reads exact <code>input_tokens</code> and{" "}
        <code>output_tokens</code> from <code>usage_metadata</code>, and writes two cost figures
        into the <code>llm_traces</code> table:
      </p>
      <ul>
        <li>
          <strong><code>cost_usd</code>:</strong> The actual dollar cost of the routed model used
          for that node.
        </li>
        <li>
          <strong><code>baseline_frontier_cost_usd</code>:</strong> What the exact same token
          count would have cost if routed to the frontier reasoning tier.
        </li>
      </ul>
      <p>
        On our benchmark Incident #992 (<code>500 KeyError: 'discount_code'</code> on{" "}
        <code>POST /api/checkout</code>), total routed spend across all 7 nodes is{" "}
        <strong>$0.0242</strong> versus <strong>$0.0695</strong> unrouted—a{" "}
        <strong>~65% cost reduction</strong> while keeping frontier reasoning intact where code
        correctness is decided.
      </p>

      <h2>Production Cost Guardrails</h2>
      <p>
        Beyond model routing, two additional safeguards protect production budgets: deterministic
        Python <code>ast.parse()</code> checks reject malformed diffs at <code>$0</code> before
        calling the reasoning verifier, and <strong>Upstash Redis</strong> rate-limiting caps
        public demo investigations per user/IP so visitors can explore the live War Room without
        draining API credits.
      </p>

      <blockquote>
        Good FinOps in AI engineering isn't about downgrading quality—it's about refusing to pay
        frontier-reasoning prices for regex-level extraction.
      </blockquote>
    </PostLayout>
  );
}
