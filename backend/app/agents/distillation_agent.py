"""
DistillationAgent — stub implementation.

To swap in real Claude calls, replace the body of _call_llm() with:
    client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
    message = await client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=4096,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": prompt}],
    )
    return json.loads(message.content[0].text)
"""
from __future__ import annotations
import uuid
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.models.entry import Entry
from app.models.subject_summary import SubjectSummary, DistillationStatus

SYSTEM_PROMPT = (
    "You are an expert at synthesizing longitudinal observational records into structured, "
    "evidence-grounded summaries. Return ONLY valid JSON matching the provided schema. "
    "No preamble, no explanation, no markdown fences."
)


class DistillationAgent:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def distill(
        self,
        subject_id: uuid.UUID,
        org_id: uuid.UUID,
        force_refresh: bool = False,
    ) -> SubjectSummary:
        count_result = await self.db.execute(
            select(func.count(), func.min(Entry.created_at), func.max(Entry.created_at)).where(
                Entry.subject_id == subject_id,
                Entry.org_id == org_id,
                Entry.is_deleted.is_(False),
            )
        )
        entry_count, earliest, latest = count_result.one()
        entry_count = entry_count or 0

        summary_result = await self.db.execute(
            select(SubjectSummary).where(
                SubjectSummary.subject_id == subject_id,
                SubjectSummary.org_id == org_id,
            )
        )
        existing = summary_result.scalar_one_or_none()

        if (
            not force_refresh
            and existing
            and existing.entry_count_at_distillation == entry_count
            and existing.distillation_status == DistillationStatus.complete
        ):
            return existing

        # Fetch actual entry texts to ground the stub summary
        entries_result = await self.db.execute(
            select(Entry).where(
                Entry.subject_id == subject_id,
                Entry.org_id == org_id,
                Entry.is_deleted.is_(False),
            ).order_by(Entry.created_at.asc())
        )
        entries = entries_result.scalars().all()
        entry_texts = [e.raw_text for e in entries if e.raw_text]

        structured = await self._call_llm(
            entry_texts=entry_texts,
            entry_count=entry_count,
            earliest=earliest,
            latest=latest,
        )

        plain_text = self._render_plain_text(structured)

        if existing is None:
            summary = SubjectSummary(
                subject_id=subject_id,
                org_id=org_id,
                structured_summary=structured,
                plain_text_summary=plain_text,
                last_distilled_at=datetime.now(timezone.utc),
                distillation_version=1,
                entry_count_at_distillation=entry_count,
                distillation_status=DistillationStatus.complete,
            )
            self.db.add(summary)
        else:
            existing.structured_summary = structured
            existing.plain_text_summary = plain_text
            existing.last_distilled_at = datetime.now(timezone.utc)
            existing.distillation_version += 1
            existing.entry_count_at_distillation = entry_count
            existing.distillation_status = DistillationStatus.complete
            summary = existing

        await self.db.commit()
        await self.db.refresh(summary)
        return summary

    async def _call_llm(
        self,
        entry_texts: list[str],
        entry_count: int,
        earliest: datetime | None,
        latest: datetime | None,
    ) -> dict:
        # STUB: build a summary grounded in actual entry text.
        # To go live: replace this with a real Claude API call (~5 lines).
        core_traits = _extract_traits_from_entries(entry_texts)
        notable_episodes = _extract_episodes_from_entries(entry_texts)

        return {
            "core_traits": core_traits,
            "notable_episodes": notable_episodes,
            "growth_arc": (
                f"Based on {entry_count} observations so far, a consistent picture is emerging. "
                "When the Claude API key is added, this will be a rich narrative drawn directly "
                "from your logged entries."
            ),
            "relationship_texture": (
                "Your logged entries capture the day-to-day texture of this relationship. "
                "The full AI summary will synthesize patterns across all of them."
            ),
            "cautions": [],
            "raw_entry_count": entry_count,
            "date_range": {
                "earliest": earliest.isoformat() if earliest else "",
                "latest": latest.isoformat() if latest else "",
            },
        }

    def _render_plain_text(self, structured: dict) -> str:
        lines = []
        for trait_item in structured.get("core_traits", []):
            lines.append(f"Trait: {trait_item['trait']}")
            for ev in trait_item.get("evidence", []):
                lines.append(f"  - {ev}")
        lines.append("")
        for ep in structured.get("notable_episodes", []):
            lines.append(f"Episode: {ep['title']} ({ep.get('date_approx', '')})")
            lines.append(f"  {ep['description']}")
        lines.append("")
        if structured.get("growth_arc"):
            lines.append(f"Growth arc: {structured['growth_arc']}")
        if structured.get("relationship_texture"):
            lines.append(f"Relationship: {structured['relationship_texture']}")
        return "\n".join(lines)


def _extract_traits_from_entries(entry_texts: list[str]) -> list[dict]:
    """Pull each entry directly as evidence — no inference, no invention."""
    if not entry_texts:
        return [{"trait": "Observations pending", "evidence": ["No entries logged yet."]}]

    return [
        {
            "trait": "Observed behaviors (from your logs)",
            "evidence": entry_texts,
        }
    ]


def _extract_episodes_from_entries(entry_texts: list[str]) -> list[dict]:
    """Surface each entry as a notable episode card."""
    episodes = []
    for i, text in enumerate(entry_texts[:5]):  # show up to 5
        episodes.append({
            "title": f"Entry {i + 1}",
            "description": text,
            "date_approx": "",
            "qualities_demonstrated": [],
        })
    return episodes
