from __future__ import annotations
import json
import re
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

        entries_result = await self.db.execute(
            select(Entry).where(
                Entry.subject_id == subject_id,
                Entry.org_id == org_id,
                Entry.is_deleted.is_(False),
            ).order_by(Entry.created_at.asc())
        )
        entries = entries_result.scalars().all()
        entries_with_text = [e for e in entries if e.raw_text]
        # 1-based index matches [Entry N] labels sent to the LLM
        entry_id_map = {i + 1: str(e.id) for i, e in enumerate(entries_with_text)}

        structured = await self._call_llm(
            entry_texts=[e.raw_text for e in entries_with_text],
            entry_count=entry_count,
            earliest=earliest,
            latest=latest,
        )

        # Resolve entry_index / entry_indices → entry_ids so the frontend can do direct lookups
        for trait in structured.get("core_traits", []):
            for ev in trait.get("evidence", []):
                if isinstance(ev, dict):
                    idx = ev.get("entry_index")
                    ev["entry_id"] = entry_id_map.get(idx) if idx else None

        for caution in structured.get("cautions", []):
            if isinstance(caution, dict):
                caution["entry_ids"] = [
                    entry_id_map[idx]
                    for idx in caution.get("entry_indices", [])
                    if idx in entry_id_map
                ]

        for ep in structured.get("notable_episodes", []):
            if isinstance(ep, dict):
                idx = ep.get("entry_index")
                ep["entry_id"] = entry_id_map.get(idx) if idx else None

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
        from openai import AsyncOpenAI
        from app.config import settings

        base_metadata = {
            "raw_entry_count": entry_count,
            "date_range": {
                "earliest": earliest.isoformat() if earliest else "",
                "latest": latest.isoformat() if latest else "",
            },
        }

        if not entry_texts:
            return {
                "core_traits": [{"trait": "No observations yet", "evidence": []}],
                "notable_episodes": [],
                "growth_arc": "No entries logged yet.",
                "relationship_texture": "No observations recorded.",
                "cautions": [],
                **base_metadata,
            }

        client = AsyncOpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key=settings.openrouter_api_key,
        )

        entries_block = "\n\n".join(
            f"[Entry {i + 1}]\n{text}" for i, text in enumerate(entry_texts)
        )

        n = len(entry_texts)
        prompt = (
            f"Synthesize the following {entry_count} observational log entries into a structured summary.\n\n"
            f"ENTRIES:\n{entries_block}\n\n"
            "Return ONLY valid JSON with this exact structure:\n"
            "{\n"
            '  "core_traits": [\n'
            '    {"trait": "string", "evidence": [{"text": "string", "entry_index": integer}]}\n'
            '  ],\n'
            '  "notable_episodes": [{"title": "string", "description": "string", "date_approx": "string", "qualities_demonstrated": ["string"], "entry_index": integer}],\n'
            '  "growth_arc": "string",\n'
            '  "relationship_texture": "string",\n'
            '  "cautions": [{"text": "string", "entry_indices": [integer]}]\n'
            "}\n\n"
            "Rules:\n"
            "- Ground every claim directly in the entries. Do not invent details.\n"
            f"- EVIDENCE IS EXHAUSTIVE: for each core trait, you MUST check every one of the {n} entries in\n"
            "  order (Entry 1 through Entry N) and add it to evidence if it demonstrates the trait at all —\n"
            "  even partially or indirectly. Do not stop after a few examples. A trait's evidence list should\n"
            "  typically contain most of the entries. The only reason to omit an entry is if it has zero\n"
            "  relevance to the trait.\n"
            "- Each evidence item: {\"text\": \"<highlight>\", \"entry_index\": N} — N is the 1-based index\n"
            "  from [Entry N] above. Text: 8–12 words, active statement, e.g.\n"
            "  'Took full ownership of the barbecue when others stepped back.'\n"
            "- notable_episodes: each episode MUST include \"entry_index\": N pointing to the single entry\n"
            "  that best represents this episode. Use the same 1-based [Entry N] index.\n"
            "- notable_episodes description: 1-2 sentences, specific and concrete.\n"
            "- Each caution: {\"text\": \"<one sentence>\", \"entry_indices\": [N, ...]} — list every entry\n"
            "  that shows this behavior. Only include a caution directly observable in the entries."
        )

        response = await client.chat.completions.create(
            model=settings.openrouter_model,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": prompt},
            ],
            extra_headers={"HTTP-Referer": "https://loglens.local", "X-Title": "LogLens"},
        )

        raw = response.choices[0].message.content or "{}"
        structured = json.loads(_strip_fences(raw))
        structured.update(base_metadata)
        return structured

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


def _strip_fences(text: str) -> str:
    """Remove markdown code fences that some models wrap JSON in."""
    text = text.strip()
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    return text.strip()
