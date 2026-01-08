import streamlit as st
import pandas as pd
import time
import random
from src.database.core import get_db
from src.database.models import Vocabulary, Tag
from src.services.audio_service import speak

def get_review_state():
    if "listening_active" not in st.session_state:
        st.session_state.listening_active = False
    if "playlist" not in st.session_state:
        st.session_state.playlist = []
    if "current_track_index" not in st.session_state:
        st.session_state.current_track_index = 0

def start_listening(mode, pattern, vocabs):
    st.session_state.listening_active = True
    st.session_state.current_track_index = 0
    st.session_state.listen_pattern = pattern
    
    # Create playlist based on mode
    playlist = [v for v in vocabs] # Copy
    if mode == "Random":
        random.shuffle(playlist)
    elif mode == "Descending":
        playlist.reverse()
    # Ascending is default
    
    st.session_state.playlist = playlist

def stop_listening():
    st.session_state.listening_active = False
    st.session_state.playlist = []

def review_page():
    get_review_state()
    st.title("Review 📖")
    
    db = next(get_db())
    
    # --- Controls ---
    c1, c2, c3 = st.columns([1.5, 1.5, 1])
    
    # Filter by Tag
    tags = db.query(Tag).all()
    tag_names = ["All Items"] + [t.name for t in tags]
    
    # Store filter in session state to persist during reruns
    if "review_filter_tag" not in st.session_state:
        st.session_state.review_filter_tag = "All Items"

    with c1:
        selected_tag = st.selectbox(
            "Filter by List", 
            tag_names, 
            index=tag_names.index(st.session_state.review_filter_tag) if st.session_state.review_filter_tag in tag_names else 0,
            key="tag_filter_box",
            on_change=lambda: st.session_state.update({"review_filter_tag": st.session_state.tag_filter_box})
        )
        st.session_state.review_filter_tag = selected_tag
        
    # Sort Order
    with c2:
        sort_order = st.selectbox("Sort Order", ["ID (Default)", "Proficiency (Low->High)", "Proficiency (High->Low)"])

    # Build Query based on filter
    query = db.query(Vocabulary)
    if selected_tag != "All Items":
        query = query.join(Vocabulary.tags).filter(Tag.name == selected_tag)
        
    if "Proficiency (Low->High)" in sort_order:
        query = query.order_by(Vocabulary.proficiency_score.asc())
    elif "Proficiency (High->Low)" in sort_order:
        query = query.order_by(Vocabulary.proficiency_score.desc())
    else:
        query = query.order_by(Vocabulary.id.asc())
    
    vocabs = query.all()
    
    # --- Listening Mode UI ---
    if "listen_mode" not in st.session_state:
        st.session_state.listen_mode = st.session_state.get("default_review_order", "Random")
    if "listen_pattern_ui" not in st.session_state:
        st.session_state.listen_pattern_ui = st.session_state.get("default_review_pattern", "Japanese → English")

    with st.expander("🎧 Listening Mode (Background Play)", expanded=st.session_state.listening_active):
        lc1, lc2, lc3 = st.columns([2, 2, 1])
        with lc1:
            mode = st.selectbox("Order", ["Ascending", "Descending", "Random"], key="listen_mode")
        with lc2:
            pattern = st.radio("Pattern", ["English Only", "Japanese → English"], key="listen_pattern_ui")
            
        with lc3:
            st.write("") 
            st.write("")
            if not st.session_state.listening_active:
                # Pass filtered vocabs to listening mode
                st.button("▶️ Start", on_click=start_listening, args=(mode, pattern, vocabs))
            else:
                st.button("⏹️ Stop", on_click=stop_listening)
        
        # Playback Loop
        if st.session_state.listening_active and st.session_state.playlist:
            idx = st.session_state.current_track_index
            if idx < len(st.session_state.playlist):
                vocab = st.session_state.playlist[idx]
                st.info(f"Now Playing: {vocab.id}. {vocab.english_phrase}")
                
                if st.session_state.get("listen_pattern") == "Japanese → English":
                     speak(vocab.japanese_meaning, lang="ja")
                     jp_duration = len(vocab.japanese_meaning) * 0.2 + 1.2
                     time.sleep(jp_duration)
                
                speak(vocab.english_phrase, lang="en")
                duration = len(vocab.english_phrase) * 0.08 + 1.5
                time.sleep(duration)
                
                st.session_state.current_track_index += 1
                st.rerun()
            else:
                st.success("Playlist finished!")
                st.session_state.listening_active = False

    st.divider()

    # --- Data Table ---
    if not vocabs:
        st.info("No sentences found matching the filter.")
    else:
        data = []
        for v in vocabs:
            tag_list = ", ".join([t.name for t in v.tags])
            data.append({
                "ID": v.id,
                "Status": v.status,
                "Japanese": v.japanese_meaning,
                "English": v.english_phrase,
                "Proficiency": v.proficiency_score,
                "Lists": tag_list
            })
        
        df = pd.DataFrame(data)
        st.dataframe(
            df, 
            width="stretch", 
            hide_index=True,
            column_config={
                "Status": st.column_config.TextColumn("Status", width="small"),
                "Lists": st.column_config.TextColumn("Lists", width="medium"),
            }
        )
