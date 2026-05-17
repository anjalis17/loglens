from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import auth, subjects, entries, summaries
from app.routers.letters import router as letters_router, subjects_router as letters_subjects_router

app = FastAPI(title="LogLens API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(subjects.router)
app.include_router(entries.router)
app.include_router(summaries.router)
app.include_router(letters_router)
app.include_router(letters_subjects_router)


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}
