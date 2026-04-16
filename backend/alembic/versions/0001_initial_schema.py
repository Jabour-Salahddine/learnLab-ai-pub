"""Initial schema — all tables

Revision ID: 0001
Revises:
Create Date: 2026-04-13

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── Enums ──────────────────────────────────────────────────────────────
    op.execute("CREATE TYPE user_role AS ENUM ('student', 'teacher')")
    op.execute("CREATE TYPE message_role AS ENUM ('user', 'assistant')")
    op.execute("CREATE TYPE rag_status AS ENUM ('pending', 'indexed', 'error')")

    # ── users ──────────────────────────────────────────────────────────────
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("email", sa.String(255), nullable=False, unique=True),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column(
            "role",
            postgresql.ENUM("student", "teacher", name="user_role", create_type=False),
            nullable=False,
        ),
        sa.Column("first_name", sa.String(100), nullable=False),
        sa.Column("last_name", sa.String(100), nullable=False),
        sa.Column("formation", sa.String(200)),
        sa.Column("filiere", sa.String(200)),
        sa.Column("year_of_study", sa.Integer()),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index("ix_users_email", "users", ["email"])

    # ── student_profiles ───────────────────────────────────────────────────
    op.create_table(
        "student_profiles",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "student_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
        sa.Column("niveau", sa.Integer(), nullable=False, server_default="1"),
        sa.Column(
            "concepts_maitrises",
            postgresql.ARRAY(sa.String()),
            nullable=False,
            server_default="{}",
        ),
        sa.Column(
            "points_faibles",
            postgresql.ARRAY(sa.String()),
            nullable=False,
            server_default="{}",
        ),
        sa.Column("vitesse_moyenne_min", sa.Float()),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index("ix_student_profiles_student_id", "student_profiles", ["student_id"])

    # ── invitation_codes ───────────────────────────────────────────────────
    op.create_table(
        "invitation_codes",
        sa.Column("code", sa.String(50), primary_key=True),
        sa.Column(
            "teacher_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("max_uses", sa.Integer(), nullable=False, server_default="100"),
        sa.Column("current_uses", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index("ix_invitation_codes_teacher_id", "invitation_codes", ["teacher_id"])

    # ── enrollments ────────────────────────────────────────────────────────
    op.create_table(
        "enrollments",
        sa.Column(
            "student_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "teacher_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("joined_via_code", sa.String(50)),
        sa.Column(
            "enrolled_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.UniqueConstraint("student_id", "teacher_id", name="uq_enrollment"),
    )

    # ── topics ─────────────────────────────────────────────────────────────
    op.create_table(
        "topics",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "teacher_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("title", sa.String(300), nullable=False),
        sa.Column("description", sa.Text()),
        sa.Column("domaine", sa.String(200)),
        sa.Column("niveau_min", sa.Integer(), nullable=False, server_default="1"),
        sa.Column(
            "tags",
            postgresql.ARRAY(sa.String()),
            nullable=False,
            server_default="{}",
        ),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index("ix_topics_teacher_id", "topics", ["teacher_id"])

    # ── generated_tps ──────────────────────────────────────────────────────
    op.create_table(
        "generated_tps",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "student_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "topic_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("topics.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "teacher_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("enonce", sa.Text()),
        sa.Column("starter_code", sa.Text()),
        sa.Column("tests_unitaires", postgresql.JSON()),
        sa.Column("hints_progressifs", postgresql.JSON()),
        sa.Column("solution_modele", sa.Text()),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index("ix_generated_tps_student_id", "generated_tps", ["student_id"])
    op.create_index("ix_generated_tps_topic_id", "generated_tps", ["topic_id"])
    op.create_index("ix_generated_tps_teacher_id", "generated_tps", ["teacher_id"])

    # ── submissions ────────────────────────────────────────────────────────
    op.create_table(
        "submissions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "student_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "tp_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("generated_tps.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "teacher_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("code", sa.Text()),
        sa.Column("stdout", sa.Text()),
        sa.Column("stderr", sa.Text()),
        sa.Column("exit_code", sa.Integer()),
        sa.Column("score", sa.Integer()),
        sa.Column("errors_json", postgresql.JSON()),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index("ix_submissions_student_id", "submissions", ["student_id"])
    op.create_index("ix_submissions_tp_id", "submissions", ["tp_id"])
    op.create_index("ix_submissions_teacher_id", "submissions", ["teacher_id"])

    # ── chat_messages ──────────────────────────────────────────────────────
    op.create_table(
        "chat_messages",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "student_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "tp_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("generated_tps.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "teacher_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "role",
            postgresql.ENUM(
                "user", "assistant", name="message_role", create_type=False
            ),
            nullable=False,
        ),
        sa.Column("agent_type", sa.String(50)),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index("ix_chat_messages_student_id", "chat_messages", ["student_id"])
    op.create_index("ix_chat_messages_tp_id", "chat_messages", ["tp_id"])

    # ── rag_documents ──────────────────────────────────────────────────────
    op.create_table(
        "rag_documents",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "teacher_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("filename", sa.String(300), nullable=False),
        sa.Column("file_type", sa.String(50)),
        sa.Column(
            "topic_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("topics.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("qdrant_collection", sa.String(200)),
        sa.Column("chunks_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "status",
            postgresql.ENUM(
                "pending", "indexed", "error", name="rag_status", create_type=False
            ),
            nullable=False,
            server_default="pending",
        ),
        sa.Column(
            "uploaded_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index("ix_rag_documents_teacher_id", "rag_documents", ["teacher_id"])
    op.create_index("ix_rag_documents_topic_id", "rag_documents", ["topic_id"])

    # ── reports ────────────────────────────────────────────────────────────
    op.create_table(
        "reports",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "student_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "teacher_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("period_start", sa.Date(), nullable=False),
        sa.Column("period_end", sa.Date(), nullable=False),
        sa.Column("content", sa.Text()),
        sa.Column("metrics_json", postgresql.JSON()),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index("ix_reports_student_id", "reports", ["student_id"])
    op.create_index("ix_reports_teacher_id", "reports", ["teacher_id"])


def downgrade() -> None:
    op.drop_table("reports")
    op.drop_table("rag_documents")
    op.drop_table("chat_messages")
    op.drop_table("submissions")
    op.drop_table("generated_tps")
    op.drop_table("topics")
    op.drop_table("enrollments")
    op.drop_table("invitation_codes")
    op.drop_table("student_profiles")
    op.drop_table("users")
    op.execute("DROP TYPE IF EXISTS rag_status")
    op.execute("DROP TYPE IF EXISTS message_role")
    op.execute("DROP TYPE IF EXISTS user_role")
