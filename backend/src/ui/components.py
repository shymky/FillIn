import difflib
import streamlit as st

def render_cloze_sentence(reference_text: str, masked_text: str, user_transcript: str = "", is_correct: bool = None):
    """
    Renders the sentence with a "Reveal" effect.
    
    Args:
        reference_text: The full correct sentence.
        masked_text: The initial state with underscores.
        user_transcript: What the user has spoken.
        is_correct: Overall correctness state.
    """
    
    # CSS Variables
    success_color = "#34eb77" # Bright green text for match
    failure_color = "#ff4b4b" # Red for give up/failure
    base_text_color = "#b0b3b8" # Gray for "pending" / neutral
    
    css = f"""
    <style>
    /* Desktop First Defaults */
    .cloze-card {{
        background-color: white;
        padding: 3rem;
        border-radius: 20px;
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.08);
        margin-bottom: 20px;
        text-align: center;
        transition: all 0.3s ease;
        border: 1px solid rgba(0,0,0,0.02);
    }}
    .cloze-container {{
        font-family: "Helvetica Neue", Arial, sans-serif;
        font-size: 2rem; /* 32px equivalent */
        line-height: 1.6;
        color: {base_text_color}; /* Default Gray */
        font-weight: 600;
        letter-spacing: 0.5px;
    }}
    
    /* Mobile Optimization */
    @media (max-width: 600px) {{
        .cloze-card {{
            padding: 1.5rem;
            border-radius: 16px;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.05);
        }}
        .cloze-container {{
            font-size: 1.4rem; /* ~22px */
            line-height: 1.5;
        }}
    }}
    
    .cloze-char {{
        transition: color 0.1s ease;
        display: inline-block;
        min-width: 8px; /* Slightly tighter */
    }}
    .cloze-char.matched {{
        color: {success_color}; /* Green when matched */
    }}
    .cloze-char.close-pass {{
        color: #ffa500; /* Orange for Close Pass */
    }}
    .cloze-char.mask {{
        color: #e0e0e0; 
        font-weight: 700;
    }}
    </style>
    """
    st.markdown(css, unsafe_allow_html=True)
    
    # Compare user input vs reference (WORD LEVEL)
    import re
    if not user_transcript:
        user_transcript = ""
        
    # Helper to clean tokens for comparison
    def clean_token(t):
        return re.sub(r'[^\w]', '', t).lower()
    
    # We need to map characters of reference_text to "matched" status via word alignment.
    ref_tokens = reference_text.split()
    user_tokens = user_transcript.split()
    
    ref_clean = [clean_token(t) for t in ref_tokens]
    user_clean = [clean_token(t) for t in user_tokens]
    
    matcher = difflib.SequenceMatcher(None, user_clean, ref_clean)
    matching_blocks = matcher.get_matching_blocks()
    
    matched_word_indices = set()
    for match in matching_blocks:
        # match.b is start index in REF (second seq)
        for k in range(match.b, match.b + match.size):
            matched_word_indices.add(k)
            
    # Render Loop: Iterate through Tokens to preserve Original Spacing/Punctuation
    html_parts = []
    cursor = 0
    
    for i, token in enumerate(ref_tokens):
        # Find token in remaining text (from cursor)
        str_start = reference_text.find(token, cursor)
        if str_start == -1:
            continue
            
        # 1. Render Gap (spaces/punctuation skipped by split)
        if str_start > cursor:
            gap_text = reference_text[cursor:str_start]
            html_parts.append(f'<span class="cloze-char">{gap_text}</span>')
            
        # 2. Render Word
        word_text = reference_text[str_start : str_start + len(token)]
        is_matched = i in matched_word_indices
        
        # Determine status
        token_class = ""
        
        if is_matched:
             # Exact Word Match -> Green
             token_class = "matched"
        elif is_correct is True:
             # Correct Overall, but Word NOT matched -> Orange (Close Pass)
             token_class = "close-pass"
        
        # Check for Give Up State
        # If is_correct is explicitly False (Set by Give Up button)
        # And we are showing the full text (masked_text == reference_text)
        is_give_up = (is_correct is False)
        
        for char_offset, char in enumerate(word_text):
            global_index = str_start + char_offset
            
            if token_class:
                # Green or Orange (Always Reveal)
                html_parts.append(f'<span class="cloze-char {token_class}">{char}</span>')
            elif is_give_up:
                # Show in Red if not matched and we gave up
                html_parts.append(f'<span class="cloze-char failure">{char}</span>')
            else:
                # Not matched -> Show masked state
                if global_index < len(masked_text):
                    display_char = masked_text[global_index]
                else:
                    display_char = char
                
                extra_class = "mask" if display_char == "_" else ""
                html_parts.append(f'<span class="cloze-char {extra_class}">{display_char}</span>')

        cursor = str_start + len(token)
        
    # Render remaining tail (if any)
    if cursor < len(reference_text):
        html_parts.append(f'<span class="cloze-char">{reference_text[cursor:]}</span>')

    # Wrap in Card
    # Add User Transcript Display
    transcript_html = ""
    if user_transcript:
        transcript_html = f"""
        <div style="margin-top: 20px; font-size: 20px; color: #555; border-top: 1px solid #eee; padding-top: 15px;">
            <span style="font-size: 14px; text-transform: uppercase; letter-spacing: 1.2px; color: #888; font-weight: bold;">You said:</span><br>
            "{user_transcript}"
        </div>
        """
        
    st.markdown(f'<div class="cloze-card"><div class="cloze-container">{"".join(html_parts)}</div>{transcript_html}</div>', unsafe_allow_html=True)

def render_feedback(is_correct: bool, message: str):
    # We might not need this standalone strictly if the box changes color, 
    # but it's good for the text message below.
    if is_correct:
        st.success(f"🎉 {message}")
    else:
        st.error(f"❌ {message}")
