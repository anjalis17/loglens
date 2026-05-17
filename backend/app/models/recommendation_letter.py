import uuid
import enum
from datetime import datetime
from sqlalchemy import String, DateTime, ForeignKey, Enum, Text, func
from sqlalchemy.dialects.postgresql import UUID, JSONB, ARRAY
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .organization import Base


class LetterTone(str, enum.Enum):
    formal = "formal"
    warm = "warm"
    balanced = "balanced"


class RecommendationLetter(Base):
    __tablename__ = "recommendation_letters"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    subject_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("subjects.id"), nullable=False, index=True
    )
    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False, index=True
    )
    requested_by_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    purpose: Mapped[str] = mapped_column(String, nullable=False)
    tone: Mapped[LetterTone] = mapped_column(Enum(LetterTone), nullable=False)
    letter_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    grounding_entry_ids: Mapped[list[uuid.UUID]] = mapped_column(
        ARRAY(UUID(as_uuid=True)), nullable=False, default=list
    )
    generation_metadata: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    subject: Mapped["Subject"] = relationship("Subject", back_populates="letters")
    requested_by: Mapped["User"] = relationship(
        "User", foreign_keys=[requested_by_user_id]
    )
