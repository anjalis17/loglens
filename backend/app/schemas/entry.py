from __future__ import annotations
import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class EntryCreate(BaseModel):
    raw_text: str
    tags: list[str] = []


class EntryOut(BaseModel):
    id: uuid.UUID
    subject_id: uuid.UUID
    org_id: uuid.UUID
    author_user_id: uuid.UUID
    author_email: str
    content_type: str
    raw_text: Optional[str]
    tags: list[str]
    is_deleted: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class EntryPage(BaseModel):
    items: list[EntryOut]
    total: int
    page: int
    page_size: int
