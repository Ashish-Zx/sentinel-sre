from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import DateTime, String, func, text
from sqlalchemy.orm import Mapped, mapped_column

from backend.db.base import Base


class GithubOauthState(Base):
    """Tracks an in-flight GitHub OAuth authorization for a Clerk user.

    GitHub redirects the browser back to our callback without the Clerk JWT,
    so we correlate the callback to the user via a server-side `state` token.
    """

    __tablename__ = "github_oauth_states"

    state: Mapped[UUID] = mapped_column(
        primary_key=True, default=uuid4, server_default=text("gen_random_uuid()")
    )
    clerk_user_id: Mapped[str] = mapped_column(String, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
