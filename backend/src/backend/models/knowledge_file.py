from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import DateTime, ForeignKey, String, func, text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import ENUM

from backend.db.base import Base
from backend.models.enums import FileType, IngestionStatus


class KnowledgeFile(Base):
    __tablename__ = "knowledge_files"

    id: Mapped[UUID] = mapped_column(
        primary_key=True, default=uuid4, server_default=text("gen_random_uuid()")
    )
    workspace_id: Mapped[UUID] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), index=True
    )
    file_name: Mapped[str] = mapped_column(String)
    file_type: Mapped[FileType] = mapped_column(
        ENUM(FileType, name="file_type", create_type=True), nullable=False
    )
    s3_key: Mapped[str] = mapped_column(String)
    ingestion_status: Mapped[IngestionStatus] = mapped_column(
        ENUM(IngestionStatus, name="ingestion_status", create_type=True),
        default=IngestionStatus.pending,
        server_default=IngestionStatus.pending.value,
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    workspace: Mapped["Workspace"] = relationship(back_populates="knowledge_files")  # type: ignore[name-defined]
