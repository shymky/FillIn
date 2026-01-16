
import difflib

reference = "They happen to live nearby."
transcript = "They happen to rape nearby." # simulating whisper hallucination/error

matcher = difflib.SequenceMatcher(None, transcript.lower(), reference.lower())
blocks = matcher.get_matching_blocks()

print(f"Ref: '{reference}'")
print(f"Usr: '{transcript}'")
print("Matching Blocks:")
matched_chars = ["_"] * len(reference)

for m in blocks:
    print(m)
    # m.b is start in reference
    for k in range(m.b, m.b + m.size):
        if k < len(matched_chars):
            matched_chars[k] = reference[k]

print("Visual:")
print("".join(matched_chars))
