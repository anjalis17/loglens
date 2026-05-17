import uuid
from datetime import datetime
from sqlalchemy import String, DateTime, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .organization import Base


class Subject(Base):
    __tablename__ = "subjects"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False, index=True
    )
    created_by_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    full_name: Mapped[str] = mapped_column(String, nullable=False)
    role_title: Mapped[str | None] = mapped_column(String, nullable=True)
    relationship_type: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    archived_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    organization: Mapped["Organization"] = relationship(
        "Organization", back_populates="subjects"
    )
    created_by: Mapped["User"] = relationship("User", foreign_keys=[created_by_user_id])
    entries: Mapped[list["Entry"]] = relationship("Entry", back_populates="subject")
    summary: Mapped["SubjectSummary | None"] = relationship(
        "SubjectSummary", back_populates="subject", uselist=False
    )
    letters: Mapped[list["RecommendationLetter"]] = relationship(
        "RecommendationLetter", back_populates="subject"
    )
