# LogLens

AI-driven longitudinal feedback platform. Log brief observations about people you supervise over time. A multi-agent AI layer distills them into structured summaries and generates fully-drafted recommendation letters grounded in specific remembered episodes.

**V0:** Full AI feedback loop running with Claude stubs (no API key needed). Whisper voice transcription and async workers deferred to V1.

---

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (includes Docker Compose)
- Node 18+ (for local frontend development only — not needed for docker-compose)
- Python 3.11+ (for local backend development only — not needed for docker-compose)

---

## Setup

```bash
# 1. Clone / navigate to the project directory
cd loglens

# 2. Copy the env file
cp .env.example .env

# 3. Start everything
docker-compose up --build
```

That's it. Docker Compose builds and starts:
- **PostgreSQL** on port 5432
- **FastAPI** on port 8000
- **Next.js** on port 3000

---

## Access the app

Open **http://localhost:3000** in your browser.

- Register a new account (creates your org automatically — you become admin)
- Or use the seeded test account after running the seed script (see below)

API docs: **http://localhost:8000/docs**

---

## Seed script (optional)

Creates a test org, admin user, member user, and one sample subject:

```bash
docker-compose exec fastapi python -m app.db.seed
```

Credentials created:
- Admin: `admin@loglens.dev` / `password123`
- Member: `member@loglens.dev` / `password123`

---

## Run database migrations manually

Migrations run automatically on container start via the Dockerfile CMD. To run them manually:

```bash
docker-compose exec fastapi alembic upgrade head
```

---

## Run backend tests

Tests require a `loglens_test` database. Create it first:

```bash
docker-compose exec postgres psql -U loglens -c "CREATE DATABASE loglens_test;"
docker-compose exec fastapi pytest app/tests/ -v
```

---

## Swapping in real Claude API calls

When your Anthropic API key arrives:

1. Add it to `.env`:
   ```
   ANTHROPIC_API_KEY=sk-ant-...
   ```

2. Edit `backend/app/agents/distillation_agent.py` — replace the `_call_llm` method body (~5 lines)

3. Edit `backend/app/agents/letter_generation_agent.py` — replace the stub generator in `_stream` (~5 lines)

Both files have detailed comments at the top describing the exact swap.

---

## Project structure

```
loglens/
├── docker-compose.yml
├── .env.example
├── backend/               # FastAPI + SQLAlchemy + Alembic
│   ├── app/
│   │   ├── agents/        # DistillationAgent, LetterGenerationAgent
│   │   ├── models/        # SQLAlchemy ORM models
│   │   ├── routers/       # API routes
│   │   ├── schemas/       # Pydantic v2 schemas
│   │   └── tests/         # pytest test suite
│   └── alembic/           # Database migrations
└── frontend/              # Next.js 14 App Router
    └── src/
        ├── app/           # Pages
        ├── components/    # UI components
        ├── lib/           # API client, auth helpers
        └── store/         # Zustand state
```

---

## V1 roadmap (all additive — no existing code changes)

- Redis + Celery for async background distillation
- Voice upload + local Whisper transcription
- OrgScopedSession enforcer (SQLAlchemy query-time org_id guard)
- PostgreSQL row-level security policies
- Audit log + admin /audit page
