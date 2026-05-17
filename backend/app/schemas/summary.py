from __future__ import annotations
import uuid
from datetime import datetime
from typing import Optional, Any
from pydantic import BaseModel


class SummaryOut(BaseModel):
    id: uuid.UUID
    subject_id: uuid.UUID
    org_id: uuid.UUID
    structured_summary: Optional[Any]
    plain_text_summary: Optional[str]
    last_distilled_at: Optional[datetime]
    distillation_version: int
    entry_count_at_distillation: Optional[int]
    distillation_status: str

    model_config = {"from_attributes": True}
