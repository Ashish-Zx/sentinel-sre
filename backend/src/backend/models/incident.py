from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import DateTime, ForeignKey, Integer, String, func, text
from sqlalchemy.dialects.postgresql import ENUM
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.db.base import Base
from backend.models.enums import IncidentStatus


class Incident(Base):
    """Tier 3: Episodic Memory (past investigations & human feedback)."""

    __tablename__ = "incidents"

    id: Mapped[UUID] = mapped_column(
        primary_key=True, default=uuid4, server_default=text("gen_random_uuid()")
    )  # doubles as LangGraph thread_id
    workspace_id: Mapped[UUID] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), index=True
    )
    title: Mapped[str] = mapped_column(String)
    raw_error_log_s3_key: Mapped[str | None] = mapped_column(String, nullable=True)
    error_summary: Mapped[str | None] = mapped_column(String, nullable=True)
    status: Mapped[IncidentStatus] = mapped_column(
        ENUM(IncidentStatus, name="incident_status", create_type=True),
        default=IncidentStatus.investigating,
        server_default=IncidentStatus.investigating.value,
        nullable=False,
    )
    root_cause_report: Mapped[str | None] = mapped_column(String, nullable=True)
    proposed_patch_diff: Mapped[str | None] = mapped_column(String, nullable=True)
    target_file_path: Mapped[str | None] = mapped_column(String, nullable=True)
    confidence_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    verifier_critique: Mapped[str | None] = mapped_column(String, nullable=True)
    human_feedback: Mapped[str | None] = mapped_column(String, nullable=True)
    github_pr_url: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    workspace: Mapped["Workspace"] = relationship(back_populates="incidents")  # type: ignore[name-defined]
    traces: Mapped[list["LlmTrace"]] = relationship(back_populates="incident")  # type: ignore[name-defined]
