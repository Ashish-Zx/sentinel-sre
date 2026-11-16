from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.api.health import router as health_router
from backend.api.auth import router as auth_router
from backend.api.incidents import router as incidents_router
from backend.api.storage import router as storage_router
from backend.api.knowledge import router as knowledge_router
from backend.api.rules import router as rules_router
from backend.core.config import get_settings

settings = get_settings()

app = FastAPI(title="SentinelSRE API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router, prefix="/api")
app.include_router(auth_router, prefix="/api")
app.include_router(incidents_router, prefix="/api")
app.include_router(storage_router, prefix="/api")
app.include_router(knowledge_router, prefix="/api")
app.include_router(rules_router, prefix="/api")

@app.get("/")
async def root() -> dict[str, str]:
    return {"service": "sentinel-sre", "status": "running"}