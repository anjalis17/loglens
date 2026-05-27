# LogLens — CLAUDE.md

AI-driven longitudinal feedback platform. CS 153 final project (Stanford, Spring 2026).
Local-only MVP: everything runs in Docker Compose, no external infra.

## Running the app

```bash
docker compose up          # start all services
docker compose restart fastapi   # reload backend after Python changes
# Frontend hot-reloads automatically; backend hot-reloads via watchfiles
```

- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- Postgres: localhost:5432 (user: loglens, db: loglens)

## Stack

| Layer     | Tech |
|-----------|------|
| Frontend  | Next.js 14, TypeScript, Tailwind, TanStack Query |
| Backend   | FastAPI, SQLAlchemy (async), Alembic |
| Database  | PostgreSQL 16 |
| AI        | OpenRouter → LLM (configured via `OPENROUTER_API_KEY` + `OPENROUTER_MODEL` in `.env`) |

## Key files

```
backend/
  app/
    agents/
      distillation_agent.py     # core AI loop — distills entries into structured summary
      letter_generation_agent.py
      transcription_agent.py    # voice → text (Whisper)
    routers/
      entries.py                # CRUD + voice upload + audio streaming
      subjects.py
      summaries.py              # /summary and /summary/refresh endpoints
    models/                     # SQLAlchemy models
    schemas/                    # Pydantic schemas (entry.py has EvidenceItem, CautionItem)

frontend/src/
  components/
    timeline/
      TimelineView.tsx          # Trajectory tab — main timeline, dot highlighting, sparkline
      TraitsSidebar.tsx         # traits + cautions sidebar with focus/click
    summary/
      SummaryView.tsx
    entries/
      EntryFeed.tsx, EntryCard.tsx, TextEntryForm.tsx, VoiceEntryForm.tsx
    letters/
  types/api.ts                  # all shared types — EvidenceItem, CautionItem, CoreTrait, etc.
  lib/api.ts                    # authenticated fetch wrapper
```

## Data model — structured summary

The distillation agent produces a JSON blob stored in `subject_summaries.structured_summary`:

```json
{
  "core_traits": [
    {
      "trait": "Team Leadership",
      "evidence": [
        { "text": "Took full ownership of the barbecue when others stepped back.", "entry_index": 4, "entry_id": "uuid" }
      ]
    }
  ],
  "notable_episodes": [
    { "title": "...", "description": "...", "date_approx": "Q3", "qualities_demonstrated": ["..."] }
  ],
  "growth_arc": "...",
  "relationship_texture": "...",
  "cautions": [
    { "text": "Tends to perfect solutions before seeking input.", "entry_indices": [2], "entry_ids": ["uuid"] }
  ]
}
```

**Critical:** `entry_id` / `entry_ids` are resolved server-side in `distillation_agent.py`
after the LLM call, by mapping `entry_index` → actual UUID. The frontend uses these for
direct dot-highlighting on the Trajectory timeline — no keyword matching.

## Trajectory tab behaviour

- Timeline: newest entry at top, "Today" cap at top-right, sparkline at bottom
- Milestones numbered oldest=1 (chronological), distributed newest-first across the visual
- Clicking a trait: highlights only the dots whose `entry_id` is in that trait's evidence
- Clicking a caution: highlights dots from `caution.entry_ids`
- Excerpt bubbles show `ev.text` (LLM-written, 8–12 words) — not extracted from raw text

## Distillation prompt rules (important)

- Evidence is **exhaustive**: prompt instructs LLM to check EVERY entry for EACH trait.
  "Must check every one of the N entries in order" — do not soften this back to "err on inclusion",
  that caused the LLM to stop after 3 entries.
- Cautions require at least one cited entry_index; uncited cautions are not emitted.
- After LLM call, post-process to resolve indices → UUIDs before storing.

## Auth

- JWT via `HTTPBearer` on all endpoints except `GET /entries/{id}/audio`
- Audio endpoint has no auth — browser `<audio>` tags can't send JWT headers; UUID is sufficient

## Known issues / next up

See memory file for V1 roadmap. Top candidate features for next session:
1. Grounded letter generation (show source entries inline as letter streams)
2. Development goals per subject (distillation scores progress each cycle)
3. Smart logging nudges (gap detection by trait + recency)
4. Evidence count badges on traits in sidebar
5. Full-text search across entries
6. Collaborative / 360-degree logging
7. Cross-subject org-level insights

## Type compat note

`CoreTrait.evidence` is `EvidenceItem[]` and `StructuredSummary.cautions` is `CautionItem[]`.
Old summaries in the DB have `evidence: string[]` and `cautions: string[]`.
All rendering code uses `typeof ev === "string" ? ev : ev.text` guards for backward compat.
Old summaries will upgrade to new format on next Refresh.
