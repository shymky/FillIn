import streamlit as st
import pandas as pd
import time
import random
from src.database.core import get_db
from src.database.models import Vocabulary
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
    vocabs = db.query(Vocabulary).all()
    
    if not vocabs:
        st.info("No sentences found.")
        return
        
    # --- Listening Mode UI ---
    with st.expander("🎧 Listening Mode (Background Play)", expanded=st.session_state.listening_active):
        c1, c2, c3 = st.columns([2, 2, 1])
        with c1:
            mode = st.selectbox("Order", ["Ascending", "Descending", "Random"], key="listen_mode")
        with c2:
            pattern = st.radio("Pattern", ["English Only", "Japanese → English"], key="listen_pattern_ui")
            
        with c3:
            st.write("") # Spacer
            st.write("")
            if not st.session_state.listening_active:
                st.button("▶️ Start", on_click=start_listening, args=(mode, pattern, vocabs))
            else:
                st.button("⏹️ Stop", on_click=stop_listening)
        
        # Playback Loop (Auto-running if active)
        if st.session_state.listening_active and st.session_state.playlist:
            # Get current track
            idx = st.session_state.current_track_index
            if idx < len(st.session_state.playlist):
                vocab = st.session_state.playlist[idx]
                
                st.info(f"Now Playing: {vocab.id}. {vocab.english_phrase}")
                
                # Japanese Audio (if selected)
                if st.session_state.get("listen_pattern") == "Japanese → English":
                     speak(vocab.japanese_meaning, lang="ja")
                     # Estimate sleep: ~0.2s per char for JP
                     jp_duration = len(vocab.japanese_meaning) * 0.2 + 1.2
                     time.sleep(jp_duration)
                
                # English Audio
                speak(vocab.english_phrase, lang="en")
                
                # Estimate sleep time: 0.08s per char + 1.5s buffer
                duration = len(vocab.english_phrase) * 0.08 + 1.5
                time.sleep(duration)
                
                # Next track
                st.session_state.current_track_index += 1
                st.rerun()
            else:
                # End of playlist
                st.success("Playlist finished!")
                st.session_state.listening_active = False
                
    st.divider()

    # --- Data Table ---
    data = [{
        "ID": v.id,
        "Japanese": v.japanese_meaning,
        "English": v.english_phrase,
        "Proficiency": v.proficiency_score
    } for v in vocabs]
    
    df = pd.DataFrame(data)
    st.dataframe(df, use_container_width=True, hide_index=True)
