"use client";

import { useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  CheckCircle2,
  Cpu,
  Database,
  DollarSign,
  FileCode2,
  GitBranch,
  GitPullRequest,
  Lock,
  Play,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Terminal,
} from "lucide-react";

/* ============================================================
   1. Flexible Interactive System Architecture Diagram
   ============================================================ */

type ArchNodeId =
  | "ingest"
  | "storage"
  | "triage"
  | "specialists"
  | "synthesizer"
  | "verifier"
  | "hitl"
  | "mcp";

const ARCH_DETAILS: Record<
  ArchNodeId,
  { title: string; badge: string; detail: string; tech: string }
> = {
  ingest: {
    title: "Runtime Error Ingest + Clerk Auth",
    badge: "Next.js 16 + Clerk JWKS",
    detail:
      "GitHub knows your code, not your runtime crashes. Engineers paste a sanitized Sentry/Railway/Vercel stack trace alongside the repo URL and deployed commit SHA—or attach a .log file. Clerk JWTs isolate every workspace by clerk_user_id.",
    tech: "POST /api/incidents/start · Bearer RS256 JWT",
  },
  storage: {
    title: "Direct-to-R2 Presigned Storage",
    badge: "Cloudflare R2 (S3 v4)",
    detail:
      "Large .log dumps and PDF architecture runbooks never pass through FastAPI RAM. The browser requests a 60-second Presigned PUT URL, uploads directly to Cloudflare R2, and notifies FastAPI to index chunks in the background.",
    tech: "POST /api/storage/presign · Zero FastAPI Memory Spike",
  },
  triage: {
    title: "Triage & Cost-Aware Router",
    badge: "Fast Tier (Haiku / Mini)",
    detail:
      "Extracts the exception signature (e.g. KeyError: 'discount_code' at api/checkout.py:84), loads Procedural Memory rules from Postgres, and fans out 4 specialist agents concurrently using LangGraph Send().",
    tech: "triage_router_node · ~$0.0008 per run",
  },
  specialists: {
    title: "4 Parallel Specialist Agents",
    badge: "LangGraph Send() Fan-Out",
    detail:
      "Log Investigator, Git Historian (MCP), Runbook & Episodic Memory Agent (pgvector + SQL), and Security Agent run simultaneously without seeing each other's reasoning—cutting wall-clock latency and preventing confirmation bias.",
    tech: "4 concurrent branches · Structured Pydantic outputs",
  },
  synthesizer: {
    title: "Incident Commander Synthesizer",
    badge: "Reasoning Tier (Sonnet / GPT-4o)",
    detail:
      "Reconciles the 4 independent findings into a cited Root Cause Analysis report and generates a complete patched file + unified Git diff.",
    tech: "synthesizer_node · difflib.unified_diff",
  },
  verifier: {
    title: "L4 Fresh-Context Verifier",
    badge: "Anti-Hallucination Shield",
    detail:
      "Runs in a brand-new empty prompt context with zero specialist chatter. Combines Python ast.parse() syntax validation with an isolated audit against the raw stack trace, raw GitHub file, and proposed diff (max 2 retries).",
    tech: "verifier_node · AST + Isolated LLM Audit",
  },
  hitl: {
    title: "Checkpointed HITL Escalation Gate",
    badge: "PostgresSaver + interrupt()",
    detail:
      "If confidence < 85% or the patch touches a protected path (auth/, payments/, migrations/, checkout.py), LangGraph calls interrupt() and persists the exact state in Neon Postgres—surviving server restarts until an engineer approves or rejects.",
    tech: "POST /api/incidents/{id}/decision · Durable Pause",
  },
  mcp: {
    title: "MCP Execution & Episodic Save",
    badge: "GitHub MCP + Slack MCP",
    detail:
      "Only after human approval does the Action Node invoke GitHub MCP (create_branch, create_or_update_file, create_pull_request as draft) and Slack MCP (#eng-incidents), then records the outcome in Episodic Memory.",
    tech: "Model Context Protocol · Draft PR Only",
  },
};

export function ArchitectureDiagram() {
  const [selected, setSelected] = useState<ArchNodeId>("specialists");
  const info = ARCH_DETAILS[selected];

  const cardClass = (id: ArchNodeId, accent = false) =>
    `w-full text-left rounded-xl border p-3.5 transition-all cursor-pointer ${
      selected === id
        ? "border-signal bg-signal-dim/60 shadow-sm ring-2 ring-signal/20"
        : accent
          ? "border-amber-300 bg-amber-50/60 hover:border-amber-400"
          : "border-edge bg-surface-1 hover:border-edge-strong"
    }`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-ink-3">
        <span className="font-mono uppercase tracking-wider text-[10px]">
          Interactive System Map — Click any stage to inspect implementation details
        </span>
        <span className="badge badge-live font-mono text-[10px]">
          Phase A + Phase B
        </span>
      </div>

      {/* Responsive Flexible Flow */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-12 items-stretch">
        {/* Column 1: Ingest & Storage */}
        <div className="lg:col-span-3 flex flex-col gap-3 justify-center">
          <button
            type="button"
            onClick={() => setSelected("ingest")}
            className={cardClass("ingest")}
          >
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] font-semibold uppercase text-signal">
                1. Ingest
              </span>
              <Terminal className="h-3.5 w-3.5 text-signal" />
            </div>
            <div className="mt-1 text-xs font-semibold text-ink">
              Stack Trace + Commit SHA
            </div>
            <div className="mt-0.5 text-[11px] text-ink-3">
              Sentry · Railway · Vercel
            </div>
          </button>

          <button
            type="button"
            onClick={() => setSelected("storage")}
            className={cardClass("storage")}
          >
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] font-semibold uppercase text-ink-3">
                Phase A
              </span>
              <Database className="h-3.5 w-3.5 text-ink-2" />
            </div>
            <div className="mt-1 text-xs font-semibold text-ink">
              R2 Presigned + pgvector
            </div>
            <div className="mt-0.5 text-[11px] text-ink-3">
              PDF Runbooks &amp; .log dumps
            </div>
          </button>
        </div>

        {/* Connector */}
        <div className="hidden lg:flex lg:col-span-1 items-center justify-center text-signal">
          <ArrowRight className="h-5 w-5" />
        </div>
        <div className="flex lg:hidden justify-center text-signal">
          <ArrowDown className="h-4 w-4" />
        </div>

        {/* Column 2: Triage + 4 Parallel Specialists */}
        <div className="lg:col-span-4 flex flex-col gap-3 justify-center">
          <button
            type="button"
            onClick={() => setSelected("triage")}
            className={cardClass("triage")}
          >
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] font-semibold uppercase text-signal">
                2. Triage Router
              </span>
              <span className="badge badge-live font-mono text-[9px]">
                Haiku / Mini
              </span>
            </div>
            <div className="mt-1 text-xs font-semibold text-ink">
              Extract Signature + Load Rules
            </div>
          </button>

          <button
            type="button"
            onClick={() => setSelected("specialists")}
            className={cardClass("specialists")}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-mono text-[10px] font-semibold uppercase text-signal">
                3. Parallel Fan-Out (Send)
              </span>
              <span className="font-mono text-[10px] text-ink-3">x4 Concurrent</span>
            </div>
            <div className="grid grid-cols-2 gap-1.5 text-[11px]">
              <div className="rounded-lg border border-edge bg-surface-2 px-2 py-1.5 font-medium text-ink">
                Log Investigator
              </div>
              <div className="rounded-lg border border-edge bg-surface-2 px-2 py-1.5 font-medium text-ink">
                Git Historian (MCP)
              </div>
              <div className="rounded-lg border border-edge bg-surface-2 px-2 py-1.5 font-medium text-ink">
                Runbook &amp; Memory
              </div>
              <div className="rounded-lg border border-edge bg-surface-2 px-2 py-1.5 font-medium text-ink">
                Security &amp; Rules
              </div>
            </div>
          </button>
        </div>

        {/* Connector */}
        <div className="hidden lg:flex lg:col-span-1 items-center justify-center text-signal">
          <ArrowRight className="h-5 w-5" />
        </div>
        <div className="flex lg:hidden justify-center text-signal">
          <ArrowDown className="h-4 w-4" />
        </div>

        {/* Column 3: Synthesis -> Verifier -> HITL -> MCP */}
        <div className="lg:col-span-3 flex flex-col gap-2.5 justify-center">
          <button
            type="button"
            onClick={() => setSelected("synthesizer")}
            className={cardClass("synthesizer")}
          >
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] font-semibold uppercase text-violet-700">
                4. Synthesizer
              </span>
              <Sparkles className="h-3.5 w-3.5 text-violet-700" />
            </div>
            <div className="mt-0.5 text-xs font-semibold text-ink">
              RCA + Unified Diff
            </div>
          </button>

          <button
            type="button"
            onClick={() => setSelected("verifier")}
            className={cardClass("verifier")}
          >
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] font-semibold uppercase text-signal">
                5. L4 Verifier
              </span>
              <ShieldCheck className="h-3.5 w-3.5 text-signal" />
            </div>
            <div className="mt-0.5 text-xs font-semibold text-ink">
              Zero-History + AST
            </div>
          </button>

          <button
            type="button"
            onClick={() => setSelected("hitl")}
            className={cardClass("hitl", true)}
          >
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] font-semibold uppercase text-amber-800">
                6. HITL Gate
              </span>
              <Lock className="h-3.5 w-3.5 text-amber-800" />
            </div>
            <div className="mt-0.5 text-xs font-semibold text-amber-950">
              interrupt() in Postgres
            </div>
          </button>

          <button
            type="button"
            onClick={() => setSelected("mcp")}
            className={cardClass("mcp")}
          >
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] font-semibold uppercase text-signal">
                7. MCP Action
              </span>
              <GitPullRequest className="h-3.5 w-3.5 text-signal" />
            </div>
            <div className="mt-0.5 text-xs font-semibold text-ink">
              Draft PR + Slack Alert
            </div>
          </button>
        </div>
      </div>

      {/* Selected Node Inspector */}
      <div className="rounded-xl border border-signal-edge bg-surface-1 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-ink">{info.title}</span>
            <span className="badge badge-live font-mono text-[10px]">
              {info.badge}
            </span>
          </div>
          <code className="font-mono text-[11px] text-signal bg-signal-dim px-2 py-0.5 rounded">
            {info.tech}
          </code>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-ink-2">{info.detail}</p>
      </div>
    </div>
  );
}

/* ============================================================
   2. Flexible Interactive Parallel War Room & SSE Diagram
   ============================================================ */

interface SpecialistSim {
  id: string;
  name: string;
  source: string;
  ms: number;
  cost: string;
  finding: string;
}

const SPECIALISTS: SpecialistSim[] = [
  {
    id: "log",
    name: "Log Investigator",
    source: "R2 .log / Stack Trace",
    ms: 1420,
    cost: "$0.0024",
    finding:
      "Isolated 142 HTTP 500 crashes on POST /api/checkout; payload sends 'promo_code' while line 84 reads 'discount_code'.",
  },
  {
    id: "git",
    name: "Git Historian",
    source: "GitHub MCP (commits + file)",
    ms: 1790,
    cost: "$0.0025",
    finding:
      "Commit #9f3a1c2 (22m ago) renamed discount_code → promo_code in models/order.py but missed api/checkout.py.",
  },
  {
    id: "memory",
    name: "Runbook & Episodic Agent",
    source: "pgvector + incidents SQL",
    ms: 1310,
    cost: "$0.0020",
    finding:
      "Checkout Runbook PDF §4.2 (0.91 cosine match): keep 30-day fallback for legacy 'discount_code' keys.",
  },
  {
    id: "security",
    name: "Security & Rules Agent",
    source: "procedural_rules JSONB",
    ms: 1120,
    cost: "$0.0014",
    finding:
      "Flagged api/checkout.py against protected path rule (/payments & checkout routes require HITL approval).",
  },
];

export function WarRoomDiagram() {
  const [tick, setTick] = useState<number>(3);
  const [animating, setAnimating] = useState(false);

  function replayParallelRun() {
    if (animating) return;
    setAnimating(true);
    setTick(0);
    setTimeout(() => setTick(1), 400);
    setTimeout(() => setTick(2), 950);
    setTimeout(() => {
      setTick(3);
      setAnimating(false);
    }, 1500);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-xs font-semibold text-ink">
            Parallel LangGraph Fan-Out vs Serial Execution
          </div>
          <div className="text-[11px] text-ink-3">
            Wall-clock time: <strong className="text-signal">1.79s parallel</strong> (slowest branch) vs{" "}
            <span className="line-through">5.64s serial</span>
          </div>
        </div>
        <button
          type="button"
          onClick={replayParallelRun}
          disabled={animating}
          className="btn btn-secondary px-3 py-1.5 text-xs"
        >
          {animating ? (
            <>
              <RotateCcw className="h-3.5 w-3.5 animate-spin" />
              Streaming SSE...
            </>
          ) : (
            <>
              <Play className="h-3.5 w-3.5 text-signal" />
              Simulate Parallel SSE
            </>
          )}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {SPECIALISTS.map((sp) => {
          const done =
            tick >= 3 ||
            (tick === 2 && sp.ms <= 1450) ||
            (tick === 1 && sp.ms <= 1150);
          const running = !done && tick >= 1;

          return (
            <div
              key={sp.id}
              className={`rounded-xl border p-3.5 transition-all ${
                done
                  ? "border-signal-edge bg-surface-1"
                  : running
                    ? "border-amber-300 bg-amber-50/50"
                    : "border-edge bg-surface-2/60 opacity-65"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-ink">{sp.name}</span>
                <span
                  className={`badge font-mono text-[10px] ${
                    done
                      ? "badge-live"
                      : running
                        ? "badge-warn"
                        : "badge-neutral"
                  }`}
                >
                  {done ? `${sp.ms}ms · ${sp.cost}` : running ? "running SSE" : "queued"}
                </span>
              </div>
              <div className="mt-1 font-mono text-[10px] text-ink-3">
                Source: {sp.source}
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-ink-2">
                {done ? sp.finding : "Waiting for specialist completion event..."}
              </p>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-edge bg-surface-2 px-4 py-2.5 text-xs">
        <span className="flex items-center gap-2 font-medium text-ink">
          <Activity className="h-3.5 w-3.5 text-signal" />
          SSE Stream (`GET /api/incidents/&#123;id&#125;/stream`)
        </span>
        <span className="font-mono text-[11px] text-ink-3">
          Events: <code className="text-signal">agent_started</code> →{" "}
          <code className="text-signal">agent_completed</code> →{" "}
          <code className="text-signal">hitl_paused</code>
        </span>
      </div>
    </div>
  );
}

/* ============================================================
   3. Flexible Interactive L4 Verifier + HITL Gate Diagram
   ============================================================ */

export function VerifierHitlDiagram() {
  const [scenario, setScenario] = useState<"protected" | "syntax_fail" | "auto_pass">(
    "protected"
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-semibold text-ink">
          Interactive Verification &amp; Escalation Simulator
        </span>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setScenario("protected")}
            className={`rounded-lg px-2.5 py-1 text-[11px] font-medium border transition cursor-pointer ${
              scenario === "protected"
                ? "border-amber-400 bg-amber-50 text-amber-900"
                : "border-edge bg-surface-1 text-ink-2 hover:text-ink"
            }`}
          >
            Protected Path (checkout.py)
          </button>
          <button
            type="button"
            onClick={() => setScenario("syntax_fail")}
            className={`rounded-lg px-2.5 py-1 text-[11px] font-medium border transition cursor-pointer ${
              scenario === "syntax_fail"
                ? "border-red-300 bg-red-50 text-red-900"
                : "border-edge bg-surface-1 text-ink-2 hover:text-ink"
            }`}
          >
            AST Syntax Failure (Retry)
          </button>
          <button
            type="button"
            onClick={() => setScenario("auto_pass")}
            className={`rounded-lg px-2.5 py-1 text-[11px] font-medium border transition cursor-pointer ${
              scenario === "auto_pass"
                ? "border-signal-edge bg-signal-dim text-signal"
                : "border-edge bg-surface-1 text-ink-2 hover:text-ink"
            }`}
          >
            High Confidence (94%)
          </button>
        </div>
      </div>

      {/* 3-Stage Responsive Pipeline */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {/* Stage 1: Fresh Context Input */}
        <div className="rounded-xl border border-edge bg-surface-1 p-4 space-y-2">
          <div className="font-mono text-[10px] uppercase tracking-wider text-signal font-semibold">
            1. Isolated Inputs Only
          </div>
          <div className="space-y-1.5 text-[11px]">
            <div className="flex items-center gap-1.5 text-ink">
              <CheckCircle2 className="h-3.5 w-3.5 text-signal shrink-0" />
              Raw stack trace snippet
            </div>
            <div className="flex items-center gap-1.5 text-ink">
              <CheckCircle2 className="h-3.5 w-3.5 text-signal shrink-0" />
              Raw GitHub file (`api/checkout.py`)
            </div>
            <div className="flex items-center gap-1.5 text-ink">
              <CheckCircle2 className="h-3.5 w-3.5 text-signal shrink-0" />
              Proposed Unified Diff + Rules
            </div>
            <div className="pt-1 border-t border-edge text-[10px] text-ink-3 font-mono">
              STRIPPED: specialist_findings, root_cause_report
            </div>
          </div>
        </div>

        {/* Stage 2: Deterministic + LLM Audit */}
        <div className="rounded-xl border border-edge bg-surface-1 p-4 space-y-2">
          <div className="font-mono text-[10px] uppercase tracking-wider text-violet-700 font-semibold">
            2. AST + Fresh-Context Audit
          </div>
          {scenario === "syntax_fail" ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-2.5 text-[11px] text-red-900 space-y-1">
              <div className="font-semibold flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5" />
                ast.parse() raised SyntaxError
              </div>
              <p className="text-[10px]">
                Caught deterministically at $0 LLM cost. Confidence = 0%. Loops back to Synthesizer (retry_count &lt; 2).
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-ink-2">AST Parse Check</span>
                <span className="badge badge-live font-mono text-[10px]">PASS</span>
              </div>
              <div>
                <div className="flex justify-between text-[11px] font-mono mb-1">
                  <span className="text-ink-3">Verifier Confidence</span>
                  <span className="font-semibold text-signal">94% / 85% min</span>
                </div>
                <div className="h-2 w-full rounded-full bg-surface-3 overflow-hidden">
                  <div className="h-full bg-signal rounded-full" style={{ width: "94%" }} />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Stage 3: Escalation Decision */}
        <div
          className={`rounded-xl border p-4 space-y-2 ${
            scenario === "protected"
              ? "border-amber-300 bg-amber-50/70"
              : scenario === "syntax_fail"
                ? "border-red-200 bg-red-50/60"
                : "border-signal-edge bg-signal-dim/50"
          }`}
        >
          <div className="font-mono text-[10px] uppercase tracking-wider font-semibold text-ink">
            3. Policy Gate Outcome
          </div>
          {scenario === "protected" && (
            <>
              <div className="text-xs font-semibold text-amber-950 flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5 text-amber-800" />
                interrupt() → PostgresSaver
              </div>
              <p className="text-[11px] text-amber-900 leading-relaxed">
                Even at 94% confidence, <code>api/checkout.py</code> matches <code>protected_paths</code>. Graph freezes until human clicks Approve.
              </p>
            </>
          )}
          {scenario === "syntax_fail" && (
            <>
              <div className="text-xs font-semibold text-red-950 flex items-center gap-1.5">
                <RotateCcw className="h-3.5 w-3.5 text-red-700" />
                Route Back to Synthesizer
              </div>
              <p className="text-[11px] text-red-900 leading-relaxed">
                Invalid diff never reaches the engineer. Critique is injected into Synthesizer for self-correction.
              </p>
            </>
          )}
          {scenario === "auto_pass" && (
            <>
              <div className="text-xs font-semibold text-signal flex items-center gap-1.5">
                <GitBranch className="h-3.5 w-3.5" />
                Ready for Draft PR via MCP
              </div>
              <p className="text-[11px] text-ink-2 leading-relaxed">
                Non-protected path + 94% confidence clears the gate cleanly. Creates a Draft PR—never merges to <code>main</code> silently.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   4. Flexible Interactive Cost-Aware Model Routing Diagram
   ============================================================ */

const ROUTING_ROWS = [
  {
    agent: "Triage & Router",
    tier: "fast" as const,
    model: "claude-3-5-haiku",
    routedCost: 0.0008,
    baselineCost: 0.0038,
    ms: 680,
    why: "Regex/JSON extraction of file, line & exception",
  },
  {
    agent: "Log Investigator",
    tier: "fast" as const,
    model: "claude-3-5-haiku",
    routedCost: 0.0024,
    baselineCost: 0.0110,
    ms: 1420,
    why: "Filter noisy stack frames & isolate JSON payload",
  },
  {
    agent: "Git Historian (MCP)",
    tier: "fast" as const,
    model: "claude-3-5-haiku",
    routedCost: 0.0025,
    baselineCost: 0.0118,
    ms: 1790,
    why: "Inspect recent commits & fetch target file",
  },
  {
    agent: "Runbook & Memory",
    tier: "fast" as const,
    model: "claude-3-5-haiku",
    routedCost: 0.0020,
    baselineCost: 0.0097,
    ms: 1310,
    why: "Summarize top-k pgvector chunks & SQL history",
  },
  {
    agent: "Security & Rules",
    tier: "fast" as const,
    model: "claude-3-5-haiku",
    routedCost: 0.0014,
    baselineCost: 0.0065,
    ms: 1120,
    why: "Match target path against protected_paths",
  },
  {
    agent: "Synthesizer",
    tier: "reasoning" as const,
    model: "claude-3-7-sonnet",
    routedCost: 0.0098,
    baselineCost: 0.0165,
    ms: 4120,
    why: "Cross-source RCA reasoning & exact code patch",
  },
  {
    agent: "L4 Verifier",
    tier: "reasoning" as const,
    model: "claude-3-7-sonnet",
    routedCost: 0.0053,
    baselineCost: 0.0102,
    ms: 3210,
    why: "Adversarial fresh-context audit before HITL",
  },
];

export function CostRouterDiagram() {
  const [mode, setMode] = useState<"routed" | "baseline">("routed");

  const totalRouted = ROUTING_ROWS.reduce((a, r) => a + r.routedCost, 0);
  const totalBaseline = ROUTING_ROWS.reduce((a, r) => a + r.baselineCost, 0);
  const savingsPct = Math.round(((totalBaseline - totalRouted) / totalBaseline) * 100);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs font-semibold text-ink flex items-center gap-1.5">
            <DollarSign className="h-3.5 w-3.5 text-signal" />
            Per-Incident Cost Comparison (Incident #992)
          </div>
          <div className="text-[11px] text-ink-3">
            {mode === "routed" ? (
              <>
                Actual Routed Spend: <strong className="text-signal font-mono">${totalRouted.toFixed(4)}</strong>{" "}
                <span className="text-signal font-medium">({savingsPct}% cheaper than unrouted)</span>
              </>
            ) : (
              <>
                Unrouted 100% Frontier Baseline:{" "}
                <strong className="text-violet-700 font-mono">${totalBaseline.toFixed(4)}</strong>
              </>
            )}
          </div>
        </div>

        <div className="inline-flex rounded-lg border border-edge bg-surface-2 p-0.5 text-[11px]">
          <button
            type="button"
            onClick={() => setMode("routed")}
            className={`rounded-md px-2.5 py-1 font-medium transition cursor-pointer ${
              mode === "routed"
                ? "bg-surface-1 text-signal shadow-xs"
                : "text-ink-2 hover:text-ink"
            }`}
          >
            Cost-Aware Routed
          </button>
          <button
            type="button"
            onClick={() => setMode("baseline")}
            className={`rounded-md px-2.5 py-1 font-medium transition cursor-pointer ${
              mode === "baseline"
                ? "bg-surface-1 text-violet-700 shadow-xs"
                : "text-ink-2 hover:text-ink"
            }`}
          >
            100% Frontier Baseline
          </button>
        </div>
      </div>

      <div className="space-y-2.5">
        {ROUTING_ROWS.map((row) => {
          const shownCost = mode === "routed" ? row.routedCost : row.baselineCost;
          const pct = Math.min(100, Math.round((shownCost / 0.017) * 100));
          const isFast = mode === "routed" && row.tier === "fast";

          return (
            <div
              key={row.agent}
              className="rounded-xl border border-edge bg-surface-1 p-3 space-y-1.5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <Cpu className={`h-3.5 w-3.5 ${isFast ? "text-signal" : "text-violet-700"}`} />
                  <span className="font-semibold text-ink">{row.agent}</span>
                  <span
                    className={`badge font-mono text-[10px] ${
                      isFast ? "badge-live" : "badge-violet"
                    }`}
                  >
                    {mode === "routed" ? row.model : "claude-3-7-sonnet"}
                  </span>
                </div>
                <div className="font-mono text-[11px] text-ink-2 tabular">
                  <strong className={isFast ? "text-signal" : "text-violet-700"}>
                    ${shownCost.toFixed(4)}
                  </strong>{" "}
                  · {row.ms}ms
                </div>
              </div>

              <div className="h-2 w-full rounded-full bg-surface-2 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    isFast ? "bg-signal" : "bg-violet-600"
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>

              <div className="text-[11px] text-ink-3 flex items-center gap-1.5">
                <FileCode2 className="h-3 w-3 shrink-0" />
                {row.why}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
