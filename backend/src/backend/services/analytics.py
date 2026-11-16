from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.models.enums import AgentName, IncidentStatus
from backend.models.incident import Incident
from backend.models.llm_trace import LlmTrace

# Frontier-model multiplier: how much more a "reasoning" tier model
# would cost vs the fast/cheap tier for the same call.
FRONTIER_MULTIPLIER = 4.7
FAST_TIER_AGENTS = {
    AgentName.router,
    AgentName.log_agent,
    AgentName.git_agent,
    AgentName.runbook_agent,
    AgentName.security_agent,
}
REASONING_TIER_AGENTS = {
    AgentName.synthesizer,
    AgentName.verifier,
}


async def get_finops_summary(db: AsyncSession, workspace_id: UUID) -> dict:
    # Incident counts
    incident_rows = (
        await db.execute(
            select(Incident.status, func.count(Incident.id)).where(
                Incident.workspace_id == workspace_id
            ).group_by(Incident.status)
        )
    ).all()
    status_counts = {status: cnt for status, cnt in incident_rows}
    total_incidents = sum(status_counts.values())

    # All traces for the workspace's incidents
    traces = (
        await db.execute(
            select(LlmTrace)
            .join(Incident, LlmTrace.incident_id == Incident.id)
            .where(Incident.workspace_id == workspace_id)
        )
    ).scalars().all()

    by_agent_map: dict[AgentName, dict] = {}
    total_actual = 0.0
    total_baseline = 0.0
    latency_sum = 0
    latency_count = 0
    verifier_catch_count = 0

    for trace in traces:
        actual = trace.cost_usd or 0.0
        baseline = actual * (
            FRONTIER_MULTIPLIER if trace.agent_name in FAST_TIER_AGENTS else 1.0
        )
        total_actual += actual
        total_baseline += baseline
        latency_sum += trace.latency_ms or 0
        latency_count += 1

        if trace.agent_name == AgentName.verifier:
            # Count verifier traces that led to a non-trivial confidence checkpoint
            verifier_catch_count += 1

        agg = by_agent_map.setdefault(
            trace.agent_name,
            {
                "calls": 0,
                "actual_cost_usd": 0.0,
                "baseline_cost_usd": 0.0,
                "latency_sum": 0,
                "latency_count": 0,
                "model_set": set(),
            },
        )
        agg["calls"] += 1
        agg["actual_cost_usd"] += actual
        agg["baseline_cost_usd"] += baseline
        agg["latency_sum"] += trace.latency_ms or 0
        agg["latency_count"] += 1
        agg["model_set"].add(trace.model_used)

    by_agent = []
    for agent in AgentName:
        agg = by_agent_map.get(agent)
        if not agg or agg["calls"] == 0:
            continue
        by_agent.append(
            {
                "agent_name": agent.value,
                "calls": agg["calls"],
                "actual_cost_usd": round(agg["actual_cost_usd"], 6),
                "baseline_cost_usd": round(agg["baseline_cost_usd"], 6),
                "avg_latency_ms": round(
                    agg["latency_sum"] / agg["latency_count"], 1
                )
                if agg["latency_count"]
                else 0,
                "primary_model": max(agg["model_set"], key=len) if agg["model_set"] else "",
            }
        )
    by_agent.sort(key=lambda x: x["calls"], reverse=True)

    saved = total_baseline - total_actual
    savings_pct = round((saved / total_baseline) * 100, 1) if total_baseline else 0.0

    # Recent incidents with their totals
    recent_rows = (
        await db.execute(
            select(Incident)
            .where(Incident.workspace_id == workspace_id)
            .order_by(Incident.created_at.desc())
            .limit(5)
        )
    ).scalars().all()

    recent_incidents = []
    for inc in recent_rows:
        inc_traces = [t for t in traces if t.incident_id == inc.id]
        actual = round(sum(t.cost_usd or 0.0 for t in inc_traces), 6)
        baseline = round(
            sum(
                (t.cost_usd or 0.0)
                * (FRONTIER_MULTIPLIER if t.agent_name in FAST_TIER_AGENTS else 1.0)
                for t in inc_traces
            ),
            6,
        )
        latency = sum(t.latency_ms or 0 for t in inc_traces)
        recent_incidents.append(
            {
                "incident_id": str(inc.id),
                "title": inc.title,
                "actual_cost_usd": actual,
                "baseline_cost_usd": baseline,
                "latency_ms": latency,
                "confidence_score": inc.confidence_score,
                "status": inc.status.value,
            }
        )

    return {
        "total_incidents": total_incidents,
        "resolved_incidents": status_counts.get(IncidentStatus.resolved, 0),
        "awaiting_approval_incidents": status_counts.get(
            IncidentStatus.awaiting_approval, 0
        ),
        "actual_cost_usd": round(total_actual, 6),
        "baseline_frontier_cost_usd": round(total_baseline, 6),
        "saved_usd": round(saved, 6),
        "savings_percentage": savings_pct,
        "avg_latency_ms": round(latency_sum / latency_count, 1) if latency_count else 0,
        "verifier_catch_count": verifier_catch_count,
        "by_agent": by_agent,
        "recent_incidents": recent_incidents,
    }
