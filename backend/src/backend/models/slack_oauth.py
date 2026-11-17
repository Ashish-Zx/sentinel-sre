from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import DateTime, String, func, text
from sqlalchemy.orm import Mapped, mapped_column

from backend.db.base import Base


class SlackOauthState(Base):
    """Tracks an in-flight Slack OAuth authorization for a Clerk user."""

    __tablename__ = "slack_oauth_states"

    state: Mapped[UUID] = mapped_column(
        primary_key=True, default=uuid4, server_default=text("gen_random_uuid()")
    )
    clerk_user_id: Mapped[str] = mapped_column(String, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
