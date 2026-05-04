"""Add visible_to_students column to rag_documents.

Revision ID: 001
Revises:
Create Date: 2025-05-03
"""

from alembic import op
import sqlalchemy as sa

revision = "001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "rag_documents",
        sa.Column(
            "visible_to_students",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )


def downgrade() -> None:
    op.drop_column("rag_documents", "visible_to_students")
