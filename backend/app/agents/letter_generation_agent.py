"""
LetterGenerationAgent — stub implementation.

To swap in real Claude streaming, replace the body of _build_letter_text() with:
    client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
    prompt = _build_prompt(subject_name, entries, summary, purpose, tone, additional_context)
    full_text = ""
    async with client.messages.stream(
        model="claude-sonnet-4-20250514",
        max_tokens=2048,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": prompt}],
    ) as stream:
        async for chunk in stream.text_stream:
            full_text += chunk
            yield chunk
    return  # replace the stub yield below
"""
from __future__ import annotations
import uuid
import asyncio
from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.entry import Entry
from app.models.subject import Subject
from app.models.recommendation_letter import RecommendationLetter, LetterTone

SYSTEM_PROMPT = (
    "You are helping a supervisor write a recommendation letter for someone they have worked "
    "with closely. Write in the supervisor's voice. Do not invent anything not supported by the entries. "
    "Sound like a human wrote it — not an AI."
)


class LetterGenerationAgent:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def generate(
        self,
        subject_id: uuid.UUID,
        org_id: uuid.UUID,
        requesting_user_id: uuid.UUID,
        purpose: str,
        tone: LetterTone,
        additional_context: str | None = None,
    ) -> AsyncGenerator[str, None]:
        return self._stream(
            subject_id=subject_id,
            org_id=org_id,
            requesting_user_id=requesting_user_id,
            purpose=purpose,
            tone=tone,
            additional_context=additional_context,
        )

    async def _stream(
        self,
        subject_id: uuid.UUID,
        org_id: uuid.UUID,
        requesting_user_id: uuid.UUID,
        purpose: str,
        tone: LetterTone,
        additional_context: str | None,
    ) -> AsyncGenerator[str, None]:
        # Fetch subject name
        subject_result = await self.db.execute(
            select(Subject).where(Subject.id == subject_id, Subject.org_id == org_id)
        )
        subject = subject_result.scalar_one_or_none()
        subject_name = subject.full_name if subject else "this individual"
        first_name = subject_name.split()[0] if subject_name else "them"

        # Fetch all entries (oldest first for narrative order)
        entries_result = await self.db.execute(
            select(Entry).where(
                Entry.subject_id == subject_id,
                Entry.org_id == org_id,
                Entry.is_deleted.is_(False),
            ).order_by(Entry.created_at.asc())
        )
        entries = entries_result.scalars().all()
        entry_ids = [e.id for e in entries]
        entry_texts = [e.raw_text for e in entries if e.raw_text]

        # Create letter record before streaming
        letter = RecommendationLetter(
            subject_id=subject_id,
            org_id=org_id,
            requested_by_user_id=requesting_user_id,
            purpose=purpose,
            tone=tone,
            grounding_entry_ids=entry_ids,
            generation_metadata={"model": "stub", "prompt_version": "v0"},
        )
        self.db.add(letter)
        await self.db.commit()
        await self.db.refresh(letter)

        # STUB: build letter grounded in real entries and subject name
        # To go live: replace _build_letter_text() with real Claude streaming (~10 lines)
        full_text = _build_letter_text(
            subject_name=subject_name,
            first_name=first_name,
            entry_texts=entry_texts,
            purpose=purpose,
            tone=tone,
            additional_context=additional_context,
        )

        words = full_text.split(" ")
        full_text_parts: list[str] = []
        for i, word in enumerate(words):
            chunk = word if i == len(words) - 1 else word + " "
            full_text_parts.append(chunk)
            yield chunk
            await asyncio.sleep(0.03)

        letter.letter_text = "".join(full_text_parts)
        await self.db.commit()

    async def get_entry_count(self, subject_id: uuid.UUID, org_id: uuid.UUID) -> int:
        from sqlalchemy import func
        result = await self.db.execute(
            select(func.count()).where(
                Entry.subject_id == subject_id,
                Entry.org_id == org_id,
                Entry.is_deleted.is_(False),
            )
        )
        return result.scalar_one() or 0


def _build_letter_text(
    subject_name: str,
    first_name: str,
    entry_texts: list[str],
    purpose: str,
    tone: LetterTone,
    additional_context: str | None,
) -> str:
    """
    Stub letter grounded in real entry text and subject name.
    Replace this function with real Claude API streaming when the key arrives.
    """
    greeting = "To Whom It May Concern" if tone == LetterTone.formal else "Dear Selection Committee"

    # Opening paragraph
    opening = (
        f"It is my genuine pleasure to recommend {subject_name} for {purpose}. "
        f"I have had the privilege of working closely with {first_name} and have observed "
        f"their work firsthand over an extended period."
    )

    # Entry-grounded body paragraphs
    body_paragraphs: list[str] = []
    if entry_texts:
        body_paragraphs.append(
            f"What stands out most is what I have seen directly. "
            + entry_texts[0]
        )
    if len(entry_texts) > 1:
        body_paragraphs.append(
            f"This was not an isolated moment. "
            + entry_texts[1]
        )
    if len(entry_texts) > 2:
        body_paragraphs.append(
            "Across many interactions, a consistent picture has emerged. "
            + " ".join(entry_texts[2:])
        )

    if not body_paragraphs:
        body_paragraphs.append(
            f"Though my direct observations are still accumulating, what I have seen of "
            f"{first_name} already speaks clearly to their character and capability."
        )

    # Additional context from requester
    if additional_context:
        body_paragraphs.append(additional_context)

    # Closing
    closing = (
        f"I recommend {subject_name} without reservation. "
        f"You will be fortunate to have them."
    )

    sign_off = "Sincerely" if tone == LetterTone.formal else "Warmly"

    paragraphs = [greeting + ",", "", opening, ""] + \
                 [p + "\n" for p in body_paragraphs] + \
                 ["", closing, "", sign_off + ",", "[Your Name]"]

    return "\n".join(paragraphs)
