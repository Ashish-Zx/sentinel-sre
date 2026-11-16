from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # --- Database ---
    database_url: str = "postgresql+asyncpg://sentinel:sentinel@localhost:5432/sentinel"

    # --- Clerk Auth ---
    clerk_jwks_url: str = ""
    clerk_issuer: str = ""

    # --- LLM providers (empty for now) ---
    openai_api_key: str = ""
    anthropic_api_key: str = ""
    inception_api_key: str = ""
    inception_base_url: str = "https://api.inceptionlabs.ai/v1"
    llm_model: str = "mercury-3"
    llm_temperature: float = 0.75

    # --- Storage (R2/S3, empty for now) ---
    r2_account_id: str = ""
    r2_access_key_id: str = ""
    r2_secret_access_key: str = ""
    r2_bucket: str = ""
    r2_endpoint_url: str = ""


@lru_cache
def get_settings() -> Settings:
    return Settings()