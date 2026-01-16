import random
import re
import ollama
import json

def select_mask_word(sentence: str) -> dict:
    """
    Randomly masks characters in the sentence (approx 60%).
    Maintains punctuation and spaces.
    """
    try:
        masked_chars = []
        # We want to ensure at least SOME characters are masked if possible.
        
        for char in sentence:
            if char.isalnum():
                # 60% chance to mask
                if random.random() < 0.6:
                    masked_chars.append("_")
                else:
                    masked_chars.append(char)
            else:
                masked_chars.append(char)
                
        masked_sentence = "".join(masked_chars)
        
        return {
            "target": sentence, # Target is now the full sentence
            "masked_sentence": masked_sentence
        }
    except Exception as e:
        print(f"Error in select_mask_word: {e}")
        return {"target": sentence, "masked_sentence": sentence}

def normalize(text: str) -> str:
    """Removes punctuation and converts to lowercase."""
    return re.sub(r'[^a-z0-9]', '', text.lower())

import difflib

def calculate_similarity(a: str, b: str) -> float:
    """Calculates similarity ratio between two strings (0.0 to 1.0)."""
    return difflib.SequenceMatcher(None, a, b).ratio()

def evaluate_answer(target: str, user_input: str, context: str, threshold: float = 0.90) -> dict:
    """
    Evaluates answer using Levenshtein distance ratio.
    Default threshold 0.60 allows for minor typos or singular/plural differences.
    """
    # Normalize everything for comparison (ignore punctuation/spacing/case)
    norm_target = normalize(target)
    norm_input = normalize(user_input)
    norm_context = normalize(context)
    
    is_correct = False
    feedback = f"Incorrect. The answer was '{target}'."
    
    # 1. Check strict context match (if they spoke the full sentence)
    if norm_input == norm_context:
         return {
             "is_correct": True,
             "feedback": "Correct! (Full Sentence)"
         }

    # 2. Similarity Check
    similarity = calculate_similarity(norm_input, norm_target)
    
    pct = int(similarity * 100)
    if similarity >= threshold:
        is_correct = True
        feedback = f"Correct! 🙆‍♀️ (Match: {pct}%)"
    else:
        feedback = f"Incorrect. (Match: {pct}%) Expected: '{target}'"
    
    return {
        "is_correct": is_correct,
        "feedback": feedback
    }

def generate_vocabulary_list(description: str, count: int = 5) -> list[dict]:
    """
    Generates a list of vocabulary items based on the user's description using Ollama.
    Returns a list of dicts: {"japanese_meaning": str, "english_phrase": str, "target_word": str}
    """
    prompt = f"""
    You are an English teacher. Create a list of {count} vocabulary items based on this theme: "{description}".
    
    Each item must have:
    1. "english_phrase": A natural English sentence containing the vocabulary.
    2. "japanese_meaning": The natural Japanese translation of the sentence.
    3. "target_word": The key word/phrase in the English sentence (1-3 words).
    
    Output ONLY a valid JSON array of objects. Do not include markdown code blocks or explanations.
    Example:
    [
        {{"english_phrase": "I appreciate your feedback.", "japanese_meaning": "フィードバックに感謝します。", "target_word": "appreciate"}},
        {{"english_phrase": "Could you clarify that point?", "japanese_meaning": "その点について明確にしていただけますか？", "target_word": "clarify"}}
    ]
    """
    
    try:
        response = ollama.chat(model='llama3.2', messages=[
            {'role': 'user', 'content': prompt},
        ])
        
        content = response['message']['content']
        # Clean up potential markdown formatting
        content = content.replace("```json", "").replace("```", "").strip()
        
        data = json.loads(content)
        
        # Validate structure
        valid_items = []
        for item in data:
            if "english_phrase" in item and "japanese_meaning" in item:
                # Ensure target_word exists, if not, try to guess or leave empty
                if "target_word" not in item:
                    item["target_word"] = ""
                valid_items.append(item)
                
        return valid_items
        
    except Exception as e:
        print(f"LLM Generation Error: {e}")
        return []

def filter_vocabulary_by_theme(vocab_list: list[dict], theme: str) -> list[int]:
    """
    Filters a list of vocabulary items by a given theme using Ollama.
    Returns a list of IDs that match the theme.
    """
    # Prepare data for prompt (simplify to reduce tokens)
    # limit to e.g. 50-100 items per batch if needed, but let's try full list for now if small.
    # We'll just send ID and English mostly.
    
    MAX_BATCH_SIZE = 50
    simplified_list = []
    for v in vocab_list:
        simplified_list.append({
            "id": v["id"],
            "text": f"{v['english_phrase']} ({v['japanese_meaning']})"
        })
    
    all_matched_ids = []
    
    # Process in batches
    for i in range(0, len(simplified_list), MAX_BATCH_SIZE):
        batch = simplified_list[i : i + MAX_BATCH_SIZE]
        print(f"Processing batch {i} to {i+len(batch)}...")
        
        prompt = f"""
    You are a strict linguist. Your task is to analyze a list of sentences and identify which ones match the user's criteria: "{theme}".

    Criteria guidelines:
    - If grammatical (e.g., "auxiliary verbs"), strictly check for the specific grammatical markers.
    - If tonal/sentiment (e.g., "negative"), ensure the meaning is genuinely matching the tone.
    - If thematic, ensure it's directly relevant.
    
    List to analyze:
    {json.dumps(batch, ensure_ascii=False)}
    
    INSTRUCTIONS:
    1. First, think step-by-step. For EACH sentence in the list, write a short analysis line explaining why it matches or does not match the criteria. This reasoning is required.
    2. After your analysis, output a JSON Object containing the matches.
    
    Format your final output as:
    
    ... (your analysis here) ...
    
    ```json
    {{
        "matches": [
            {{"id": 1, "reason": "brief reason here"}},
            ...
        ]
    }}
    ```
        """
        
        try:
            response = ollama.chat(model='llama3.2', messages=[
                {'role': 'user', 'content': prompt},
            ])
            
            content = response['message']['content']
            
            # Robustly find JSON block using regex
            # Look for ```json ... ``` or just { ... } at the end
            match = re.search(r'```json\s*(\{.*?\})\s*```', content, re.DOTALL)
            if not match:
                 match = re.search(r'(\{.*\})', content, re.DOTALL)
                 
            if match:
                 json_str = match.group(1)
                 try:
                     data = json.loads(json_str)
                     if "matches" in data and isinstance(data["matches"], list):
                         ids = [int(item["id"]) for item in data["matches"] if "id" in item]
                         all_matched_ids.extend(ids)
                 except Exception as e_json:
                     print(f"JSON Parsing Error: {e_json} in content: {content}")
            else:
                # Fallback: try to find the last occurring JSON-like structure
                # sometimes models output "Here is the JSON: { ... }" without code blocks
                try:
                    start = content.find('{')
                    end = content.rfind('}')
                    if start != -1 and end != -1:
                        json_str = content[start:end+1]
                        data = json.loads(json_str)
                        if "matches" in data and isinstance(data["matches"], list):
                             ids = [int(item["id"]) for item in data["matches"] if "id" in item]
                             all_matched_ids.extend(ids)
                except:
                    print(f"Could not extract JSON from content: {content}")
            
        except Exception as e:
            print(f"LLM Filtering Error in batch: {e}")
            
    return list(set(all_matched_ids))
