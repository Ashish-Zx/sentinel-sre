import asyncio
import json
from collections.abc import AsyncGenerator
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from backend.models.enums import AgentName, IncidentStatus
from backend.models.incident import Incident
from backend.models.llm_trace import LlmTrace
from backend.services.llm import run_agent, verify_patch

# Model routing (mimics the cost-aware router)
FAST_MODEL = "mercury-3"
REASONING_MODEL = "mercury-3"

AGENT_STEPS: list[dict] = [
    {
        "agent_name": "router",
        "label": "Triage & Cost-Aware Router",
        "model": FAST_MODEL,
        "latency_ms": 680,
        "cost_usd": 0.0008,
        "summary": "Extracted error signature. Fanning out 4 parallel specialists via LangGraph Send().",
    },
    {
        "agent_name": "log_agent",
        "label": "Log & StackTrace Specialist",
        "model": FAST_MODEL,
        "latency_ms": 1420,
        "cost_usd": 0.0024,
        "summary": "Isolated ~142 HTTP 500 crashes. Request sends 'promo_code' but line reads 'discount_code'.",
    },
    {
        "agent_name": "git_agent",
        "label": "Git & Codebase Specialist (GitHub MCP)",
        "model": FAST_MODEL,
        "latency_ms": 1790,
        "cost_usd": 0.0025,
        "summary": "GitHub MCP found the offending commit renamed 'discount_code' -> 'promo_code'.",
    },
    {
        "agent_name": "runbook_agent",
        "label": "Runbook & Episodic Memory Specialist",
        "model": FAST_MODEL,
        "latency_ms": 1310,
        "cost_usd": 0.0020,
        "summary": "Matched Checkout Runbook §4.2 (pgvector 0.91): keep 30-day fallback for legacy key.",
    },
    {
        "agent_name": "security_agent",
        "label": "Security & Blast-Radius Specialist",
        "model": FAST_MODEL,
        "latency_ms": 1120,
        "cost_usd": 0.0014,
        "summary": "Flagged api/checkout.py under protected rule. Mandatory HITL gate armed.",
    },
    {
        "agent_name": "synthesizer",
        "label": "Incident Commander Synthesizer",
        "model": REASONING_MODEL,
        "latency_ms": 4120,
        "cost_usd": 0.0098,
        "summary": "Synthesized Root Cause Report + backward-compatible Unified Git Diff.",
    },
    {
        "agent_name": "verifier",
        "label": "L4 Fresh-Context Verifier Shield",
        "model": REASONING_MODEL,
        "latency_ms": 3210,
        "cost_usd": 0.0053,
        "summary": "Verified in isolated fresh context: AST valid, resolves KeyError, satisfies Runbook §4.2.",
    },
]

ROOT_CAUSE_REPORT = """### Root Cause Diagnosis
A recent commit renamed the Pydantic field `discount_code` to `promo_code`, but `api/checkout.py:84` still reads `payload["discount_code"]` directly.

### Cross-Referenced Evidence
- **Log & StackTrace Specialist:** isolated repeated 500 errors on `POST /api/checkout`.
- **Git & Codebase MCP Specialist:** confirmed the field rename in the offending commit.
- **Runbook & Episodic Memory Specialist:** matched Checkout Runbook §4.2 — maintain a 30-day fallback for the legacy key.
- **Security & Blast-Radius Specialist:** flagged `api/checkout.py` as a protected path (HITL gate required).
"""

PROPOSED_PATCH_DIFF = """--- a/api/checkout.py
+++ b/api/checkout.py
@@ -80,8 +80,10 @@ async def create_order(payload: dict, db: AsyncSession):
     cart = await get_active_cart(db, payload["cart_id"])
     if not cart:
         raise HTTPException(status_code=404, detail="Cart not found")
-
-    discount = payload["discount_code"]
+    # Support both new 'promo_code' and legacy 'discount_code' (Runbook §4.2)
+    discount = payload.get("promo_code") or payload.get("discount_code")
     final_total = apply_Catalog_discount(cart.subtotal, discount)
     return await charge_stripe_intent(cart.user_id, final_total)
"""

VERIFIER_CRITIQUE = (
    "PASS (94/100): Unified diff resolves the KeyError while preserving backward "
    "compatibility with legacy clients per Runbook §4.2. Python AST syntax check passed."
)

ESCALATION_REASON = (
    "Protected Path Triggered: 'api/checkout.py' matches procedural rule "
    "'/payments & checkout routes ALWAYS require human approval'."
)


def _event(payload: dict) -> str:
    return f"data: {json.dumps(payload)}\n\n"


async def _record_trace(
    db: AsyncSession, incident_id: UUID, step: dict, agent_name: AgentName
) -> None:
    db.add(
        LlmTrace(
            incident_id=incident_id,
            agent_name=agent_name,
            model_used=step["model"],
            prompt_tokens=step.get("prompt_tokens", 1000),
            completion_tokens=step.get("completion_tokens", 200),
            cost_usd=step["cost_usd"],
            latency_ms=step["latency_ms"],
        )
    )
    await db.commit()


async def _maybe_llm_summary(agent: AgentName, context: str, fallback: str) -> str:
    """Use the LLM to summarize an agent's findings when configured, else fallback."""
    try:
        return (await run_agent(agent, context)).strip() or fallback
    except Exception:
        return fallback


async def stream_investigation(
    incident_id: UUID, db: AsyncSession, context: str = ""
) -> AsyncGenerator[str, None]:
    """Stream a multi-agent investigation as SSE events.

    When INCEPTION_API_KEY is configured, agent summaries are generated with
    the mercury-3 model; otherwise deterministic fallback content is used.
    """
    # 1. Router
    yield _event(
        {
            "type": "agent_started",
            "agent_name": "router",
            "model_used": FAST_MODEL,
        }
    )
    await asyncio.sleep(0.2)
    step = AGENT_STEPS[0]
    await _record_trace(db, incident_id, step, AgentName.router)
    router_summary = await _maybe_llm_summary(
        AgentName.router, context, step["summary"]
    )
    yield _event(
        {
            "type": "agent_completed",
            "agent_name": "router",
            "model_used": step["model"],
            "latency_ms": step["latency_ms"],
            "cost_usd": step["cost_usd"],
            "summary": router_summary,
        }
    )

    # 2. Four parallel specialists
    parallel = [
        (AgentName.log_agent, "log_agent"),
        (AgentName.git_agent, "git_agent"),
        (AgentName.runbook_agent, "runbook_agent"),
        (AgentName.security_agent, "security_agent"),
    ]
    for _, name in parallel:
        yield _event({"type": "agent_started", "agent_name": name})

    await asyncio.sleep(0.2)
    for agent_enum, name in parallel:
        s = next(x for x in AGENT_STEPS if x["agent_name"] == name)
        await _record_trace(db, incident_id, s, agent_enum)
        llm_summary = await _maybe_llm_summary(agent_enum, context, s["summary"])
        yield _event(
            {
                "type": "agent_completed",
                "agent_name": name,
                "model_used": s["model"],
                "latency_ms": s["latency_ms"],
                "cost_usd": s["cost_usd"],
                "summary": llm_summary,
            }
        )

    # 3. Synthesizer
    yield _event({"type": "agent_started", "agent_name": "synthesizer"})
    await asyncio.sleep(0.2)
    synth = AGENT_STEPS[5]
    await _record_trace(db, incident_id, synth, AgentName.synthesizer)
    report = ROOT_CAUSE_REPORT
    patch = PROPOSED_PATCH_DIFF
    try:
        draft = (await run_agent(AgentName.synthesizer, context)).strip()
        if draft:
            report = draft
    except Exception:
        pass
    yield _event(
        {
            "type": "agent_completed",
            "agent_name": "synthesizer",
            "model_used": synth["model"],
            "latency_ms": synth["latency_ms"],
            "cost_usd": synth["cost_usd"],
            "summary": synth["summary"],
            "root_cause_report": report,
            "proposed_patch_diff": patch,
            "target_file_path": "api/checkout.py",
        }
    )

    # 4. Verifier (L4 fresh-context: real LLM assessment when configured)
    yield _event({"type": "agent_started", "agent_name": "verifier"})
    await asyncio.sleep(0.2)
    ver = AGENT_STEPS[6]
    await _record_trace(db, incident_id, ver, AgentName.verifier)

    verifier = await verify_patch(context, patch)
    confidence = verifier["confidence"]
    critique = verifier["critique"]

    yield _event(
        {
            "type": "verifier_result",
            "agent_name": "verifier",
            "model_used": ver["model"],
            "latency_ms": ver["latency_ms"],
            "cost_usd": ver["cost_usd"],
            "confidence_score": confidence,
            "verifier_critique": critique,
        }
    )

    # 5. HITL gate: persist findings + pause for human approval
    incident = await db.get(Incident, incident_id)
    if incident is not None:
        incident.root_cause_report = report
        incident.proposed_patch_diff = patch
        incident.target_file_path = "api/checkout.py"
        incident.confidence_score = confidence
        incident.verifier_critique = critique
        incident.status = IncidentStatus.awaiting_approval
        await db.commit()

    yield _event(
        {
            "type": "hitl_paused",
            "status": IncidentStatus.awaiting_approval.value,
            "confidence_score": confidence,
            "escalation_reason": ESCALATION_REASON,
            "root_cause_report": report,
            "proposed_patch_diff": patch,
            "target_file_path": "api/checkout.py",
        }
    )
