from __future__ import annotations
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.deps import get_db, get_current_user
from app.models.user import User
from app.models.subject import Subject
from app.models.entry import Entry, ContentType
from app.schemas.entry import EntryCreate, EntryOut, EntryPage

router = APIRouter(tags=["entries"])


@router.get("/subjects/{subject_id}/entries", response_model=EntryPage)
async def list_entries(
    subject_id: uuid.UUID,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> EntryPage:
    await _assert_subject_access(db, subject_id, current_user.org_id)

    offset = (page - 1) * page_size
    total_result = await db.execute(
        select(func.count()).where(
            Entry.subject_id == subject_id,
            Entry.org_id == current_user.org_id,
            Entry.is_deleted.is_(False),
        )
    )
    total = total_result.scalar_one()

    result = await db.execute(
        select(Entry, User.email).join(User, User.id == Entry.author_user_id).where(
            Entry.subject_id == subject_id,
            Entry.org_id == current_user.org_id,
            Entry.is_deleted.is_(False),
        ).order_by(Entry.created_at.desc()).offset(offset).limit(page_size)
    )
    rows = result.all()

    items = [
        EntryOut(
            id=e.id,
            subject_id=e.subject_id,
            org_id=e.org_id,
            author_user_id=e.author_user_id,
            author_email=email or "",
            content_type=e.content_type.value,
            raw_text=e.raw_text,
            tags=e.tags or [],
            is_deleted=e.is_deleted,
            created_at=e.created_at,
            updated_at=e.updated_at,
        )
        for e, email in rows
    ]
    return EntryPage(items=items, total=total, page=page, page_size=page_size)


@router.post(
    "/subjects/{subject_id}/entries",
    response_model=EntryOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_entry(
    subject_id: uuid.UUID,
    body: EntryCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> EntryOut:
    await _assert_subject_access(db, subject_id, current_user.org_id)

    entry = Entry(
        subject_id=subject_id,
        org_id=current_user.org_id,
        author_user_id=current_user.id,
        content_type=ContentType.text,
        raw_text=body.raw_text,
        tags=body.tags,
    )
    db.add(entry)
    await db.commit()
    await db.refresh(entry)

    background_tasks.add_task(
        _run_distillation_background,
        subject_id=subject_id,
        org_id=current_user.org_id,
    )

    return EntryOut(
        id=entry.id,
        subject_id=entry.subject_id,
        org_id=entry.org_id,
        author_user_id=entry.author_user_id,
        author_email=current_user.email,
        content_type=entry.content_type.value,
        raw_text=entry.raw_text,
        tags=entry.tags or [],
        is_deleted=entry.is_deleted,
        created_at=entry.created_at,
        updated_at=entry.updated_at,
    )


@router.delete("/entries/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_entry(
    entry_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Response:
    result = await db.execute(
        select(Entry).where(
            Entry.id == entry_id,
            Entry.org_id == current_user.org_id,
            Entry.is_deleted.is_(False),
        )
    )
    entry = result.scalar_one_or_none()
    if entry is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Entry not found")
    entry.is_deleted = True
    entry.updated_at = datetime.now(timezone.utc)
    await db.commit()
    return Response(status_code=204)


async def _assert_subject_access(
    db: AsyncSession, subject_id: uuid.UUID, org_id: uuid.UUID
) -> None:
    result = await db.execute(
        select(Subject.id).where(
            Subject.id == subject_id,
            Subject.org_id == org_id,
            Subject.archived_at.is_(None),
        )
    )
    if result.scalar_one_or_none() is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subject not found")


async def _run_distillation_background(subject_id: uuid.UUID, org_id: uuid.UUID) -> None:
    from app.agents.distillation_agent import DistillationAgent
    from app.database import AsyncSessionLocal
    async with AsyncSessionLocal() as db:
        agent = DistillationAgent(db)
        await agent.distill(subject_id=subject_id, org_id=org_id)
