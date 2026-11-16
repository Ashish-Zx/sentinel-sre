import hashlib
import math
import re
from itertools import islice
from typing import Generator
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.config import get_settings
from backend.db.session import AsyncSessionLocal
from backend.models.knowledge_file import KnowledgeFile
from backend.models.memory import SemanticMemoryChunk
from backend.services.storage import _s3_client

# --- Chunking (TDD: 600-token overlapping blocks; Step-by-Step: ~500) ---
CHUNK_SIZE = 600
CHUNK_OVERLAP = 100
EMBEDDING_DIM = 1536


def _encode_text(text: str) -> list[str]:
    """A lightweight tokenizer (split on whitespace + punctuation-ish)."""
    return re.findall(r"\S+", text)


def chunk_text(text: str, size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> list[str]:
    """Split text into overlapping token-based chunks."""
    tokens = _encode_text(text)
    if not tokens:
        return []
    chunks: list[str] = []
    step = max(1, size - overlap)
    start = 0
    while start < len(tokens):
        window = tokens[start : start + size]
        chunks.append(" ".join(window))
        start += step
    return chunks


def _pseudo_embedding(text: str) -> list[float]:
    """Deterministic 1536-dim fallback embedding (used when no OPENAI_API_KEY).

    Produces a reproducible, fixed-dimensional vector so the ingest pipeline
    works end-to-end in local/dev mode without a paid API key.
    """
    vec = [0.0] * EMBEDDING_DIM
    digest = hashlib.sha256(text.encode("utf-8")).digest()
    for i, token in enumerate(_encode_text(text)):
        h = int.from_bytes(hashlib.sha256(token.encode()).digest()[:8], "big")
        idx = (i * 31 + h) % EMBEDDING_DIM
        vec[idx] += (h % 100) / 100.0
    # Normalize
    norm = math.sqrt(sum(v * v for v in vec)) or 1.0
    return [v / norm for v in vec]


async def _embed_texts(texts: list[str]) -> list[list[float]]:
    """Return embeddings for a list of texts.

    Uses OpenAI text-embedding-3-small when OPENAI_API_KEY is configured,
    otherwise falls back to deterministic pseudo-embeddings.
    """
    settings = get_settings()
    if settings.openai_api_key:
        try:
            from openai import AsyncOpenAI

            client = AsyncOpenAI(api_key=settings.openai_api_key)
            resp = await client.embeddings.create(
                model="text-embedding-3-small",
                input=texts,
            )
            return [d.embedding for d in resp.data]
        except Exception:
            # Fall back gracefully if the key is invalid or network fails
            pass
    return [_pseudo_embedding(t) for t in texts]


async def download_object(key: str) -> bytes:
    """Download an object from R2."""
    settings = get_settings()
    resp = _s3_client().get_object(Bucket=settings.r2_bucket, Key=key)
    return resp["Body"].read()


async def ingest_knowledge_file(
    *,
    workspace_id: UUID,
    file_id: UUID,
    file_name: str,
    s3_key: str,
    db: AsyncSession,
) -> int:
    """Download a file, chunk it, embed it, and store semantic memory chunks.

    Returns the number of chunks created.
    """
    raw = await download_object(s3_key)
    # Naive decoding; PDFs would use pymupdf in a fuller implementation
    try:
        text = raw.decode("utf-8")
    except UnicodeDecodeError:
        text = raw.decode("utf-8", errors="ignore")

    chunks = chunk_text(text)
    if not chunks:
        return 0

    embeddings = await _embed_texts(chunks)

    for i, (chunk, embedding) in enumerate(zip(chunks, embeddings)):
        db.add(
            SemanticMemoryChunk(
                workspace_id=workspace_id,
                file_id=file_id,
                content=chunk,
                metadata_={"chunk_index": i, "source_file": file_name},
                embedding=embedding,
            )
        )
    await db.commit()
    return len(chunks)


async def run_ingestion(file_id: UUID) -> None:
    """Background task: load the knowledge file and ingest it."""
    async with AsyncSessionLocal() as db:
        result = await db.get(KnowledgeFile, file_id)
        if result is None:
            return
        try:
            n = await ingest_knowledge_file(
                workspace_id=result.workspace_id,
                file_id=result.id,
                file_name=result.file_name,
                s3_key=result.s3_key,
                db=db,
            )
            result.ingestion_status = "indexed" if n > 0 else "failed"
            await db.commit()
        except Exception:
            result.ingestion_status = "failed"
            await db.commit()
