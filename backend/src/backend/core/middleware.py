"""Production middleware: security headers and optional Upstash rate limiting."""

import logging

import httpx
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

from backend.core.config import get_settings

logger = logging.getLogger(__name__)

SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
}


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response: Response = await call_next(request)
        for header, value in SECURITY_HEADERS.items():
            response.headers.setdefault(header, value)
        # Strict Transport Security for production HTTPS traffic
        if get_settings().app_env == "production":
            response.headers.setdefault(
                "Strict-Transport-Security", "max-age=31536000; includeSubDomains"
            )
        return response


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Fixed-window rate limiter via Upstash Redis REST (fail-open).

    Inactive unless ``UPSTASH_REDIS_REST_URL`` and ``UPSTASH_REDIS_REST_TOKEN``
    are configured.
    """

    def __init__(self, app, window_seconds: int = 60):
        super().__init__(app)
        self.window = window_seconds

    def _configured(self) -> bool:
        s = get_settings()
        return bool(s.upstash_redis_rest_url and s.upstash_redis_rest_token)

    async def dispatch(self, request: Request, call_next):
        if not self._configured():
            return await call_next(request)

        settings = get_settings()
        client_ip = request.client.host if request.client else "unknown"
        key = f"rate:demo:{client_ip}"

        try:
            async with httpx.AsyncClient(timeout=2) as client:
                headers = {
                    "Authorization": f"Bearer {settings.upstash_redis_rest_token}"
                }
                r = await client.get(
                    f"{settings.upstash_redis_rest_url}/incr/{key}", headers=headers
                )
                count = int(r.json().get("result", 0))
                if count == 1:
                    await client.get(
                        f"{settings.upstash_redis_rest_url}/expire/{key}/{self.window}",
                        headers=headers,
                    )
        except Exception as exc:  # fail-open
            logger.warning("rate limit check skipped: %s", exc)
            return await call_next(request)

        if count > settings.rate_limit_rpm:
            return Response(
                content='{"detail":"Rate limit exceeded"}',
                status_code=429,
                media_type="application/json",
            )
        return await call_next(request)
