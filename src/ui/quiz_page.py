import streamlit as st
import random
import os
import time
from datetime import datetime, timedelta
from streamlit_mic_recorder import mic_recorder
from src.database.core import get_db
from src.database.models import Vocabulary, Tag
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
    if "has_failed_current_question" not in st.session_state:
        st.session_state.has_failed_current_question = False
    
    # Quiz Logic State
    # quiz_state: "SETUP", "ACTIVE", "RESULT"
    if "quiz_state" not in st.session_state:
        st.session_state.quiz_state = "SETUP"
    if "quiz_filters" not in st.session_state:
        st.session_state.quiz_filters = {
            "status": ["All"],
            "tag": "All Options",
            "limit": "Endless" 
        }
    if "questions_answered" not in st.session_state:
        st.session_state.questions_answered = 0
    # Track unique IDs answered correctly in this session to ensure "One Pass" behavior
    if "session_answered_ids" not in st.session_state:
        st.session_state.session_answered_ids = set()

def next_question():
    # Check limit before loading
    limit_setting = st.session_state.quiz_filters.get("limit", "Endless")
    if limit_setting != "Endless":
        limit = int(limit_setting)
        if st.session_state.questions_answered >= limit:
            st.session_state.quiz_state = "RESULT"
            return
            
    # Stop any old audio
    stop_audio()
    
    # Clear processed audio cache
    if "processed_audio_ids" in st.session_state:
        st.session_state.processed_audio_ids = set()
    
    # Reset failure flag
    st.session_state.has_failed_current_question = False
    
    db = next(get_db())
    query = db.query(Vocabulary)
    
    # --- APPLY FILTERS ---
    filters = st.session_state.quiz_filters
    
    # 1. Status Filter
    status_map = {
        "新学習 (New)": "Unattempted",
        "復習 (Review)": "Correct",
        "学習 (Retry)": "Incorrect"
    }
    
    selected_statuses = filters.get("status", ["All"])
    
    if "All" not in selected_statuses and selected_statuses:
        db_statuses = []
        for s in selected_statuses:
            if s in status_map:
                db_statuses.append(status_map[s])
        
        if db_statuses:
            query = query.filter(Vocabulary.status.in_(db_statuses))
            # If reviewing Correct items, only include those due for review
            if "Correct" in db_statuses:
                query = query.filter(Vocabulary.next_review_at <= datetime.utcnow())    
    # 2. Tag Filter
    selected_tag = filters.get("tag", "All Options")
    if selected_tag != "All Options":
        query = query.join(Vocabulary.tags).filter(Tag.name == selected_tag)
    
    vocabs = query.all()
    
    if not vocabs:
        # No questions matching filter -> End Quiz
        st.session_state.quiz_state = "RESULT"
        return

    # Filter out items already answered in this session (One Pass Logic)
    candidates = [v for v in vocabs if v.id not in st.session_state.session_answered_ids]
    
    if not candidates:
        # We have answered all available items for this session!
        st.session_state.quiz_state = "RESULT"
        return

    # Filter out recently seen words from candidates (for randomness within the session)
    # But if candidates are few, this constraint might be too strict.
    
    # Prune history against current candidates to avoid deadlock
    # Actually, we just need to ensure we don't pick last 1 item if possible
    # But for "One Pass", we just need to pick from `candidates`.
    # `history_ids` logic is less relevant now that `session_answered_ids` removes them strictly.
    # However, `history_ids` might be useful if we allow retrying failed ones (which are not in session_answered_ids yet).
    
    # Let's simplify: Pick random from candidates.
    vocab = random.choice(candidates)
    
    # History tracking is arguably redundant for "One Pass" logic but kept for safety
    st.session_state.history_ids.append(vocab.id)
    if len(st.session_state.history_ids) > 10:
         st.session_state.history_ids.pop(0)

    st.session_state.current_vocab = vocab
    
    # Generate mask
    mask_data = select_mask_word(vocab.english_phrase)
    st.session_state.mask_data = mask_data
    
    # Reset state
    st.session_state.user_transcript = ""
    st.session_state.feedback = None
    st.session_state.quiz_complete = False
    
    # Prefetch
    prefetch_audio(vocab.english_phrase, lang="en")
    
    # Clear Inputs
    if "answer_input" in st.session_state:
        st.session_state["answer_input"] = ""
    if "text_input" in st.session_state:
        st.session_state["text_input"] = ""
    if "last_text_input" in st.session_state:
        st.session_state["last_text_input"] = ""
        
    # Speak Japanese immediately
    speak(vocab.japanese_meaning, lang="ja")
    
def start_quiz():
    st.session_state.quiz_state = "ACTIVE"
    st.session_state.questions_answered = 0
    st.session_state.session_answered_ids = set() # Reset session tracking
    next_question()

def exit_quiz():
    st.session_state.quiz_state = "SETUP"
    st.session_state.current_vocab = None
    st.session_state.session_answered_ids = set()
    st.rerun()

def retry_question():
    st.session_state.feedback = None
    st.session_state.quiz_complete = False
    st.session_state.user_transcript = ""
    if "text_input" in st.session_state:
        st.session_state["text_input"] = ""

def process_answer(user_input, target, context):
    result = evaluate_answer(target, user_input, context)
    st.session_state.feedback = result
    
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
    sound_dir = os.path.join(base_dir, "data", "sound")
    
    db = next(get_db())
    vocab_id = st.session_state.current_vocab.id
    v = db.query(Vocabulary).filter(Vocabulary.id == vocab_id).first()
    
    if result['is_correct']:
        if v:
            if not st.session_state.has_failed_current_question:
                v.status = "Correct"
                v.proficiency_score += 1
                # Update spaced repetition schedule
                v.review_step = (v.review_step or 0) + 1
                intervals = [1, 3, 7, 14, 30]
                step_index = min(v.review_step, len(intervals) - 1)
                v.next_review_at = datetime.utcnow() + timedelta(days=intervals[step_index])
                v.last_reviewed_at = datetime.utcnow()
                db.commit()
        play_sound(os.path.join(sound_dir, "正解音.mp3"))
        st.session_state.quiz_complete = True
        # Increment for limit tracking
        st.session_state.questions_answered += 1
        # Add to Session Done list
        st.session_state.session_answered_ids.add(vocab_id)
        time.sleep(0.5)
        speak(context, lang="en", stop_previous=False)
    else:
        st.session_state.has_failed_current_question = True
        if v:
            v.status = "Incorrect"
            v.proficiency_score = max(0, v.proficiency_score - 1)
            # Reset spaced repetition schedule for incorrect answer
            v.review_step = 0
            v.next_review_at = datetime.utcnow() + timedelta(days=1)
            db.commit()
        play_sound(os.path.join(sound_dir, "不正解音.mp3"))
    st.rerun()

def quiz_page():
    get_session_state()
    
    # --- RESULT SCREEN ---
    if st.session_state.quiz_state == "RESULT":
        st.title("Quiz Complete! 🎉")
        st.balloons()
        
        st.info(f"You answered {st.session_state.questions_answered} questions.")
        
        if st.button("Back to Menu 🏠"):
            exit_quiz()
        return

    # --- SETUP SCREEN ---
    if st.session_state.quiz_state == "SETUP":
        st.title("Quiz Setup 🎯")
        st.info("Configure your study session.")
        
        db = next(get_db())
        
        # 1. Status Filter
        st.subheader("1. What to study?")
        status_options = ["新学習 (New)", "学習 (Retry)", "復習 (Review)", "All"]
        current_status = st.session_state.quiz_filters.get("status", ["All"])
        
        selected_status = st.multiselect(
            "Select Status (Leave empty for All):",
            ["新学習 (New)", "学習 (Retry)", "復習 (Review)"],
            default=[s for s in current_status if s != "All"]
        )
        if not selected_status:
            selected_status = ["All"]
            
        # 2. Tag Filter
        st.subheader("2. Select List (Tag)")
        tags = db.query(Tag).all()
        tag_names = ["All Options"] + [t.name for t in tags]
        
        current_tag = st.session_state.quiz_filters.get("tag", "All Options")
        if current_tag not in tag_names:
            current_tag = "All Options"
            
        selected_tag = st.selectbox("Choose a List:", tag_names, index=tag_names.index(current_tag))
        
        # 3. Limit Filter
        st.subheader("3. How many questions?")
        limit_options = ["Endless", "5", "10", "20", "50", "100"]
        current_limit = st.session_state.quiz_filters.get("limit", "Endless")
        selected_limit = st.selectbox("Limit:", limit_options, index=limit_options.index(current_limit))
        
        # Save Filters
        if st.button("Start Quiz 🚀", type="primary"):
            st.session_state.quiz_filters = {
                "status": selected_status,
                "tag": selected_tag,
                "limit": selected_limit
            }
            start_quiz()
            st.rerun()
            
        return

    # --- QUIZ INTERFACE (ACTIVE) ---
    
    # Check for trigger_next
    if st.session_state.get("trigger_next", False):
        st.session_state.trigger_next = False
        next_question()
        st.rerun()
    
    # Header with Exit Button
    c1, c2 = st.columns([5, 1])
    with c1:
        # Show Progress if limit set
        limit_txt = ""
        limit_setting = st.session_state.quiz_filters.get("limit", "Endless")
        if limit_setting != "Endless":
            limit_txt = f" ({st.session_state.questions_answered} / {limit_setting})"
            
        st.title(f"FillIn 📝{limit_txt}")
        
    with c2:
        if st.button("Exit"):
            exit_quiz()
    
    st.button("Load New Sentence", on_click=next_question)

    if not st.session_state.current_vocab:
        # This triggers if Active but no vocab loaded yet (rare if start_quiz called)
        # Or if filter result was empty
        if st.session_state.quiz_state == "RESULT":
             st.rerun() # Should have been handled
        else:
             st.error("No questions found. Please check filters.")
             if st.button("Back"):
                 exit_quiz()
        return

    vocab = st.session_state.current_vocab
    mask_data = st.session_state.mask_data
    
    # 1. Japanese
    st.subheader(vocab.japanese_meaning)
    
    # 2. Cloze
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

    filled_text = None
    is_correct_status = None
    
    if st.session_state.feedback:
        is_correct_status = st.session_state.feedback['is_correct']
        if is_correct_status:
             filled_text = mask_data["target"]
        elif st.session_state.user_transcript:
             filled_text = st.session_state.user_transcript
        else:
             filled_text = "?"

    render_cloze_sentence(parts, filled_text=filled_text, is_correct=is_correct_status)
    
    st.divider()
    
    # 3. Interaction
    col1, col2 = st.columns([1, 4])
    
    with col1:
        st.write("🎤 Speak:")
        audio = mic_recorder(start_prompt="Record", stop_prompt="Stop", key='recorder')
    
    submit_label = "Submit"
    if st.session_state.quiz_complete:
        submit_label = "Next Question >>"
    elif st.session_state.feedback and not st.session_state.feedback['is_correct']:
        submit_label = "Try Again 🔄"
        
    with col2:
        with st.form(key="answer_form", clear_on_submit=False):
            text_input_val = st.text_input("Or type answer:", key="answer_input")
            submitted = st.form_submit_button(submit_label)

    # Processing Input
    if audio:
        audio_id = audio.get('id') or hash(audio['bytes'])
        if audio_id not in st.session_state.processed_audio_ids:
            st.session_state.processed_audio_ids.add(audio_id)
            transcript = transcribe(audio['bytes'])
            if transcript:
                st.session_state.user_transcript = transcript
                process_answer(transcript, mask_data["target"], vocab.english_phrase)

    # Check text input
    if submitted:
        if st.session_state.quiz_complete:
            st.session_state.trigger_next = True
            st.rerun()
        elif st.session_state.feedback and not st.session_state.feedback['is_correct']:
            st.session_state.feedback = None
            st.rerun()
        elif text_input_val:
            st.session_state.user_transcript = text_input_val
            process_answer(text_input_val, mask_data["target"], vocab.english_phrase)

    # Display Feedback
    if st.session_state.feedback:
        display_message = st.session_state.feedback['feedback']
        is_correct = st.session_state.feedback['is_correct']
        
        if is_correct:
             msg = display_message
             st.success(f"🎉 {msg}")
        else:
             st.error("❌ Incorrect")
             c1_f, c2_f = st.columns(2)
             with c1_f:
                 st.markdown(f"**Your Answer:**")
                 st.info(f"{st.session_state.user_transcript}")
             with c2_f:
                 st.markdown(f"**Correct Answer:**")
                 st.success(f"{mask_data['target']}")
             st.caption(f"Reason: {display_message}")
        
        if is_correct:
            col_audio, col_retry = st.columns(2)
            with col_audio:
                st.button("🔊 Play Audio", on_click=speak, args=(vocab.english_phrase, "en"))
            with col_retry:
                st.button("🔄 Retry", on_click=retry_question)
