from __future__ import annotations
import uuid
import json

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.deps import get_db, get_current_user
from app.database import AsyncSessionLocal
from app.models.user import User
from app.models.subject import Subject
from app.models.recommendation_letter import RecommendationLetter, LetterTone
from app.schemas.letter import LetterGenerateRequest, LetterOut

router = APIRouter(prefix="/letters", tags=["letters"])
subjects_router = APIRouter(tags=["letters"])


@router.post("/generate")
async def generate_letter(
    body: LetterGenerateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> StreamingResponse:
    # Validate subject + tone before opening the stream
    subject_result = await db.execute(
        select(Subject).where(
            Subject.id == body.subject_id,
            Subject.org_id == current_user.org_id,
            Subject.archived_at.is_(None),
        )
    )
    if subject_result.scalar_one_or_none() is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subject not found")

    try:
        tone = LetterTone(body.tone)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=f"Invalid tone: {body.tone}"
        )

    subject_id = body.subject_id
    org_id = current_user.org_id
    user_id = current_user.id
    purpose = body.purpose
    additional_context = body.additional_context

    async def event_stream():
        # Use a dedicated session — the request-scoped session closes before streaming ends
        async with AsyncSessionLocal() as stream_db:
            from app.agents.letter_generation_agent import LetterGenerationAgent
            agent = LetterGenerationAgent(stream_db)

            entry_count = await agent.get_entry_count(subject_id, org_id)
            if entry_count < 3:
                warning = json.dumps({
                    "type": "warning",
                    "message": f"Only {entry_count} entries exist. Letter quality improves with more observations.",
                })
                yield f"data: {warning}\n\n"

            stream = await agent.generate(
                subject_id=subject_id,
                org_id=org_id,
                requesting_user_id=user_id,
                purpose=purpose,
                tone=tone,
                additional_context=additional_context,
            )
            async for chunk in stream:
                payload = json.dumps({"type": "chunk", "text": chunk})
                yield f"data: {payload}\n\n"

        yield f"data: {json.dumps({'type': 'done'})}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@router.get("/{letter_id}", response_model=LetterOut)
async def get_letter(
    letter_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> LetterOut:
    result = await db.execute(
        select(RecommendationLetter).where(
            RecommendationLetter.id == letter_id,
            RecommendationLetter.org_id == current_user.org_id,
        )
    )
    letter = result.scalar_one_or_none()
    if letter is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Letter not found")
    return _letter_out(letter)


@subjects_router.get("/subjects/{subject_id}/letters", response_model=list[LetterOut])
async def list_letters_for_subject(
    subject_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[LetterOut]:
    subject_result = await db.execute(
        select(Subject.id).where(
            Subject.id == subject_id,
            Subject.org_id == current_user.org_id,
            Subject.archived_at.is_(None),
        )
    )
    if subject_result.scalar_one_or_none() is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subject not found")

    result = await db.execute(
        select(RecommendationLetter).where(
            RecommendationLetter.subject_id == subject_id,
            RecommendationLetter.org_id == current_user.org_id,
        ).order_by(RecommendationLetter.created_at.desc())
    )
    return [_letter_out(l) for l in result.scalars().all()]


def _letter_out(letter: RecommendationLetter) -> LetterOut:
    return LetterOut(
        id=letter.id,
        subject_id=letter.subject_id,
        org_id=letter.org_id,
        requested_by_user_id=letter.requested_by_user_id,
        purpose=letter.purpose,
        tone=letter.tone.value,
        letter_text=letter.letter_text,
        grounding_entry_ids=letter.grounding_entry_ids or [],
        generation_metadata=letter.generation_metadata,
        created_at=letter.created_at,
    )
