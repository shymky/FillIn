"""FastAPI entrypoint for fillin² local API (STT etc.)."""

from __future__ import annotations

import asyncio
import json
import logging
import time

import numpy as np
from fastapi import FastAPI, HTTPException, Query, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from app.tts_service import synthesize
from app.whisper_service import (
    StreamSession,
    get_model,
    transcribe_snapshot,
)

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("fillin2-api")

app = FastAPI(title="fillin² API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/healthz")
async def healthz() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/tts")
async def tts(
    text: str = Query(..., min_length=1, max_length=2000),
    voice: str | None = Query(None, description="edge-tts voice name"),
    lang: str | None = Query(None, description="Fallback language (en/ja)"),
    rate: str = Query("+0%", pattern=r"^[-+]?\d{1,3}%$"),
) -> FileResponse:
    """Return a neural mp3 for the given text.

    Uses edge-tts under the hood with a persistent on-disk cache so repeated
    plays are instant and offline.
    """
    try:
        path = await synthesize(text=text, voice=voice, lang=lang, rate=rate)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("TTS failed: %s", exc)
        raise HTTPException(status_code=502, detail="TTS generation failed") from exc
    return FileResponse(
        path,
        media_type="audio/mpeg",
        headers={"Cache-Control": "public, max-age=31536000, immutable"},
    )


@app.on_event("startup")
async def _warmup() -> None:
    """Preload the Whisper model to avoid first-request latency."""
    logger.info("Warming up Whisper model…")
    loop = asyncio.get_running_loop()
    await loop.run_in_executor(None, get_model)
    logger.info("Whisper model ready.")


TRANSCRIBE_INTERVAL_MS = 400


@app.websocket("/stt/stream")
async def stt_stream(ws: WebSocket) -> None:
    """Bidirectional stream:

    - Client -> server: binary frames of 16 kHz mono float32 PCM (little-endian).
                        Text frame {"type": "reset"} clears the buffer.
    - Server -> client: text frames of JSON transcripts.
    """
    await ws.accept()
    logger.info("STT client connected")
    session = StreamSession()
    model = get_model()
    last_text = ""
    last_run = 0.0
    stop_event = asyncio.Event()

    async def transcribe_loop() -> None:
        nonlocal last_text, last_run
        while not stop_event.is_set():
            await asyncio.sleep(TRANSCRIBE_INTERVAL_MS / 1000)
            audio = session.snapshot()
            if audio is None:
                if last_text:
                    last_text = ""
                    try:
                        await ws.send_text(json.dumps({"type": "transcript", "text": ""}))
                    except Exception:
                        return
                continue
            loop = asyncio.get_running_loop()
            started = time.perf_counter()
            try:
                text = await loop.run_in_executor(
                    None, transcribe_snapshot, audio, model
                )
            except Exception as exc:
                logger.exception("transcribe failed: %s", exc)
                continue
            elapsed_ms = (time.perf_counter() - started) * 1000
            last_run = elapsed_ms
            if text != last_text:
                last_text = text
                try:
                    await ws.send_text(
                        json.dumps(
                            {
                                "type": "transcript",
                                "text": text,
                                "elapsed_ms": round(elapsed_ms, 1),
                            }
                        )
                    )
                except Exception:
                    return

    worker = asyncio.create_task(transcribe_loop())
    try:
        while True:
            msg = await ws.receive()
            if msg["type"] == "websocket.disconnect":
                break
            if (data := msg.get("bytes")) is not None:
                if len(data) % 4 != 0:
                    continue
                # Interpret as little-endian float32
                count = len(data) // 4
                pcm = np.frombuffer(data, dtype=np.float32, count=count)
                session.append_pcm(pcm)
            elif (text := msg.get("text")) is not None:
                try:
                    payload = json.loads(text)
                except json.JSONDecodeError:
                    continue
                if payload.get("type") == "reset":
                    session.reset()
                    last_text = ""
                    await ws.send_text(json.dumps({"type": "reset_ack"}))
                elif payload.get("type") == "ping":
                    await ws.send_text(json.dumps({"type": "pong"}))
    except WebSocketDisconnect:
        pass
    except Exception as exc:
        logger.exception("STT websocket error: %s", exc)
    finally:
        stop_event.set()
        worker.cancel()
        try:
            await worker
        except (asyncio.CancelledError, Exception):
            pass
        logger.info("STT client disconnected")
