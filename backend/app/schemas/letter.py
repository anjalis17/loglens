from __future__ import annotations
import uuid
from datetime import datetime
from typing import Optional, Any
from pydantic import BaseModel


class LetterGenerateRequest(BaseModel):
    subject_id: uuid.UUID
    purpose: str
    tone: str  # formal | warm | balanced
    additional_context: Optional[str] = None


class LetterOut(BaseModel):
    id: uuid.UUID
    subject_id: uuid.UUID
    org_id: uuid.UUID
    requested_by_user_id: uuid.UUID
    purpose: str
    tone: str
    letter_text: Optional[str]
    grounding_entry_ids: list[uuid.UUID]
    generation_metadata: Optional[Any]
    created_at: datetime

    model_config = {"from_attributes": True}
