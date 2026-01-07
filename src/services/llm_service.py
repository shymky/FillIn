import random
import re

def select_mask_word(sentence: str) -> dict:
    """
    Selects a phrase (1-3 words) to mask using a simple heuristic.
    """
    try:
        words = sentence.split()
        if not words:
            return {"target": "", "masked_sentence": sentence}

        # Determine mask length (1 to 3 words, but don't mask entire sentence if short)
        max_len = min(3, len(words) - 1 if len(words) > 1 else 1)
        mask_len = random.randint(1, max(1, max_len))
        
        # Select start index
        # valid start indices are 0 to len(words) - mask_len
        start_idx = random.randint(0, len(words) - mask_len)
        
        target_words = words[start_idx : start_idx + mask_len]
        target = " ".join(target_words)
        
        # Clean target for display/grading (remove trailing punctuation from the phrase itself if it's in the middle)
        # But for exact reconstruction we need the original tokens.
        
        # Reconstruct masked sentence
        # We use a placeholder that visually suggests length? No, just standard box.
        masked_words = words[:start_idx] + ["[      ]"] + words[start_idx + mask_len:]
        masked_sentence = " ".join(masked_words)
        
        # Strip punctuation from target for grading? 
        # Actually, if user speaks "lights.", whisper gives "lights".
        # So we should probably strip punctuation from the target for grading comparison.
        target_clean = target.strip(".,!?\"'")
        
        return {
            "target": target_clean,
            "masked_sentence": masked_sentence
        }
    except Exception as e:
        print(f"Error in select_mask_word: {e}")
        return {"target": "error", "masked_sentence": sentence}

def normalize(text: str) -> str:
    """Removes punctuation and converts to lowercase."""
    return re.sub(r'[^a-z0-9]', '', text.lower())

def evaluate_answer(target: str, user_input: str, context: str) -> dict:
    """
    Evaluates answer using strict string matching. No LLM.
    """
    # Normalize everything for comparison (ignore punctuation/spacing)
    norm_target = normalize(target)
    norm_input = normalize(user_input)
    norm_context = normalize(context)
    
    # Logic: 
    # 1. Exact match
    # 2. Singular/Plural tolerance
    
    is_correct = False
    feedback = f"Incorrect. The answer was '{target}'."
    
    if norm_input == norm_target:
        is_correct = True
        feedback = "Correct!"
    elif norm_input + "s" == norm_target or norm_input == norm_target + "s":
        is_correct = True
        feedback = "Close enough! (Singular/Plural)"
    elif norm_input + "ed" == norm_target or norm_input == norm_target + "ed":
         is_correct = True
         feedback = "Close enough! (Tense)"
    elif norm_input == norm_context:
         is_correct = True
         feedback = "Correct! (Full Sentence)"
    
    return {
        "is_correct": is_correct,
        "feedback": feedback
    }
