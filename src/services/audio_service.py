import io
import subprocess
import uuid
import os
import signal
import hashlib
import threading
import streamlit as st
from faster_whisper import WhisperModel

# Global to track the current playback process
_current_process = None
_model = None

def get_model():
    global _model
    if _model is None:
        _model = WhisperModel("small.en", device="cpu", compute_type="int8")
    return _model

def transcribe(audio_bytes: bytes) -> str:
    """
    Transcribes audio bytes to text using FasterWhisper.
    """
    if not audio_bytes:
        print("Audio bytes empty")
        return ""
    
    print(f"Received audio bytes: {len(audio_bytes)}")

    try:
        model = get_model()
        audio_file = io.BytesIO(audio_bytes)
        
        # Disable VAD filter for now as it seems to block user speech.
        # We will rely on manual filtering of hallucinations.
        segments, info = model.transcribe(audio_file, beam_size=5, vad_filter=False)
        
        text_segments = []
        for segment in segments:
            print(f"Segment: '{segment.text}' (p_no_speech={segment.no_speech_prob:.2f})")
            # Relaxed filter: only drop if extremely high probability of no speech (0.95)
            # relying mainly on vad_filter=True
            if segment.no_speech_prob > 0.95:
                 print("-> Dropped due to high no_speech_prob")
                 continue
            text_segments.append(segment.text)

        text = " ".join(text_segments).strip()
        print(f"Transcribed Text: '{text}'")
        
        # known hallucinations from Whisper on silence
        hallucinations = ["You", "you", "You.", "you.", "MBC", "Reporter", "The end", "You're welcome.", "Thank you."]
        if text in hallucinations:
             print(f"-> Filtered out hallucination: '{text}'")
             return ""
             
        return text
    except Exception as e:
        print(f"Transcribe Error: {e}")
        return ""

def stop_audio():
    """Stops the currently playing audio if any."""
    global _current_process
    if _current_process:
        try:
            # Check if still running
            if _current_process.poll() is None:
                # Terminate
                _current_process.terminate()
                _current_process.wait(timeout=0.5)
        except Exception:
            try:
                # Force kill if terminate fails
                _current_process.kill()
            except:
                pass
        _current_process = None

import streamlit as st

def play_sound(file_path: str):
    """
    Plays a sound file using afplay.
    Stops currently playing audio first.
    """
    global _current_process
    
    # 1. Stop current audio
    stop_audio()
    
    if not os.path.exists(file_path):
        print(f"Sound file not found: {file_path}")
        return

    try:
        # Get Volume
        # Default to 1.0 (Normal)
        # afplay volume range: 0 to 255 (Wait, man page says: "Volume (real number between 0 and 255)") -> usually 0-1 or 0-2 works as multiplier.
        # Actually in recent macOS afplay: -v volume (0 to 1 is standard, but >1 works for boost).
        # Let's use session state value directly.
        volume = 1.0
        try:
            if hasattr(st, "session_state") and "app_volume" in st.session_state:
                volume = st.session_state.app_volume
        except:
            pass
            
        # 2. Play Audio
        _current_process = subprocess.Popen(["afplay", "-v", str(volume), file_path])
    except Exception as e:
        print(f"Play Sound Error: {e}")

def speak(text: str, lang: str = "en"):
    """
    Uses edge-tts (online neural TTS) for high quality speech.
    Stops previous audio before playing new one.
    """
    global _current_process
    
import hashlib
import threading

def _generate_audio_file(text: str, voice: str, rate: str = "+0%") -> str:
    """
    Generates the audio file using edge-tts if not in cache.
    Returns the absolute path to the cached file.
    """
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
    cache_dir = os.path.join(base_dir, "data", "audio_cache")
    os.makedirs(cache_dir, exist_ok=True)
    
    # Hash includes rate so different speeds are cached separately
    text_hash = hashlib.md5(f"{voice}_{text}_{rate}".encode()).hexdigest()
    cache_file = os.path.join(cache_dir, f"{text_hash}.mp3")
    
    if not os.path.exists(cache_file):
        try:
            # edge-tts command with rate
            # edge-tts --voice VOICE --rate RATE --text TEXT --write-media FILE
            subprocess.run([
                "edge-tts",
                "--voice", voice,
                f"--rate={rate}",
                "--text", text,
                "--write-media", cache_file
            ], check=True)
        except Exception as e:
            print(f"Generation Error: {e}")
            return None
            
    return cache_file

def prefetch_audio(text: str, lang: str = "en"):
    """
    Generates the audio file in a background thread to prepare for playback.
    """
    # Defaults
    voice = "en-US-AvaNeural"
    if lang == "ja":
        voice = "ja-JP-NanamiNeural"
        
    # Override from session state if available
    try:
        if lang == "ja" and "ja_voice" in st.session_state:
            voice = st.session_state.ja_voice
        elif lang == "en" and "en_voice" in st.session_state:
            voice = st.session_state.en_voice
    except:
        pass
        
    # Capture rate from session state in the main thread
    rate = "+0%"
    try:
        if lang == "ja" and "ja_speed" in st.session_state:
            rate = st.session_state.ja_speed
        elif lang == "en" and "en_speed" in st.session_state:
            rate = st.session_state.en_speed
    except:
        pass
        
    def task():
        _generate_audio_file(text, voice, rate)
        
    thread = threading.Thread(target=task)
    thread.daemon = True
    thread.start()

def speak(text: str, lang: str = "en", stop_previous: bool = True):
    """
    Uses edge-tts (online neural TTS) for high quality speech.
    Stops previous audio before playing new one (default).
    Caches generated audio files to avoid re-downloading.
    """
    global _current_process
    
    # 1. Stop current audio (Optional)
    if stop_previous:
        stop_audio()
    
    try:
        # Defaults
        voice = "en-US-AvaNeural"
        if lang == "ja":
            voice = "ja-JP-NanamiNeural"
            
        # Override from session state
        try:
            if lang == "ja" and "ja_voice" in st.session_state:
                voice = st.session_state.ja_voice
            elif lang == "en" and "en_voice" in st.session_state:
                voice = st.session_state.en_voice
        except:
            pass
            
        # Get Rate
        rate = "+0%"
        try:
            if lang == "ja" and "ja_speed" in st.session_state:
                rate = st.session_state.ja_speed
            elif lang == "en" and "en_speed" in st.session_state:
                rate = st.session_state.en_speed
        except:
            pass

        # Use helper to get file
        cache_file = _generate_audio_file(text, voice, rate)
        
        if cache_file and os.path.exists(cache_file):
            # 2. Play Audio (Non-blocking but tracked)
            # If we didn't stop previous, this process overwrites the global reference, 
            # so the previous process becomes "headless" (plays until done). 
            # This allows mixing.
            
            # Get Volume
            volume = 1.0
            try:
                if hasattr(st, "session_state") and "app_volume" in st.session_state:
                    volume = st.session_state.app_volume
            except:
                pass
                
            _current_process = subprocess.Popen(["afplay", "-v", str(volume), cache_file])
        else:
            # Fallback
            fallback_voice = "Samantha" if lang == "en" else "Kyoko"
            _current_process = subprocess.Popen(["say", "-v", fallback_voice, text])

    except Exception as e:
        print(f"EdgeTTS Error: {e}")
        # Fallback
        try:
             fallback_voice = "Samantha" if lang == "en" else "Kyoko"
             _current_process = subprocess.Popen(["say", "-v", fallback_voice, text])
        except:
             pass

def generate_audio_path(text: str, lang: str = "en") -> str:
    """
    Generates audio file for the given text and language, respecting current session settings.
    Returns the absolute path to the file.
    """
    # Defaults
    voice = "en-US-AvaNeural"
    if lang == "ja":
        voice = "ja-JP-NanamiNeural"
        
    # Override from session state
    try:
        if lang == "ja" and "ja_voice" in st.session_state:
            voice = st.session_state.ja_voice
        elif lang == "en" and "en_voice" in st.session_state:
            voice = st.session_state.en_voice
    except:
        pass
        
    # Get Rate
    rate = "+0%"
    try:
        if lang == "ja" and "ja_speed" in st.session_state:
            rate = st.session_state.ja_speed
        elif lang == "en" and "en_speed" in st.session_state:
            rate = st.session_state.en_speed
    except:
        pass

    # Use helper to get file
    return _generate_audio_file(text, voice, rate)
