from fastapi import FastAPI

from backend.api.health import router as health_router
from backend.api.auth import router as auth_router
from backend.api.incidents import router as incidents_router
from backend.api.storage import router as storage_router

app = FastAPI(title="SentinelSRE API", version="0.1.0")

app.include_router(health_router, prefix="/api")
app.include_router(auth_router, prefix="/api")
app.include_router(incidents_router, prefix="/api")
app.include_router(storage_router, prefix="/api")

@app.get("/")
async def root() -> dict[str, str]:
    return {"service": "sentinel-sre", "status": "running"}