from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import DateTime, String, func, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.db.base import Base


class Workspace(Base):
    __tablename__ = "workspaces"

    id: Mapped[UUID] = mapped_column(
        primary_key=True, default=uuid4, server_default=text("gen_random_uuid()")
    )
    clerk_user_id: Mapped[str] = mapped_column(String, index=True)
    github_repo_url: Mapped[str | None] = mapped_column(String, nullable=True)
    github_pat_encrypted: Mapped[str | None] = mapped_column(String, nullable=True)
    slack_token_encrypted: Mapped[str | None] = mapped_column(String, nullable=True)
    slack_team_name: Mapped[str | None] = mapped_column(String, nullable=True)
    slack_channel_id: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    knowledge_files: Mapped[list["KnowledgeFile"]] = relationship(  # type: ignore[name-defined]
        back_populates="workspace"
    )
    memory_chunks: Mapped[list["SemanticMemoryChunk"]] = relationship(  # type: ignore[name-defined]
        back_populates="workspace"
    )
    procedural_rules: Mapped[list["ProceduralRule"]] = relationship(  # type: ignore[name-defined]
        back_populates="workspace"
    )
    incidents: Mapped[list["Incident"]] = relationship(  # type: ignore[name-defined]
        back_populates="workspace"
    )
