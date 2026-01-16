import difflib
import re

def normalize(text: str) -> str:
    return re.sub(r'[^a-z0-9]', '', text.lower())

def calculate_similarity(a: str, b: str) -> float:
    return difflib.SequenceMatcher(None, a, b).ratio()

target = "But I just ordered the salad instead."
user_input = "but I just ordered the solid instead."

norm_target = normalize(target)
norm_input = normalize(user_input)

score = calculate_similarity(norm_input, norm_target)

print(f"Target: '{target}'")
print(f"Input:  '{user_input}'")
print(f"Norm Target: '{norm_target}'")
print(f"Norm Input:  '{norm_input}'")
print(f"Similarity Score: {score}")
print(f"Is > 0.60? {score > 0.60}")
print(f"Is > 0.85? {score > 0.85}")
