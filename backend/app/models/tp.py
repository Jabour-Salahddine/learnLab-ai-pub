"""AI-generated TP instances (one per student per topic)."""

import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Text
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class GeneratedTP(Base):
    __tablename__ = "generated_tps"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    student_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    topic_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("topics.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    teacher_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    enonce: Mapped[str | None] = mapped_column(Text)
    starter_code: Mapped[str | None] = mapped_column(Text)
    tests_unitaires: Mapped[dict | None] = mapped_column(JSON)
    hints_progressifs: Mapped[dict | None] = mapped_column(JSON)
    solution_modele: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    student: Mapped["User"] = relationship(  # noqa: F821
        "User", foreign_keys=[student_id]
    )
    topic: Mapped["Topic"] = relationship("Topic", back_populates="generated_tps")  # noqa: F821
    teacher: Mapped["User"] = relationship(  # noqa: F821
        "User", foreign_keys=[teacher_id]
    )
    submissions: Mapped[list["Submission"]] = relationship(  # noqa: F821
        "Submission", back_populates="tp", lazy="select"
    )
    chat_messages: Mapped[list["ChatMessage"]] = relationship(  # noqa: F821
        "ChatMessage", back_populates="tp", lazy="select"
    )
