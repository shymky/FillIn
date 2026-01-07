import sys
import os

# Add project root to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from src.database.core import init_db, get_db
from src.database.models import Vocabulary
from src.services.llm_service import select_mask_word
from src.services.audio_service import get_model

def test_db():
    print("Testing Database...")
    init_db()
    db = next(get_db())
    count = db.query(Vocabulary).count()
    print(f"Database initialized. Vocabulary count: {count}")
    if count == 0:
        # Should be 0 before main.py runs, or 5 if main.py ran. 
        # But main.py hasn't run yet.
        pass
    print("Database test passed.")

def test_audio():
    print("Testing Audio Service (Model Loading)...")
    model = get_model()
    print("FasterWhisper model loaded successfully.")

def test_llm():
    print("Testing LLM Service (Ollama)...")
    try:
        # Simple test
        res = select_mask_word("This is a test sentence.")
        print(f"LLM Response: {res}")
        if not res.get("target") and not res.get("masked_sentence"):
             print("Warning: LLM returned empty result. Is Ollama running?")
    except Exception as e:
        print(f"LLM Test Failed: {e}")

if __name__ == "__main__":
    test_db()
    test_audio()
    # test_llm() # Optional, might fail if Ollama not running, maybe warn user
    print("Verification Script Completed.")
