from __future__ import annotations
import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class SubjectCreate(BaseModel):
    full_name: str
    role_title: Optional[str] = None
    relationship_type: str


class SubjectUpdate(BaseModel):
    full_name: Optional[str] = None
    role_title: Optional[str] = None
    relationship_type: Optional[str] = None


class SubjectOut(BaseModel):
    id: uuid.UUID
    org_id: uuid.UUID
    created_by_user_id: uuid.UUID
    full_name: str
    role_title: Optional[str]
    relationship_type: str
    created_at: datetime
    archived_at: Optional[datetime]

    model_config = {"from_attributes": True}


class SubjectListItem(BaseModel):
    id: uuid.UUID
    full_name: str
    role_title: Optional[str]
    relationship_type: str
    created_at: datetime
    archived_at: Optional[datetime]
    entry_count: int
    last_entry_at: Optional[datetime]
    summary_status: Optional[str]  # "fresh" | "stale" | "pending" | None

    model_config = {"from_attributes": True}
