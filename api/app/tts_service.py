"""Neural TTS via edge-tts, with a persistent mp3 cache.

Design mirrors the FillIn audio_service:
- Voice defaults per language (en → Ava, ja → Nanami)
- Rate as a percent string like "+0%" or "-10%"
- File cache keyed by md5(voice|text|rate)
"""

from __future__ import annotations

import asyncio
import hashlib
import logging
from pathlib import Path

import edge_tts

logger = logging.getLogger(__name__)

DEFAULT_VOICES = {
    "en": "en-US-AvaNeural",
    "ja": "ja-JP-NanamiNeural",
}

CACHE_DIR = Path(__file__).resolve().parent.parent / "data" / "audio_cache"
CACHE_DIR.mkdir(parents=True, exist_ok=True)


def resolve_voice(voice: str | None, lang: str | None) -> str:
    if voice:
        return voice
    if lang and lang.lower().startswith("ja"):
        return DEFAULT_VOICES["ja"]
    return DEFAULT_VOICES["en"]


def cache_path(voice: str, text: str, rate: str) -> Path:
    key = f"{voice}|{text}|{rate}".encode("utf-8")
    return CACHE_DIR / f"{hashlib.md5(key).hexdigest()}.mp3"


_locks: dict[str, asyncio.Lock] = {}


async def synthesize(
    text: str,
    voice: str | None = None,
    lang: str | None = None,
    rate: str = "+0%",
) -> Path:
    """Return path to a cached mp3, generating it via edge-tts if missing."""
    if not text.strip():
        raise ValueError("text is empty")
    voice = resolve_voice(voice, lang)
    path = cache_path(voice, text, rate)
    if path.exists() and path.stat().st_size > 0:
        return path

    # De-duplicate concurrent requests for the same file
    lock = _locks.setdefault(path.name, asyncio.Lock())
    async with lock:
        if path.exists() and path.stat().st_size > 0:
            return path
        logger.info("Synthesizing TTS: voice=%s rate=%s len=%d", voice, rate, len(text))
        tmp = path.with_suffix(".mp3.tmp")
        try:
            communicate = edge_tts.Communicate(text=text, voice=voice, rate=rate)
            await communicate.save(str(tmp))
            tmp.rename(path)
        except Exception:
            if tmp.exists():
                try:
                    tmp.unlink()
                except OSError:
                    pass
            raise
    return path
