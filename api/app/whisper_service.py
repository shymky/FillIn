"""Local speech-to-text streaming service using faster-whisper.

Design mirrors the FillIn StreamAudioProcessor:
- 16 kHz mono float32 rolling buffer, capped at ~10 s of context
- Silence detection via RMS; buffers reset after >1 s of silence
- Model is transcribed periodically on the buffer; caller decides pace
- Known Whisper hallucinations are filtered out
"""

from __future__ import annotations

import logging
import re
import threading
from dataclasses import dataclass, field

import numpy as np
from faster_whisper import WhisperModel

logger = logging.getLogger(__name__)

SAMPLE_RATE = 16_000
BUFFER_MAX_SECONDS = 10.0
BUFFER_MAX_SAMPLES = int(BUFFER_MAX_SECONDS * SAMPLE_RATE)
MIN_TRANSCRIBE_SAMPLES = int(0.5 * SAMPLE_RATE)
SILENCE_RMS_THRESHOLD = 0.01
SILENCE_RESET_SECONDS = 1.0

_HALLUCINATIONS = {
    "you",
    "you.",
    "mbc",
    "reporter",
    "the end",
    "okay",
    "okay.",
    "thank you",
    "thank you.",
    "thanks for watching",
    "thanks for watching.",
    "bye",
    "bye.",
}

_OKAY_TOKEN = re.compile(r"^okay[.,!?]?$", re.IGNORECASE)


def _strip_trailing_okay(text: str) -> str:
    """Drop 3+ trailing "okay"s that Whisper tends to hallucinate."""
    tokens = text.strip().split()
    trailing = 0
    for tok in reversed(tokens):
        if _OKAY_TOKEN.match(tok):
            trailing += 1
        else:
            break
    if trailing >= 3:
        tokens = tokens[: len(tokens) - trailing]
    return " ".join(tokens)


def _filter_hallucination(text: str) -> str:
    lowered = text.strip().lower()
    if not lowered:
        return ""
    if lowered in _HALLUCINATIONS:
        return ""
    cleaned = _strip_trailing_okay(text)
    if not cleaned.strip():
        return ""
    return cleaned


# --- Model singleton ---------------------------------------------------------

_model_lock = threading.Lock()
_model: WhisperModel | None = None
_model_name: str = "small.en"
_model_compute: str = "int8"


def get_model(name: str = "small.en", compute_type: str = "int8") -> WhisperModel:
    """Lazy-load and cache the WhisperModel. Thread-safe."""
    global _model, _model_name, _model_compute
    with _model_lock:
        if _model is None or _model_name != name or _model_compute != compute_type:
            logger.info("Loading Whisper model %s (%s)…", name, compute_type)
            _model = WhisperModel(name, device="cpu", compute_type=compute_type)
            _model_name = name
            _model_compute = compute_type
        return _model


# --- Per-session streaming state --------------------------------------------


@dataclass
class StreamSession:
    """Owns a rolling audio buffer for one client session."""

    buffer: np.ndarray = field(
        default_factory=lambda: np.zeros(0, dtype=np.float32)
    )
    last_speech_frame: int = 0
    total_samples_seen: int = 0
    lock: threading.Lock = field(default_factory=threading.Lock)

    def append_pcm(self, pcm_f32: np.ndarray) -> None:
        """Append incoming float32 PCM to the buffer, with VAD-based reset."""
        pcm_f32 = np.asarray(pcm_f32, dtype=np.float32).reshape(-1)
        if pcm_f32.size == 0:
            return
        rms = float(np.sqrt(np.mean(pcm_f32 * pcm_f32)))
        with self.lock:
            self.total_samples_seen += pcm_f32.size
            if rms > SILENCE_RMS_THRESHOLD:
                self.last_speech_frame = self.total_samples_seen
            else:
                silence_samples = self.total_samples_seen - self.last_speech_frame
                if silence_samples / SAMPLE_RATE > SILENCE_RESET_SECONDS:
                    if self.buffer.size > 0:
                        logger.debug("Silence reset — flushing %d samples", self.buffer.size)
                        self.buffer = np.zeros(0, dtype=np.float32)
            self.buffer = np.concatenate([self.buffer, pcm_f32])
            if self.buffer.size > BUFFER_MAX_SAMPLES:
                self.buffer = self.buffer[-BUFFER_MAX_SAMPLES:]

    def snapshot(self) -> np.ndarray | None:
        with self.lock:
            if self.buffer.size < MIN_TRANSCRIBE_SAMPLES:
                return None
            return self.buffer.copy()

    def reset(self) -> None:
        with self.lock:
            self.buffer = np.zeros(0, dtype=np.float32)


def transcribe_snapshot(
    audio: np.ndarray, model: WhisperModel, language: str = "en"
) -> str:
    """Run a single transcription pass on the given audio snapshot."""
    segments, _ = model.transcribe(
        audio,
        beam_size=1,
        vad_filter=True,
        language=language,
    )
    parts: list[str] = []
    for seg in segments:
        if getattr(seg, "no_speech_prob", 0.0) > 0.95:
            continue
        parts.append(seg.text)
    text = " ".join(parts).strip()
    return _filter_hallucination(text)
