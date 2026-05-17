import uuid
import enum
from datetime import datetime
from sqlalchemy import DateTime, ForeignKey, Enum, Integer, Text, func
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .organization import Base


class DistillationStatus(str, enum.Enum):
    pending = "pending"
    complete = "complete"
    failed = "failed"
    stale = "stale"


class SubjectSummary(Base):
    __tablename__ = "subject_summaries"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    subject_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("subjects.id"),
        unique=True,
        nullable=False,
        index=True,
    )
    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False, index=True
    )
    structured_summary: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    plain_text_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    last_distilled_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    distillation_version: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    entry_count_at_distillation: Mapped[int | None] = mapped_column(
        Integer, nullable=True
    )
    distillation_status: Mapped[DistillationStatus] = mapped_column(
        Enum(DistillationStatus),
        nullable=False,
        default=DistillationStatus.pending,
    )

    subject: Mapped["Subject"] = relationship("Subject", back_populates="summary")
