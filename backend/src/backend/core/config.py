from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # --- Runtime / environment ---
    app_env: str = "development"  # development | production
    log_level: str = "INFO"

    # --- Database ---
    database_url: str = "postgresql+asyncpg://sentinel:sentinel@localhost:5432/sentinel"

    # --- CORS ---
    cors_origins: list[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]

    # --- Clerk Auth ---
    clerk_jwks_url: str = ""
    clerk_issuer: str = ""

    # --- Optional rate limiting (Upstash Redis REST) ---
    upstash_redis_rest_url: str = ""
    upstash_redis_rest_token: str = ""
    rate_limit_rpm: int = 120

    # --- LLM providers (empty for now) ---
    openai_api_key: str = ""
    anthropic_api_key: str = ""
    inception_api_key: str = ""
    inception_base_url: str = "https://api.inceptionlabs.ai/v1"
    llm_model: str = "mercury-3"
    llm_temperature: float = 0.75

    # --- MCP integrations (GitHub / Slack) ---
    # Global fallback token (shared identity). Prefer per-user OAuth: when a
    # user has connected their own GitHub account, their token is used instead.
    github_access_token: str = ""
    github_default_repo: str = ""
    slack_webhook_url: str = ""

    # --- Per-user GitHub OAuth ---
    # Create an OAuth App at https://github.com/settings/developers
    # (callback URL must be `{BACKEND_URL}/api/github/callback`).
    github_client_id: str = ""
    github_client_secret: str = ""
    # Optional; defaults to `{BACKEND_URL}/api/github/callback` when unset.
    github_oauth_callback_url: str = ""
    # Where to send the browser after the OAuth dance completes (frontend).
    frontend_url: str = "http://localhost:3000"

    # --- Per-user Slack OAuth ---
    # Create an app at https://api.slack.com/apps with Bot Token Scope
    # `chat:write` (and optionally `channels:read`). Callback URL must be
    # `{BACKEND_URL}/api/slack/callback`.
    slack_client_id: str = ""
    slack_client_secret: str = ""
    # Optional; defaults to `{BACKEND_URL}/api/slack/callback` when unset.
    slack_oauth_callback_url: str = ""

    # --- Secret encryption (Fernet key for per-user GitHub tokens) ---
    # Generate with:  python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
    encryption_key: str = ""

    # --- Storage (R2/S3, empty for now) ---
    r2_account_id: str = ""
    r2_access_key_id: str = ""
    r2_secret_access_key: str = ""
    r2_bucket: str = ""
    r2_endpoint_url: str = ""


@lru_cache
def get_settings() -> Settings:
    return Settings()