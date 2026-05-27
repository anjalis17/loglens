from __future__ import annotations
import uuid
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
        from openai import AsyncOpenAI
        from app.config import settings

        subject_result = await self.db.execute(
            select(Subject).where(Subject.id == subject_id, Subject.org_id == org_id)
        )
        subject = subject_result.scalar_one_or_none()
        subject_name = subject.full_name if subject else "this individual"

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

        letter = RecommendationLetter(
            subject_id=subject_id,
            org_id=org_id,
            requested_by_user_id=requesting_user_id,
            purpose=purpose,
            tone=tone,
            grounding_entry_ids=entry_ids,
            generation_metadata={"model": settings.openrouter_model, "prompt_version": "v1"},
        )
        self.db.add(letter)
        await self.db.commit()
        await self.db.refresh(letter)

        client = AsyncOpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key=settings.openrouter_api_key,
        )

        prompt = _build_prompt(subject_name, entry_texts, purpose, tone, additional_context)

        stream = await client.chat.completions.create(
            model=settings.openrouter_model,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": prompt},
            ],
            stream=True,
            extra_headers={"HTTP-Referer": "https://loglens.local", "X-Title": "LogLens"},
        )

        full_text_parts: list[str] = []
        async for chunk in stream:
            delta = chunk.choices[0].delta.content
            if delta:
                full_text_parts.append(delta)
                yield delta

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


def _build_prompt(
    subject_name: str,
    entry_texts: list[str],
    purpose: str,
    tone: LetterTone,
    additional_context: str | None,
) -> str:
    tone_desc = {
        LetterTone.formal: "formal and professional",
        LetterTone.warm: "warm and personal",
        LetterTone.balanced: "balanced — professional but personable",
    }.get(tone, "professional")

    if entry_texts:
        entries_block = "\n\n".join(
            f"[Observation {i + 1}]\n{text}" for i, text in enumerate(entry_texts)
        )
    else:
        entries_block = "No specific observations have been logged yet."

    context_section = (
        f"\n\nAdditional context from the recommender:\n{additional_context}"
        if additional_context
        else ""
    )

    return (
        f"Write a recommendation letter for {subject_name} for the following purpose: {purpose}.\n\n"
        f"Tone: {tone_desc}\n\n"
        f"Observations logged by the recommender over time:\n{entries_block}"
        f"{context_section}\n\n"
        "Write the complete letter, from salutation to sign-off. "
        "Use a human voice. Every specific claim must be grounded in the observations above."
    )
