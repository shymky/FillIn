
import streamlit as st
import time
import random
import os
from src.database.core import get_db
from src.database.models import Vocabulary, Tag
from src.services.audio_service import speak, generate_audio_path
from src.services.media_service import get_media_service
from pydub import AudioSegment

def init_listening_state():
    defaults = {
        "lp_active": False,
        "lp_playlist": [],
        "lp_index": 0,
        "lp_mode": "Random", # Ascending, Descending, Random
        "lp_repeat": "All", # All, One List, One Sentence
        "lp_pattern": "Japanese → English", # English Only, Japanese → English
        "lp_filter_tag": "All Items",
        "lp_confirm_video_dl": False,
        "lp_repeat_count": 2, # New setting: N repeats per track
        "lp_current_repeat": 0, # Current repeat iteration
    }
    for k, v in defaults.items():
        if k not in st.session_state:
            st.session_state[k] = v

def get_filtered_vocab(db):
    query = db.query(Vocabulary)
    tag_name = st.session_state.lp_filter_tag
    
    if tag_name != "All Items":
        query = query.join(Vocabulary.tags).filter(Tag.name == tag_name)
    
    # Sort based on mode just for initial list, but "Random" mode will shuffle later
    # "Ascending" by ID is a safe default underlying sort
    query = query.order_by(Vocabulary.id.asc())
    
    return query.all()

def build_playlist(vocabs):
    mode = st.session_state.lp_mode
    playlist = [v for v in vocabs]
    
    if mode == "Random":
        random.shuffle(playlist)
    elif mode == "Descending":
        playlist.reverse()
    
    st.session_state.lp_playlist = playlist
    st.session_state.lp_index = 0
    st.session_state.lp_current_repeat = 0 # Reset
    st.session_state.lp_active = True 
    
def toggle_play():
    st.session_state.lp_active = not st.session_state.lp_active

def next_track():
    if not st.session_state.lp_playlist: return
    
    # Reset repeat counter on manual or auto change
    st.session_state.lp_current_repeat = 0
    
    idx = st.session_state.lp_index
    if idx + 1 < len(st.session_state.lp_playlist):
        st.session_state.lp_index += 1
    else:
        # End of list
        if st.session_state.lp_repeat == "All":
            st.session_state.lp_index = 0 # Loop back
        else:
            # stop
            st.session_state.lp_active = False

def prev_track():
    if not st.session_state.lp_playlist: return
    
    st.session_state.lp_current_repeat = 0
    
    idx = st.session_state.lp_index
    if idx - 1 >= 0:
        st.session_state.lp_index -= 1
    else:
        st.session_state.lp_index = 0 # Stay at start

def listening_page():
    init_listening_state()
    st.title("Listening Mood 🎧")
    
    db = next(get_db())
    
    # --- Top Bar: Filter & Settings ---
    with st.expander("Settings & Filter", expanded=not st.session_state.lp_active):
        c1, c2, c3 = st.columns(3)
        
        # Filter
        tags = db.query(Tag).all()
        tag_names = ["All Items"] + [t.name for t in tags]
        
        with c1:
            st.selectbox(
                "Filter by List", 
                tag_names, 
                key="lp_filter_tag"
            )

        with c2:
            st.selectbox("Order", ["Random", "Ascending", "Descending"], key="lp_mode")
            
        with c3:
            st.radio("Pattern", ["Japanese → English", "English Only"], key="lp_pattern")
            st.selectbox("Repeats per Sentence", [1, 2, 3, 5, 10], key="lp_repeat_count", help="How many times to play each sentence before moving to next.")
            
        if st.button("Load Playlist"):
            vocabs = get_filtered_vocab(db)
            if not vocabs:
                st.error("No sentences found.")
            else:
                build_playlist(vocabs)
                st.success(f"Loaded {len(vocabs)} sentences.")
                st.session_state.lp_active = False # Reset state to paused at start

    st.divider()

    # --- Music Player UI ---
    
    if not st.session_state.lp_playlist:
        st.info("Please load a playlist from the settings above.")
        return

    # Get current track
    try:
        vocab = st.session_state.lp_playlist[st.session_state.lp_index]
    except IndexError:
        st.session_state.lp_index = 0
        vocab = st.session_state.lp_playlist[0]

    # --- Display Area ---
    # Centered, large text
    
    # Custom CSS for "Music Player" look
    st.markdown("""
    <style>
    .player-container {
        text-align: center;
        padding: 40px 20px;
        background-color: #f0f2f6;
        border-radius: 20px;
        margin-bottom: 20px;
    }
    .japanese-text {
        font-size: 24px;
        font-weight: bold;
        color: #333;
        margin-bottom: 20px;
    }
    .english-text {
        font-size: 32px;
        font-weight: bold;
        color: #0e1117;
        margin-bottom: 10px;
    }
    .status-text {
        font-size: 14px;
        color: #666;
    }
    </style>
    """, unsafe_allow_html=True)
    
    with st.container():
        html_content = f"""
        <div class="player-container">
            {'<div class="japanese-text">' + vocab.japanese_meaning + '</div>' if st.session_state.lp_pattern == "Japanese → English" else '<div class="japanese-text" style="color:#ccc;">(Hidden)</div>'}
            <div class="english-text">{vocab.english_phrase}</div>
            <div class="status-text">Track {st.session_state.lp_index + 1} / {len(st.session_state.lp_playlist)}</div>
        </div>
        """
        st.markdown(html_content, unsafe_allow_html=True)

    # --- Controls ---
    c_prev, c_play, c_next = st.columns([1, 1, 1])
    
    with c_prev:
        st.button("⏮️", on_click=prev_track, use_container_width=True)
    
    with c_play:
        label = "⏸️ Pause" if st.session_state.lp_active else "▶️ Play"
        st.button(label, on_click=toggle_play, use_container_width=True)
        
    with c_next:
        st.button("⏭️", on_click=next_track, use_container_width=True)
        
    # --- Repeat / Shuffle Options (Quick Toggles) ---
    rc1, rc2 = st.columns(2)
    with rc1:
        # Cycle repeat modes: All -> One -> Sent -> All
        modes = ["All", "One List", "One Sentence"]
        
        # Helper to sync UI checkbox with backend state
        def on_repeat_toggle():
             if st.session_state.lp_repeat_one_check:
                 st.session_state.lp_repeat = "One Sentence"
             else:
                 st.session_state.lp_repeat = "All"

        # Checkbox initialized with current state, updates via callback
        st.checkbox(
            "Repeat One", 
            value=(st.session_state.lp_repeat == "One Sentence"),
            key="lp_repeat_one_check",
            on_change=on_repeat_toggle
        )
             
    # --- Download Section ---
    st.divider()
    with st.expander("Downloads 📥"):
        st.caption("Generate offline files for the current sentence.")
        
        d_col1, d_col2 = st.columns(2)
        
        with d_col1:
            if st.button("Generate Audio (MP3) 🎵"):
                with st.spinner("Generating Audio..."):
                    media_service = get_media_service()
                    mp3_path = media_service.generate_combined_audio(vocab)
                    if mp3_path and os.path.exists(mp3_path):
                        with open(mp3_path, "rb") as f:
                            st.download_button(
                                label="Download MP3",
                                data=f,
                                file_name=f"fillin_audio_{vocab.id}.mp3",
                                mime="audio/mpeg"
                            )
                    else:
                        st.error("Failed to generate audio.")

        with d_col2:
            if st.button("Generate Video (MP4) 🎥"):
                with st.spinner("Generating Video... (This may take a moment)"):
                    media_service = get_media_service()
                    mp4_path = media_service.generate_video(vocab)
                    if mp4_path and os.path.exists(mp4_path):
                        with open(mp4_path, "rb") as f:
                            st.download_button(
                                label="Download MP4",
                                data=f,
                                file_name=f"fillin_video_{vocab.id}.mp4",
                                mime="video/mp4"
                            )
                    else:
                        st.error("Failed to generate video.")

        st.markdown("---")
        st.caption("Generate files for the **entire playlist** (Current Filter).")
        
        pd_col1, pd_col2 = st.columns(2)
        
        with pd_col1:
            if st.button("Download Playlist Audio (MP3) 🎶"):
                if not st.session_state.lp_playlist:
                     st.warning("Playlist is empty.")
                else:
                    with st.spinner(f"Generating Audio for {len(st.session_state.lp_playlist)} items..."):
                        media_service = get_media_service()
                        # Use current playlist
                        playlist_mp3 = media_service.generate_playlist_audio(st.session_state.lp_playlist)
                        if playlist_mp3 and os.path.exists(playlist_mp3):
                            with open(playlist_mp3, "rb") as f:
                                st.download_button(
                                    label=f"Download Full MP3 ({len(st.session_state.lp_playlist)} items)",
                                    data=f,
                                    file_name=f"fillin_playlist_audio.mp3",
                                    mime="audio/mpeg"
                                )
                        else:
                            st.error("Failed to generate playlist audio.")

        with pd_col2:
            if st.button("Download Playlist Video (MP4) 🎬"):
                if not st.session_state.lp_playlist:
                     st.warning("Playlist is empty.")
                else:
                    st.session_state.lp_confirm_video_dl = True
            
            if st.session_state.lp_confirm_video_dl:
                count = len(st.session_state.lp_playlist)
                st.warning(f"Generating video for {count} items. This will take approx {count * 10} seconds.")
                
                c_conf1, c_conf2 = st.columns(2)
                with c_conf1:
                    if st.button("Confirm & Start Generation"):
                        with st.spinner(f"Rendering Video for {count} items..."):
                            media_service = get_media_service()
                            playlist_mp4 = media_service.generate_playlist_video(st.session_state.lp_playlist)
                            if playlist_mp4 and os.path.exists(playlist_mp4):
                                # Save in session state or just show button?
                                # Ideally we shouldn't re-run logic.
                                st.session_state.lp_generated_video_path = playlist_mp4
                                st.success("Video Generated!")
                            else:
                                st.error("Failed to generate playlist video.")
                        
                        st.session_state.lp_confirm_video_dl = False
                        
                with c_conf2:
                    if st.button("Cancel"):
                        st.session_state.lp_confirm_video_dl = False
                        st.rerun()

            # Show download button if ready (persistently?)
            # Actually, the file path needs to be valid.
            if "lp_generated_video_path" in st.session_state and os.path.exists(st.session_state.lp_generated_video_path):
                 with open(st.session_state.lp_generated_video_path, "rb") as f:
                     st.download_button(
                         label="Download Generated Video MP4",
                         data=f,
                         file_name="fillin_playlist_video.mp4",
                         mime="video/mp4"
                     )


    # --- Auto-Play Logic ---
    if st.session_state.lp_active:
        # Non-blocking delay? No, we need to block to speak.
        # But we want the UI to render FIRST, then speak.
        # Streamlit runs script from top to bottom.
        # So we render UI above. Now we speak.
        
        # 1. Speak Japanese (if enabled)
        # 1. Speak Japanese (if enabled)
        if st.session_state.lp_pattern == "Japanese → English":
            speak(vocab.japanese_meaning, lang="ja")
            # Calculate wait time approx (Reduced)
            # Use exact duration
            try:
                 jp_path = generate_audio_path(vocab.japanese_meaning, lang="ja")
                 if jp_path and os.path.exists(jp_path):
                     dur = AudioSegment.from_file(jp_path).duration_seconds
                     time.sleep(dur + 0.3) # 0.3s gap
                 else:
                     time.sleep(len(vocab.japanese_meaning) * 0.1 + 0.5)
            except:
                 time.sleep(len(vocab.japanese_meaning) * 0.1 + 0.5)
            
        # 2. Speak English
        speak(vocab.english_phrase, lang="en")
        try:
             en_path = generate_audio_path(vocab.english_phrase, lang="en")
             if en_path and os.path.exists(en_path):
                 dur = AudioSegment.from_file(en_path).duration_seconds
                 time.sleep(dur + 0.3) # 0.3s gap
             else:
                 time.sleep(len(vocab.english_phrase) * 0.05 + 0.8)
        except:
             time.sleep(len(vocab.english_phrase) * 0.05 + 0.8)
        
        # 3. Advance Logic
        # 3. Advance Logic
        if st.session_state.lp_repeat == "One Sentence":
            # Infinite Repeat (Override count)
            time.sleep(1.0) 
            st.rerun()
        else:
            # Check Repeat Count
            st.session_state.lp_current_repeat += 1
            
            if st.session_state.lp_current_repeat < st.session_state.lp_repeat_count:
                # Repeat same track
                time.sleep(1.0)
                st.rerun()
            else:
                # Move next
                # Check if we should stop
                if st.session_state.lp_index + 1 >= len(st.session_state.lp_playlist) and st.session_state.lp_repeat != "All":
                     st.session_state.lp_active = False # Stop at end
                     st.rerun()
                else:
                    next_track() # updates index and resets current_repeat
                    st.rerun()
