"""TranscriptionAgent — transcribes audio files locally using Whisper."""
from __future__ import annotations
import asyncio
from concurrent.futures import ThreadPoolExecutor

from app.config import settings


class TranscriptionAgent:
    _model = None
    _executor = ThreadPoolExecutor(max_workers=1)

    @classmethod
    def _load_model(cls):
        if cls._model is None:
            import whisper
            cls._model = whisper.load_model(settings.whisper_model)
        return cls._model

    async def transcribe(self, audio_path: str) -> str:
        model = self._load_model()
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            self._executor,
            lambda: model.transcribe(audio_path),
        )
        return result["text"].strip()
