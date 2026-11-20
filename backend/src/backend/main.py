import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.api.health import router as health_router
from backend.api.auth import router as auth_router
from backend.api.github import router as github_router
from backend.api.slack import router as slack_router
from backend.api.incidents import router as incidents_router
from backend.api.storage import router as storage_router
from backend.api.knowledge import router as knowledge_router
from backend.api.rules import router as rules_router
from backend.api.analytics import router as analytics_router
from backend.api.memory import router as memory_router
from backend.api.workspace import router as workspace_router
from backend.core.config import get_settings
from backend.core.middleware import RateLimitMiddleware, SecurityHeadersMiddleware

settings = get_settings()

logging.basicConfig(
    level=getattr(logging, settings.log_level.upper(), logging.INFO),
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)

logger = logging.getLogger("sentinel.backend")

app = FastAPI(title="SentinelSRE API", version="0.1.0")

app.add_middleware(RateLimitMiddleware)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins + ["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router, prefix="/api")
app.include_router(auth_router, prefix="/api")
app.include_router(github_router, prefix="/api")
app.include_router(slack_router, prefix="/api")
app.include_router(incidents_router, prefix="/api")
app.include_router(storage_router, prefix="/api")
app.include_router(knowledge_router, prefix="/api")
app.include_router(rules_router, prefix="/api")
app.include_router(analytics_router, prefix="/api")
app.include_router(memory_router, prefix="/api")
app.include_router(workspace_router, prefix="/api")

## --- Production environment sanity check (logs warnings; never blocks boot) ---
_REQUIRED_PRODUCEION = {
    "clerk_jwks_url": "Clerk JWKS URL",
    "clerk_issuer": "Clerk issuer",
    "database_url": "DATABASE_URL",
    "slack_webhook_url": "Slack webhook URL",
    "r2_bucket": "R2 bucket",
}


def _validate_environment() -> None:
    if settings.app_env != "production":
        if not (
            settings.inception_api_key
            or settings.openai_api_key
            or settings.anthropic_api_key
        ):
            logger.warning(
                "No LLM API key configured (INCEPTION/OPENAI/ANTHROPIC) - "
                "agent investigation will use deterministic fallbacks."
            )
        return

    missing = []
    for attr, label in _REQUIRED_PRODUCEION.items():
        if not getattr(settings, attr, None):
            missing.append(label)
    # GitHub access must come from either a global token OR per-user OAuth.
    if not settings.github_access_token and not (
        settings.github_client_id and settings.github_client_secret
    ):
        missing.append("a GitHub token or OAuth app (GITHUB_ACCESS_TOKEN / GITHUB_CLIENT_ID+CLIENT_SECRET)")
    if not (
        settings.inception_api_key
        or settings.openai_api_key
        or settings.anthropic_api_key
    ):
        missing.append("an LLM API key")
    if missing:
        logger.error(
            "Production environment missing required configuration: %s",
            ", ".join(missing),
        )


_validate_environment()

@app.get("/")
async def root() -> dict[str, str]:
    return {"service": "sentinel-sre", "status": "running"}