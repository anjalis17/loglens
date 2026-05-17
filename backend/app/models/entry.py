import uuid
import enum
from datetime import datetime
from sqlalchemy import String, DateTime, ForeignKey, Enum, Boolean, Float, func, text
from sqlalchemy.dialects.postgresql import UUID, ARRAY
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .organization import Base


class ContentType(str, enum.Enum):
    text = "text"
    voice = "voice"


class TranscriptionStatus(str, enum.Enum):
    pending = "pending"
    complete = "complete"
    failed = "failed"


class Entry(Base):
    __tablename__ = "entries"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    subject_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("subjects.id"), nullable=False
    )
    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False, index=True
    )
    author_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    content_type: Mapped[ContentType] = mapped_column(
        Enum(ContentType), nullable=False, default=ContentType.text
    )
    raw_text: Mapped[str | None] = mapped_column(String, nullable=True)
    audio_file_path: Mapped[str | None] = mapped_column(String, nullable=True)
    audio_duration_seconds: Mapped[float | None] = mapped_column(Float, nullable=True)
    transcription_status: Mapped[TranscriptionStatus | None] = mapped_column(
        Enum(TranscriptionStatus), nullable=True
    )
    tags: Mapped[list[str]] = mapped_column(
        ARRAY(String), nullable=False, server_default=text("'{}'::text[]")
    )
    is_deleted: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    subject: Mapped["Subject"] = relationship("Subject", back_populates="entries")
    author: Mapped["User"] = relationship("User", back_populates="entries")
