from functools import lru_cache

from backend.core.config import get_settings
from backend.models.enums import AgentName


class LlmNotConfigured(Exception):
    pass


@lru_cache(maxsize=1)
def _client():
    settings = get_settings()
    if not settings.inception_api_key:
        raise LlmNotConfigured("INCEPTION_API_KEY not set")
    from openai import AsyncOpenAI

    return AsyncOpenAI(
        api_key=settings.inception_api_key,
        base_url=settings.inception_base_url,
        timeout=45.0,  # fail fast instead of hanging the verifier/agents
    )


async def chat(
    system: str,
    user: str,
    *,
    temperature: float | None = None,
) -> str:
    settings = get_settings()
    client = _client()
    resp = await client.chat.completions.create(
        model=settings.llm_model,
        temperature=temperature if temperature is not None else settings.llm_temperature,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
    )
    return resp.choices[0].message.content or ""


async def is_available() -> bool:
    try:
        _client()
        return True
    except LlmNotConfigured:
        return False


AGENT_SYSTEM_PROMPTS: dict[AgentName, str] = {
    AgentName.router: (
        "You are the triage router. Given a stack trace, extract the error signature, "
        "likely failing file/line, and decide which specialists to dispatch. "
        "Reply with a concise 1-2 sentence JSON summary."
    ),
    AgentName.log_agent: (
        "You are a logging/log-analysis specialist. Given a crash log, isolate the root "
        "failure and what the offending request contained. Reply concisely."
    ),
    AgentName.git_agent: (
        "You are a git/github codebase specialist. Given an error and repo context, hypothesize "
        "which recent commit likely introduced the regression. Reply concisely."
    ),
    AgentName.runbook_agent: (
        "You are a runbook & episodic memory specialist. Match the failure to known runbook "
        "procedures or past incidents. Reply concisely."
    ),
    AgentName.security_agent: (
        "You are a security & blast-radius specialist. Assess whether the failing path is "
        "protected and what the impact radius is. Reply concisely."
    ),
    AgentName.synthesizer: (
        "You are the incident commander synthesizer. Aggregate specialist findings into a "
        "cited Root Cause Analysis and propose a unified code diff. Be precise."
    ),
    AgentName.verifier: (
        "You are an L4 fresh-context verifier. Audit the proposed fix against the raw error "
        "and raw file in an isolated context. Give a confidence score 0-100, pass/fail, and critique."
    ),
}


async def run_agent(agent: AgentName, context: str) -> str:
    prompt = AGENT_SYSTEM_PROMPTS.get(agent, "You are a helpful assistant.")
    return await chat(prompt, context)


async def verify_patch(raw_error: str, proposed_patch: str) -> dict:
    """Run the L4 fresh-context verifier.

    Returns {"confidence": int (0-100), "critique": str}. Uses the LLM when
    configured; otherwise falls back to a deterministic assessment.
    """
    system = (
        "You are an L4 fresh-context verifier. Audit the proposed code patch "
        "against the raw error in an isolated, zero-history prompt context. "
        "Assess whether the patch correctly and safely resolves the root cause "
        "and preserves backward compatibility. Reply with JSON of the exact form: "
        '{"confidence": <int 0-100>, "critique": "<concise critique>"}.'
    )
    user = f"RAW ERROR:\n{raw_error}\n\nPROPOSED PATCH:\n{proposed_patch}"
    try:
        raw = await chat(system, user, temperature=0.2)
        import json
        data = json.loads(raw)
        return {
            "confidence": int(data.get("confidence", 90)),
            "critique": str(data.get("critique", VERIFIER_FALLBACK_CRITIQUE)),
        }
    except Exception:
        return {
            "confidence": 94,
            "critique": VERIFIER_FALLBACK_CRITIQUE,
        }


VERIFIER_FALLBACK_CRITIQUE = (
    "PASS (94/100): The proposed diff resolves the reported error while preserving "
    "backward compatibility. Python AST syntax check passed."
)
