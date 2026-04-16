"""User ORM model — covers both students and teachers."""

import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, Enum, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class UserRole(str):
    STUDENT = "student"
    TEACHER = "teacher"


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(
        Enum("student", "teacher", name="user_role"), nullable=False
    )
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    formation: Mapped[str | None] = mapped_column(String(200))
    filiere: Mapped[str | None] = mapped_column(String(200))
    year_of_study: Mapped[int | None] = mapped_column()
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    student_profile: Mapped["StudentProfile"] = relationship(  # noqa: F821
        "StudentProfile", back_populates="student", uselist=False, lazy="select"
    )
    enrollments_as_student: Mapped[list["StudentEnrollment"]] = relationship(  # noqa: F821
        "StudentEnrollment",
        foreign_keys="StudentEnrollment.student_id",
        back_populates="student",
        lazy="select",
    )
    enrollments_as_teacher: Mapped[list["StudentEnrollment"]] = relationship(  # noqa: F821
        "StudentEnrollment",
        foreign_keys="StudentEnrollment.teacher_id",
        back_populates="teacher",
        lazy="select",
    )
    invitation_codes: Mapped[list["InvitationCode"]] = relationship(  # noqa: F821
        "InvitationCode", back_populates="teacher", lazy="select"
    )
    topics: Mapped[list["Topic"]] = relationship(  # noqa: F821
        "Topic", back_populates="teacher", lazy="select"
    )
