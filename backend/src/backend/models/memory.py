from uuid import UUID, uuid4

from pgvector.sqlalchemy import Vector
from sqlalchemy import ForeignKey, Integer, Text, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.db.base import Base


class SemanticMemoryChunk(Base):
    """Tier 1: Semantic Memory (pgvector embeddings)."""

    __tablename__ = "semantic_memory_chunks"

    id: Mapped[UUID] = mapped_column(
        primary_key=True, default=uuid4, server_default=text("gen_random_uuid()")
    )
    workspace_id: Mapped[UUID] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), index=True
    )
    file_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("knowledge_files.id", ondelete="SET NULL"), nullable=True
    )
    content: Mapped[str] = mapped_column(Text)
    # 'metadata' is a reserved attribute on DeclarativeBase; hence the alias.
    metadata_: Mapped[dict] = mapped_column("metadata", JSONB, default=dict)
    embedding: Mapped[list] = mapped_column(Vector(1536))

    workspace: Mapped["Workspace"] = relationship(back_populates="memory_chunks")  # type: ignore[name-defined]


class ProceduralRule(Base):
    """Tier 2: Procedural Memory (safety invariants)."""

    __tablename__ = "procedural_rules"

    id: Mapped[UUID] = mapped_column(
        primary_key=True, default=uuid4, server_default=text("gen_random_uuid()")
    )
    workspace_id: Mapped[UUID] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), index=True
    )
    min_confidence_threshold: Mapped[int] = mapped_column(
        Integer, default=85, server_default="85"
    )
    protected_paths: Mapped[list] = mapped_column(JSONB, default=list)
    custom_instructions: Mapped[str | None] = mapped_column(Text, nullable=True)

    workspace: Mapped["Workspace"] = relationship(back_populates="procedural_rules")  # type: ignore[name-defined]
