from __future__ import annotations
import os
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, Query, Response, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.deps import get_db, get_current_user
from app.models.user import User
from app.models.subject import Subject
from app.models.entry import Entry, ContentType, TranscriptionStatus
from app.schemas.entry import EntryCreate, EntryOut, EntryPage

router = APIRouter(tags=["entries"])


def _audio_url(entry: Entry) -> str | None:
    return f"/entries/{entry.id}/audio" if entry.audio_file_path else None


@router.get("/subjects/{subject_id}/entries", response_model=EntryPage)
async def list_entries(
    subject_id: uuid.UUID,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=500),
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
            audio_url=_audio_url(e),
            transcription_status=e.transcription_status.value if e.transcription_status else None,
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
        audio_url=None,
        transcription_status=None,
        tags=entry.tags or [],
        is_deleted=entry.is_deleted,
        created_at=entry.created_at,
        updated_at=entry.updated_at,
    )


@router.post(
    "/subjects/{subject_id}/entries/voice",
    response_model=EntryOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_voice_entry(
    subject_id: uuid.UUID,
    background_tasks: BackgroundTasks,
    audio: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> EntryOut:
    await _assert_subject_access(db, subject_id, current_user.org_id)

    audio_dir = "/app/audio_uploads"
    os.makedirs(audio_dir, exist_ok=True)
    ext = os.path.splitext(audio.filename or "")[1] or ".wav"
    audio_path = f"{audio_dir}/{uuid.uuid4()}{ext}"
    content = await audio.read()
    with open(audio_path, "wb") as f:
        f.write(content)

    entry = Entry(
        subject_id=subject_id,
        org_id=current_user.org_id,
        author_user_id=current_user.id,
        content_type=ContentType.voice,
        audio_file_path=audio_path,
        transcription_status=TranscriptionStatus.pending,
        tags=[],
    )
    db.add(entry)
    await db.commit()
    await db.refresh(entry)

    background_tasks.add_task(
        _run_transcription_and_distillation,
        entry_id=entry.id,
        audio_path=audio_path,
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
        audio_url=_audio_url(entry),
        transcription_status=entry.transcription_status.value,
        tags=entry.tags or [],
        is_deleted=entry.is_deleted,
        created_at=entry.created_at,
        updated_at=entry.updated_at,
    )


@router.get("/entries/{entry_id}/audio")
async def get_entry_audio(
    entry_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> FileResponse:
    # No auth required: <audio> elements can't send JWT headers.
    # UUID-based routing is sufficient for this local deployment.
    result = await db.execute(
        select(Entry).where(
            Entry.id == entry_id,
            Entry.content_type == ContentType.voice,
            Entry.is_deleted.is_(False),
        )
    )
    entry = result.scalar_one_or_none()
    if entry is None or not entry.audio_file_path:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Audio not found")
    if not os.path.exists(entry.audio_file_path):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Audio file not found on disk")
    ext = os.path.splitext(entry.audio_file_path)[1].lstrip(".").lower()
    media_type_map = {"mp3": "audio/mpeg", "m4a": "audio/mp4", "wav": "audio/wav", "webm": "audio/webm", "ogg": "audio/ogg"}
    media_type = media_type_map.get(ext, "audio/mpeg")
    return FileResponse(entry.audio_file_path, media_type=media_type)


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


async def _run_transcription_and_distillation(
    entry_id: uuid.UUID,
    audio_path: str,
    subject_id: uuid.UUID,
    org_id: uuid.UUID,
) -> None:
    from app.agents.transcription_agent import TranscriptionAgent
    from app.agents.distillation_agent import DistillationAgent
    from app.database import AsyncSessionLocal

    async with AsyncSessionLocal() as db:
        agent = TranscriptionAgent()
        try:
            text = await agent.transcribe(audio_path)
            result = await db.execute(select(Entry).where(Entry.id == entry_id))
            entry = result.scalar_one()
            entry.raw_text = text
            entry.transcription_status = TranscriptionStatus.complete
            await db.commit()
        except Exception:
            result = await db.execute(select(Entry).where(Entry.id == entry_id))
            entry = result.scalar_one_or_none()
            if entry:
                entry.transcription_status = TranscriptionStatus.failed
                await db.commit()
            return

        distill_agent = DistillationAgent(db)
        await distill_agent.distill(subject_id=subject_id, org_id=org_id)
