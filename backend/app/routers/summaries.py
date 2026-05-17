from __future__ import annotations
import uuid

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.deps import get_db, get_current_user
from app.models.user import User
from app.models.subject import Subject
from app.models.subject_summary import SubjectSummary
from app.schemas.summary import SummaryOut

router = APIRouter(tags=["summaries"])


@router.get("/subjects/{subject_id}/summary", response_model=SummaryOut)
async def get_summary(
    subject_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SummaryOut:
    await _assert_subject_access(db, subject_id, current_user.org_id)

    result = await db.execute(
        select(SubjectSummary).where(
            SubjectSummary.subject_id == subject_id,
            SubjectSummary.org_id == current_user.org_id,
        )
    )
    summary = result.scalar_one_or_none()
    if summary is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No summary yet")

    return SummaryOut(
        id=summary.id,
        subject_id=summary.subject_id,
        org_id=summary.org_id,
        structured_summary=summary.structured_summary,
        plain_text_summary=summary.plain_text_summary,
        last_distilled_at=summary.last_distilled_at,
        distillation_version=summary.distillation_version,
        entry_count_at_distillation=summary.entry_count_at_distillation,
        distillation_status=summary.distillation_status.value,
    )


@router.post("/subjects/{subject_id}/summary/refresh", response_model=SummaryOut)
async def refresh_summary(
    subject_id: uuid.UUID,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SummaryOut:
    await _assert_subject_access(db, subject_id, current_user.org_id)

    background_tasks.add_task(
        _run_distillation_background,
        subject_id=subject_id,
        org_id=current_user.org_id,
        force_refresh=True,
    )

    # Return current summary (or 404 if none exists yet)
    result = await db.execute(
        select(SubjectSummary).where(
            SubjectSummary.subject_id == subject_id,
            SubjectSummary.org_id == current_user.org_id,
        )
    )
    summary = result.scalar_one_or_none()
    if summary is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No summary yet — check back shortly")

    return SummaryOut(
        id=summary.id,
        subject_id=summary.subject_id,
        org_id=summary.org_id,
        structured_summary=summary.structured_summary,
        plain_text_summary=summary.plain_text_summary,
        last_distilled_at=summary.last_distilled_at,
        distillation_version=summary.distillation_version,
        entry_count_at_distillation=summary.entry_count_at_distillation,
        distillation_status=summary.distillation_status.value,
    )


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


async def _run_distillation_background(
    subject_id: uuid.UUID, org_id: uuid.UUID, force_refresh: bool = False
) -> None:
    from app.agents.distillation_agent import DistillationAgent
    from app.database import AsyncSessionLocal
    async with AsyncSessionLocal() as db:
        agent = DistillationAgent(db)
        await agent.distill(subject_id=subject_id, org_id=org_id, force_refresh=force_refresh)
