import asyncio
import json
from collections.abc import AsyncGenerator
from uuid import UUID

from backend.models.enums import IncidentStatus

# Model routing (mimics the cost-aware router)
FAST_MODEL = "claude-3-5-haiku"
REASONING_MODEL = "claude-3-7-sonnet"

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


async def stream_investigation(incident_id: UUID) -> AsyncGenerator[str, None]:
    """Stream a simulated multi-agent investigation as SSE events."""
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
    yield _event(
        {
            "type": "agent_completed",
            "agent_name": "router",
            "model_used": step["model"],
            "latency_ms": step["latency_ms"],
            "cost_usd": step["cost_usd"],
            "summary": step["summary"],
        }
    )

    # 2. Four parallel specialists
    parallel = ["log_agent", "git_agent", "runbook_agent", "security_agent"]
    for name in parallel:
        yield _event({"type": "agent_started", "agent_name": name})

    await asyncio.sleep(0.2)
    for name in parallel:
        s = next(x for x in AGENT_STEPS if x["agent_name"] == name)
        yield _event(
            {
                "type": "agent_completed",
                "agent_name": name,
                "model_used": s["model"],
                "latency_ms": s["latency_ms"],
                "cost_usd": s["cost_usd"],
                "summary": s["summary"],
            }
        )

    # 3. Synthesizer
    yield _event({"type": "agent_started", "agent_name": "synthesizer"})
    await asyncio.sleep(0.2)
    synth = AGENT_STEPS[5]
    yield _event(
        {
            "type": "agent_completed",
            "agent_name": "synthesizer",
            "model_used": synth["model"],
            "latency_ms": synth["latency_ms"],
            "cost_usd": synth["cost_usd"],
            "summary": synth["summary"],
            "root_cause_report": ROOT_CAUSE_REPORT,
            "proposed_patch_diff": PROPOSED_PATCH_DIFF,
            "target_file_path": "api/checkout.py",
        }
    )

    # 4. Verifier
    yield _event({"type": "agent_started", "agent_name": "verifier"})
    await asyncio.sleep(0.2)
    ver = AGENT_STEPS[6]
    yield _event(
        {
            "type": "verifier_result",
            "agent_name": "verifier",
            "model_used": ver["model"],
            "latency_ms": ver["latency_ms"],
            "cost_usd": ver["cost_usd"],
            "confidence_score": 94,
            "verifier_critique": VERIFIER_CRITIQUE,
        }
    )

    # 5. HITL gate: pause for human approval
    yield _event(
        {
            "type": "hitl_paused",
            "status": IncidentStatus.awaiting_approval.value,
            "confidence_score": 94,
            "escalation_reason": ESCALATION_REASON,
            "root_cause_report": ROOT_CAUSE_REPORT,
            "proposed_patch_diff": PROPOSED_PATCH_DIFF,
            "target_file_path": "api/checkout.py",
        }
    )
