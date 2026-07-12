from fastapi import APIRouter, HTTPException
from src.services.audio_service import speak, transcribe

router = APIRouter()

@router.post("/play")
async def play_audio(text: str, lang: str = "en"):
    """Play audio for given text"""
    try:
        speak(text, lang)
        return {"status": "playing"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/transcribe")
async def transcribe_audio(audio_bytes: bytes):
    """Transcribe audio bytes to text"""
    try:
        text = transcribe(audio_bytes)
        return {"text": text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/config")
async def get_listening_config():
    """Get listening configuration"""
    try:
        return {
            "repeat_options": [1, 2, 3, 5, 10],
            "default_repeat": 3
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
