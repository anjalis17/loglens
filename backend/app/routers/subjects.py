from __future__ import annotations
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.deps import get_db, get_current_user
from app.models.user import User
from app.models.subject import Subject
from app.models.entry import Entry
from app.models.subject_summary import SubjectSummary, DistillationStatus
from app.schemas.subject import SubjectCreate, SubjectListItem, SubjectOut, SubjectUpdate

router = APIRouter(prefix="/subjects", tags=["subjects"])


@router.get("", response_model=list[SubjectListItem])
async def list_subjects(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[SubjectListItem]:
    result = await db.execute(
        select(Subject).where(
            Subject.org_id == current_user.org_id,
            Subject.archived_at.is_(None),
        ).order_by(Subject.created_at.desc())
    )
    subjects = result.scalars().all()

    items = []
    for s in subjects:
        # entry count + last entry
        count_result = await db.execute(
            select(func.count(), func.max(Entry.created_at)).where(
                Entry.subject_id == s.id,
                Entry.org_id == current_user.org_id,
                Entry.is_deleted.is_(False),
            )
        )
        entry_count, last_entry_at = count_result.one()

        # summary status
        summary_result = await db.execute(
            select(SubjectSummary.distillation_status).where(
                SubjectSummary.subject_id == s.id,
                SubjectSummary.org_id == current_user.org_id,
            )
        )
        summary_status_row = summary_result.scalar_one_or_none()
        summary_status = summary_status_row.value if summary_status_row else None

        items.append(
            SubjectListItem(
                id=s.id,
                full_name=s.full_name,
                role_title=s.role_title,
                relationship_type=s.relationship_type,
                created_at=s.created_at,
                archived_at=s.archived_at,
                entry_count=entry_count or 0,
                last_entry_at=last_entry_at,
                summary_status=summary_status,
            )
        )
    return items


@router.post("", response_model=SubjectOut, status_code=status.HTTP_201_CREATED)
async def create_subject(
    body: SubjectCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SubjectOut:
    subject = Subject(
        org_id=current_user.org_id,
        created_by_user_id=current_user.id,
        full_name=body.full_name,
        role_title=body.role_title,
        relationship_type=body.relationship_type,
    )
    db.add(subject)
    await db.commit()
    await db.refresh(subject)
    return SubjectOut.model_validate(subject)


@router.get("/{subject_id}", response_model=SubjectOut)
async def get_subject(
    subject_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SubjectOut:
    subject = await _get_subject_or_404(db, subject_id, current_user.org_id)
    return SubjectOut.model_validate(subject)


@router.put("/{subject_id}", response_model=SubjectOut)
async def update_subject(
    subject_id: uuid.UUID,
    body: SubjectUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SubjectOut:
    subject = await _get_subject_or_404(db, subject_id, current_user.org_id)
    if body.full_name is not None:
        subject.full_name = body.full_name
    if body.role_title is not None:
        subject.role_title = body.role_title
    if body.relationship_type is not None:
        subject.relationship_type = body.relationship_type
    await db.commit()
    await db.refresh(subject)
    return SubjectOut.model_validate(subject)


@router.delete("/{subject_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_subject(
    subject_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Response:
    subject = await _get_subject_or_404(db, subject_id, current_user.org_id)
    subject.archived_at = datetime.now(timezone.utc)
    await db.commit()
    return Response(status_code=204)


async def _get_subject_or_404(
    db: AsyncSession, subject_id: uuid.UUID, org_id: uuid.UUID
) -> Subject:
    result = await db.execute(
        select(Subject).where(
            Subject.id == subject_id,
            Subject.org_id == org_id,
            Subject.archived_at.is_(None),
        )
    )
    subject = result.scalar_one_or_none()
    if subject is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subject not found")
    return subject
