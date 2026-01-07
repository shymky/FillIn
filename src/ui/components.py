import streamlit as st

def render_cloze_sentence(parts: list, filled_text: str = None, is_correct: bool = None):
    """
    Renders the cloze sentence with a styled blank box or filled feedback.
    
    Args:
        parts: List of text parts and "[box]" marker.
        filled_text: The text to show inside the box (user input or target).
        is_correct: True (Green), False (Red), or None (Neutral).
    """
    
    # CSS Variables for easy tweaking
    success_color = "#d4edda" # Light green bg
    success_text = "#155724"  # Dark green text
    destruct_color = "#f8d7da" # Light red bg
    destruct_text = "#721c24"  # Dark red text
    neutral_bg = "#f0f2f6"
    neutral_text = "#888"

    css = f"""
    <style>
    .cloze-card {{
        background-color: white;
        padding: 30px;
        border-radius: 12px;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        margin-bottom: 20px;
        text-align: center;
    }}
    .cloze-container {{
        font-family: "Helvetica Neue", Arial, sans-serif;
        font-size: 28px;
        line-height: 1.6;
        color: #31333F;
    }}
    .cloze-box {{
        border-radius: 8px;
        padding: 5px 20px;
        display: inline-block;
        font-weight: bold;
        min-width: 150px;
        text-align: center;
        margin: 0 5px;
        transition: all 0.3s ease;
    }}
    
    /* Neutral State (Empty Box) */
    .cloze-box.neutral {{
        background-color: {neutral_bg};
        color: {neutral_text}; 
        border: 2px dashed #ccc;
    }}
    
    /* Correct State */
    .cloze-box.correct {{
        background-color: {success_color};
        color: {success_text};
        border: 2px solid {success_text};
    }}
    
    /* Incorrect State */
    .cloze-box.incorrect {{
        background-color: {destruct_color};
        color: {destruct_text};
        border: 2px solid {destruct_text};
        text-decoration: line-through; /* Optional styling */
    }}
    </style>
    """
    st.markdown(css, unsafe_allow_html=True)
    
    html_parts = []
    
    for part in parts:
        if part == "[box]":
            if is_correct:
                 # Success Green
                 html_parts.append(f'<span class="cloze-box correct">{filled_text}</span>')
            elif is_correct is not None:
                 # Failure Red
                 disp_text = filled_text if filled_text else "?"
                 html_parts.append(f'<span class="cloze-box incorrect">{disp_text}</span>')
            else:
                 # Neutral (Empty)
                 html_parts.append('<span class="cloze-box neutral">?</span>')
        else:
            html_parts.append(f'<span class="cloze-text">{part}</span>')
            
    # Wrap in Card
    st.markdown(f'<div class="cloze-card"><div class="cloze-container">{"".join(html_parts)}</div></div>', unsafe_allow_html=True)

def render_feedback(is_correct: bool, message: str):
    # We might not need this standalone strictly if the box changes color, 
    # but it's good for the text message below.
    if is_correct:
        st.success(f"🎉 {message}")
    else:
        st.error(f"❌ {message}")
