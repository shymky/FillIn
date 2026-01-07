import streamlit as st
import random
import os
import time
from streamlit_mic_recorder import mic_recorder
from src.database.core import get_db
from src.database.models import Vocabulary
from src.services.llm_service import select_mask_word, evaluate_answer
from src.services.audio_service import transcribe, speak, stop_audio, play_sound, prefetch_audio
from src.ui.components import render_cloze_sentence, render_feedback

def get_session_state():
    if "current_vocab" not in st.session_state:
        st.session_state.current_vocab = None
    if "mask_data" not in st.session_state:
        st.session_state.mask_data = None
    if "user_transcript" not in st.session_state:
        st.session_state.user_transcript = ""
    if "feedback" not in st.session_state:
        st.session_state.feedback = None
    if "quiz_complete" not in st.session_state:
        st.session_state.quiz_complete = False
    if "history_ids" not in st.session_state:
        st.session_state.history_ids = []
    if "processed_audio_ids" not in st.session_state:
        st.session_state.processed_audio_ids = set()

def next_question():
    # Stop any old audio
    stop_audio()
    
    # Clear processed audio cache for new question
    if "processed_audio_ids" in st.session_state:
        st.session_state.processed_audio_ids = set()
    
    db = next(get_db())
    vocabs = db.query(Vocabulary).all()
    if not vocabs:
        st.error("No vocabulary found in the database. Please add some phrases.")
        return

    # Filter out recently seen words to improve randomness
    # Keep history size to at most 50% of total items to avoids deadlock
    max_history = max(1, len(vocabs) // 2)
    
    # Prune history if it somehow got too big
    if len(st.session_state.history_ids) > max_history:
        st.session_state.history_ids = st.session_state.history_ids[-max_history:]
        
    candidates = [v for v in vocabs if v.id not in st.session_state.history_ids]
    
    # If we ran out of candidates (shoudn't happen with 50% rule, but safe guard), reset history
    if not candidates:
        st.session_state.history_ids = []
        candidates = vocabs

    # Pick a random vocab form candidates
    vocab = random.choice(candidates)
    
    # Update history
    st.session_state.history_ids.append(vocab.id)
    # Maintain size constraint
    if len(st.session_state.history_ids) > max_history:
        st.session_state.history_ids.pop(0)

    st.session_state.current_vocab = vocab
    
    # Generate mask
    mask_data = select_mask_word(vocab.english_phrase)
    st.session_state.mask_data = mask_data
    
    # Reset state
    st.session_state.user_transcript = ""
    st.session_state.feedback = None
    st.session_state.quiz_complete = False
    
    # Prefetch English audio in background
    prefetch_audio(vocab.english_phrase, lang="en")
    
    # Clear text input specifically
    # This must be done in a callback to avoid StreamlitAPIException
    if "answer_input" in st.session_state:
        st.session_state["answer_input"] = ""
    # Legacy cleanup
    if "text_input" in st.session_state:
        st.session_state["text_input"] = ""
    if "last_text_input" in st.session_state:
        st.session_state["last_text_input"] = ""
        
    # Speak Japanese immediately
    speak(vocab.japanese_meaning, lang="ja")

def retry_question():
    """Resets the current question state to allow retrying."""
    st.session_state.feedback = None
    st.session_state.quiz_complete = False
    st.session_state.user_transcript = ""
    if "text_input" in st.session_state:
        st.session_state["text_input"] = ""
    if "last_text_input" in st.session_state:
        st.session_state["last_text_input"] = ""

def process_answer(user_input, target, context):
    result = evaluate_answer(target, user_input, context)
    st.session_state.feedback = result
    
    # Verify paths again
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
    sound_dir = os.path.join(base_dir, "data", "sound")
    
    if result['is_correct']:
        play_sound(os.path.join(sound_dir, "正解音.mp3"))
        st.session_state.quiz_complete = True
        
        # Automatic reading of the english phrase
        # Using stop_previous=False to allow potential overlap if sound is long, 
        # but with a small delay for natural pacing
        time.sleep(0.5) 
        speak(context, lang="en", stop_previous=False)
        
    else:
         play_sound(os.path.join(sound_dir, "不正解音.mp3"))
         
    st.rerun()

def quiz_page():
    get_session_state()
    
    # Check for trigger_next flag to avoid StreamlitAPIException
    if st.session_state.get("trigger_next", False):
        st.session_state.trigger_next = False
        next_question()
        st.rerun()
    
    st.title("Context Cloze Trainer")
    
    # Use on_click to ensure state is updated BEFORE the next render
    st.button("Load New Sentence", on_click=next_question)

    if not st.session_state.current_vocab:
        st.info("Click 'Load New Sentence' to start.")
        return

    vocab = st.session_state.current_vocab
    mask_data = st.session_state.mask_data
    
    # 1. Top: Japanese Meaning
    st.subheader(vocab.japanese_meaning)
    
    # 2. Center: Sentence with Blank
    masked_text = mask_data["masked_sentence"]
    parts = []
    if "[      ]" in masked_text:
        split_text = masked_text.split("[      ]")
        for i, part in enumerate(split_text):
            parts.append(part)
            if i < len(split_text) - 1:
                parts.append("[box]")
    elif "[______]" in masked_text:
         split_text = masked_text.split("[______]")
         for i, part in enumerate(split_text):
            parts.append(part)
            if i < len(split_text) - 1:
                parts.append("[box]")
    else:
        parts = [masked_text]

    # Check feedback for state
    filled_text = None
    is_correct_status = None
    
    if st.session_state.feedback:
        is_correct_status = st.session_state.feedback['is_correct']
        # Show target if correct (cleaner), otherwise show user input
        if is_correct_status:
             filled_text = mask_data["target"]
        elif st.session_state.user_transcript:
             filled_text = st.session_state.user_transcript
        else:
             filled_text = "?"

    render_cloze_sentence(parts, filled_text=filled_text, is_correct=is_correct_status)
    
    st.divider()
    
    # 3. Bottom: Interaction
    col1, col2 = st.columns([1, 4])
    
    with col1:
        st.write("🎤 Speak Answer:")
        audio = mic_recorder(start_prompt="Record", stop_prompt="Stop", key='recorder')
    
    # Determine button label based on state
    submit_label = "Submit"
    if st.session_state.quiz_complete:
        submit_label = "Next Question >>"
    elif st.session_state.feedback and not st.session_state.feedback['is_correct']:
        submit_label = "Try Again 🔄"
        
    with col2:
        with st.form(key="answer_form", clear_on_submit=False):
            # Using 'answer_input' key
            text_input_val = st.text_input("Or type answer (Enter to Submit / Next):", key="answer_input")
            # Dynamic submit button
            submitted = st.form_submit_button(submit_label)



    # Processing Input
    if audio:
        # Use ID from component or hash of bytes to identify unique recordings
        audio_id = audio.get('id') or hash(audio['bytes'])
        
        if audio_id not in st.session_state.processed_audio_ids:
            st.session_state.processed_audio_ids.add(audio_id)
            
            transcript = transcribe(audio['bytes'])
            if transcript:
                st.session_state.user_transcript = transcript
                process_answer(transcript, mask_data["target"], vocab.english_phrase)

    # Check text input (Form Submission)
    if submitted:
        # 1. Correct State -> Next Question
        if st.session_state.quiz_complete:
            st.session_state.trigger_next = True
            st.rerun()
            
        # 2. Incorrect State -> Try Again (Clear Feedback)
        elif st.session_state.feedback and not st.session_state.feedback['is_correct']:
            st.session_state.feedback = None
            st.rerun()
            
        # 3. Normal State -> Process Answer
        elif text_input_val:
            st.session_state.user_transcript = text_input_val
            process_answer(text_input_val, mask_data["target"], vocab.english_phrase)

    # Display Feedback
    if st.session_state.feedback:
        display_message = st.session_state.feedback['feedback']
        is_correct = st.session_state.feedback['is_correct']
        
        if is_correct:
             # Remove redundant "Correct!" prefix if present
             msg = display_message
             st.success(f"🎉 {msg}")
        else:
             # Structuring the incorrect feedback
             st.error("❌ Incorrect")
             
             c1, c2 = st.columns(2)
             with c1:
                 st.markdown(f"**Your Answer:**")
                 st.info(f"{st.session_state.user_transcript}")
             with c2:
                 st.markdown(f"**Correct Answer:**")
                 st.success(f"{mask_data['target']}")
                 
             st.caption(f"Reason: {display_message}")
        
        # Paths to sounds
        base_dir = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
        sound_dir = os.path.join(base_dir, "data", "sound")
        correct_sound = os.path.join(sound_dir, "正解音.mp3")
        
        if is_correct:
            # Action Buttons (Submit button handles Next now)
            # Just show Play Audio and Retry
            col_audio, col_retry = st.columns(2)
            
            with col_audio:
                st.button("🔊 Play Audio", on_click=speak, args=(vocab.english_phrase, "en"))
            with col_retry:
                st.button("🔄 Retry", on_click=retry_question)
            
        # Removed redundant "Try Again" button block since Submit handles it
