"""initial schema

Revision ID: 0001
Revises:
Create Date: 2026-05-17
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB, ARRAY

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "organizations",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )

    op.create_table(
        "users",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("email", sa.String(), nullable=False, unique=True),
        sa.Column("hashed_password", sa.String(), nullable=False),
        sa.Column("org_id", UUID(as_uuid=True), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column(
            "role",
            sa.Enum("admin", "member", name="userrole"),
            nullable=False,
            server_default="member",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)
    op.create_index("ix_users_org_id", "users", ["org_id"])

    op.create_table(
        "subjects",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("org_id", UUID(as_uuid=True), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("created_by_user_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("full_name", sa.String(), nullable=False),
        sa.Column("role_title", sa.String(), nullable=True),
        sa.Column("relationship_type", sa.String(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_subjects_org_id", "subjects", ["org_id"])

    op.create_table(
        "entries",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("subject_id", UUID(as_uuid=True), sa.ForeignKey("subjects.id"), nullable=False),
        sa.Column("org_id", UUID(as_uuid=True), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("author_user_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column(
            "content_type",
            sa.Enum("text", "voice", name="contenttype"),
            nullable=False,
            server_default="text",
        ),
        sa.Column("raw_text", sa.String(), nullable=True),
        sa.Column("audio_file_path", sa.String(), nullable=True),
        sa.Column("audio_duration_seconds", sa.Float(), nullable=True),
        sa.Column(
            "transcription_status",
            sa.Enum("pending", "complete", "failed", name="transcriptionstatus"),
            nullable=True,
        ),
        sa.Column(
            "tags",
            ARRAY(sa.String()),
            nullable=False,
            server_default=sa.text("'{}'::text[]"),
        ),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index("ix_entries_org_id_subject_id", "entries", ["org_id", "subject_id"])

    op.create_table(
        "subject_summaries",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "subject_id",
            UUID(as_uuid=True),
            sa.ForeignKey("subjects.id"),
            unique=True,
            nullable=False,
        ),
        sa.Column("org_id", UUID(as_uuid=True), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("structured_summary", JSONB, nullable=True),
        sa.Column("plain_text_summary", sa.Text(), nullable=True),
        sa.Column("last_distilled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("distillation_version", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("entry_count_at_distillation", sa.Integer(), nullable=True),
        sa.Column(
            "distillation_status",
            sa.Enum("pending", "complete", "failed", "stale", name="distillationstatus"),
            nullable=False,
            server_default="pending",
        ),
    )
    op.create_index("ix_subject_summaries_org_id", "subject_summaries", ["org_id"])
    op.create_index("ix_subject_summaries_subject_id", "subject_summaries", ["subject_id"], unique=True)

    op.create_table(
        "recommendation_letters",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("subject_id", UUID(as_uuid=True), sa.ForeignKey("subjects.id"), nullable=False),
        sa.Column("org_id", UUID(as_uuid=True), sa.ForeignKey("organizations.id"), nullable=False),
        sa.Column("requested_by_user_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("purpose", sa.String(), nullable=False),
        sa.Column(
            "tone",
            sa.Enum("formal", "warm", "balanced", name="lettertone"),
            nullable=False,
        ),
        sa.Column("letter_text", sa.Text(), nullable=True),
        sa.Column(
            "grounding_entry_ids",
            ARRAY(UUID(as_uuid=True)),
            nullable=False,
            server_default=sa.text("'{}'::uuid[]"),
        ),
        sa.Column("generation_metadata", JSONB, nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index("ix_recommendation_letters_org_id", "recommendation_letters", ["org_id"])
    op.create_index("ix_recommendation_letters_subject_id", "recommendation_letters", ["subject_id"])


def downgrade() -> None:
    op.drop_table("recommendation_letters")
    op.drop_table("subject_summaries")
    op.drop_table("entries")
    op.drop_table("subjects")
    op.drop_table("users")
    op.drop_table("organizations")
    op.execute("DROP TYPE IF EXISTS lettertone")
    op.execute("DROP TYPE IF EXISTS distillationstatus")
    op.execute("DROP TYPE IF EXISTS transcriptionstatus")
    op.execute("DROP TYPE IF EXISTS contenttype")
    op.execute("DROP TYPE IF EXISTS userrole")
