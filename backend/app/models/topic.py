"""TP topics created by teachers."""

import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Topic(Base):
    __tablename__ = "topics"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    teacher_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    domaine: Mapped[str | None] = mapped_column(String(200))
    niveau_min: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    tags: Mapped[list[str]] = mapped_column(
        ARRAY(String), default=list, nullable=False, server_default="{}"
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    teacher: Mapped["User"] = relationship("User", back_populates="topics")  # noqa: F821
    generated_tps: Mapped[list["GeneratedTP"]] = relationship(  # noqa: F821
        "GeneratedTP", back_populates="topic", lazy="select"
    )
    rag_documents: Mapped[list["RagDocument"]] = relationship(  # noqa: F821
        "RagDocument", back_populates="topic", lazy="select"
    )
