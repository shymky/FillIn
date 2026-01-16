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

    # Atomic Update: Compute mask first to avoid partial state updates if it fails
    try:
        mask_data = select_mask_word(vocab.english_phrase)
    except Exception as e:
        print(f"Error selecting mask: {e}")
        # Fallback: Simple mask if LLM fails
        mask_data = {"target": vocab.english_phrase, "masked_sentence": vocab.english_phrase, "word": ""}

    st.session_state.current_vocab = vocab
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

def process_answer(user_input, target, context, should_rerun=True):
    # Auto-migrate to new default (0.90)
    current = st.session_state.get("similarity_threshold", 0.90)
    # Force update if not 0.90 (since user is toggling between 90/95/60)
    if current != 0.90: 
        st.session_state.similarity_threshold = 0.90
        current = 0.90
        
    result = evaluate_answer(target, user_input, context, threshold=current)
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
        
        # Auto-Advance Delay
        # Wait for audio to finish (approx) + pause
        time.sleep(2.5)
        st.session_state.trigger_next = True
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
    
    if should_rerun:
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
    
    # Determine status
    is_correct_status = None
    if st.session_state.feedback:
        is_correct_status = st.session_state.feedback['is_correct']

    # 2. Cloze / Reveal UI
    # Create a placeholder we can update in the loop
    sentence_placeholder = st.empty()
    
    # Initial Render (Static)
    with sentence_placeholder.container():
        render_cloze_sentence(
            reference_text=vocab.english_phrase,
            masked_text=mask_data["masked_sentence"],
            user_transcript=st.session_state.user_transcript,
        )
    
    
    st.divider()
    
    # 3. Interaction
    st.write("### 🎙️ Answer")
    
    # 3. Interaction (Mobile-First Stack)
    # Instead of side-by-side, we stack essential controls.
    
    # WebRTC Streamer (Centered via CSS if possible, or just standard)
    from streamlit_webrtc import webrtc_streamer, WebRtcMode
    from src.services.stream_service import StreamAudioProcessor

    ctx = webrtc_streamer(
        key="speech-recognition",
        mode=WebRtcMode.SENDONLY,
        audio_receiver_size=1024,
        audio_processor_factory=StreamAudioProcessor,
        media_stream_constraints={"video": False, "audio": True},
    )
    
    # Primary Controls (Row)
    c_reset, c_giveup = st.columns(2)
    with c_reset:
         if st.button("Reset 🔄", help="Clear current speech", use_container_width=True):
             if ctx.audio_processor:
                 import numpy as np
                 ctx.audio_processor.current_transcript = ""
                 ctx.audio_processor.audio_buffer = np.array([], dtype=np.float32)
             st.session_state.user_transcript = ""
             st.rerun()
             
    with c_giveup:
         if st.button("Give Up 🏳️", use_container_width=True):
             # 1. Mark incorrect (No rerun yet)
             process_answer("", mask_data["target"], vocab.english_phrase, should_rerun=False)
             
             # 2. Unmask & Set Phase
             st.session_state.mask_data["masked_sentence"] = vocab.english_phrase
             st.session_state.feedback = {'is_correct': False, 'feedback': 'Gave Up'}
             st.session_state.give_up_phase = True # Flag to trigger phase 2
             
             # 3. Rerun to Render Red Text
             st.rerun()

    # Text Input (Collapsible for cleaner UI)
    submit_label = "Submit"
    if st.session_state.quiz_complete:
        submit_label = "Next Question >>"
    elif st.session_state.feedback and not st.session_state.feedback['is_correct']:
        submit_label = "Try Again 🔄"
        
    with st.expander("⌨️  Type Answer (Optional)"):
        with st.form(key="answer_form", clear_on_submit=False):
            text_input_val = st.text_input("Answer:", key="answer_input")
            submitted = st.form_submit_button(submit_label, use_container_width=True)

    # Check text input (Fallback)
    if submitted:
        process_answer(text_input_val, mask_data["target"], vocab.english_phrase)


    # Display Feedback (Pre-calculated/Pre-rendered before loop blocks)
    # Moved here (Line 416) so it renders BEFORE the streaming loop blocks execution
    if st.session_state.feedback:
        display_message = st.session_state.feedback['feedback']
        is_correct = st.session_state.feedback['is_correct']
        
        if is_correct:
             msg = display_message
             st.success(f"🎉 {msg}")
        else:
             st.error(f"❌ {display_message}")
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

    # --- Pronunciation Check (Always show after feedback, Correct or Give Up) ---
    # User requested to see this even if correct.
    if st.session_state.feedback:
         st.divider()
         import re
         cleaned_words = [re.sub(r'[^\w]', '', w) for w in vocab.english_phrase.split() if re.sub(r'[^\w]', '', w)]
         st.markdown("###### 🔍 Tap word for video pronunciation:")
         
         pills_key = f"pills_{vocab.id}"
         if hasattr(st, "pills"):
             selected_word = st.pills("", cleaned_words, selection_mode="single", key=pills_key, label_visibility="collapsed")
             
             if selected_word:
                 st.caption(f"📺 Pronunciation: **{selected_word}**")
                 import streamlit.components.v1 as components
                 
                 # Full Width Widget
                 yg_html = f"""
                 <a id="yg-widget-0" class="youglish-widget" data-query="{selected_word}" data-lang="english" data-accent="us"></a>
                 <script async src="https://youglish.com/public/emb/widget.js" charset="utf-8"></script>
                 """
                 components.html(yg_html, height=1000, scrolling=True)
                 st.markdown("<div style='margin-bottom: 200px;'></div>", unsafe_allow_html=True)

    # --- PHASE 2: GIVE UP ANIMATION / DELAY ---
    # Use session key to detect we are in "Showing Answer" mode
    if st.session_state.get("give_up_phase", False):
        st.session_state.give_up_phase = False # Reset flag so we don't loop forever
        
        # Audio Only (No Auto-Advance, so user can interact with pills)
        # The screen will remain on "Red Answer" + "Pills" state.
        # User needs to manually click "Try Again" or Speak correctly.
        time.sleep(0.5)
        speak(vocab.english_phrase, lang="en", stop_previous=False)
        # Removed auto-transition to allow usage of Pills
        
    # Processing Input (Streaming Loop)
    if ctx.state.playing:
        processor = ctx.audio_processor
        if processor:
            # Check for new question to force reset
            last_vid = st.session_state.get("last_vocab_id_streaming", None)
            if last_vid != vocab.id:
                # Reset internal processor state
                import numpy as np
                processor.current_transcript = ""
                processor.audio_buffer = np.array([], dtype=np.float32)
                st.session_state.user_transcript = ""
                st.session_state["last_vocab_id_streaming"] = vocab.id
                print(f"Processor Reset for new Vocab: {vocab.id}")
            
            while ctx.state.playing:
                # Poll queue for new transcript
                try:
                    # Non-blocking get? Or just read property?
                    # Using property is safer for polling loop without consuming queue if specific logic needed
                    # But queue is good for "new events".
                    # Let's check current_transcript directly from property
                    
                    new_text = processor.current_transcript
                    if new_text and new_text != st.session_state.user_transcript:
                        st.session_state.user_transcript = new_text
                        
                        # Update UI immediately
                        with sentence_placeholder.container():
                             render_cloze_sentence(
                                reference_text=vocab.english_phrase,
                                masked_text=mask_data["masked_sentence"],
                                user_transcript=new_text,
                                is_correct=is_correct_status
                            )
                        
                        # Check correctness dynamically using Similarity Threshold
                        # Pass user_input to evaluate_answer to check if it passes
                        # We use the curren threshold from session state
                        current_thresh = st.session_state.get("similarity_threshold", 0.90)
                        
                        # We use the service function to check
                        # Note: We need to import calculate_similarity or just use evaluate_answer directly
                        # evaluate_answer returns {is_correct, feedback}
                        
                        temp_result = evaluate_answer(vocab.english_phrase, new_text, vocab.english_phrase, threshold=current_thresh)
                        
                        if temp_result["is_correct"]:
                             # Auto-Submit!
                             process_answer(new_text, mask_data["target"], vocab.english_phrase)
                             break
                             
                except Exception as e:
                    print(e)
                
                time.sleep(0.1)

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



    # --- PHASE 2: GIVE UP ANIMATION / DELAY ---
    
    # Extra spacer at bottom
    st.markdown("<div style='height: 100px;'></div>", unsafe_allow_html=True)
