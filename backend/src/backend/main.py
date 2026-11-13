from fastapi import FastAPI

app = FastAPI(title="SentinelSRE API", version="0.1.0")


@app.get("/")
async def root() -> dict[str, str]:
    return {"service": "sentinel-sre", "status": "running"}


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
 

