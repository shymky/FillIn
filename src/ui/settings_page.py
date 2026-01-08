import streamlit as st
from src.services.audio_service import speak

# Voice Options (Global for callback access)
# Voice Options (Global for callback access)
en_voices = {
    "Ava (US Female - Default)": "en-US-AvaNeural",
    "Andrew (US Male)": "en-US-AndrewNeural",
    "Emma (US Female)": "en-US-EmmaNeural",
    "Brian (US Male)": "en-US-BrianNeural",
    "Sonia (UK Female)": "en-GB-SoniaNeural",
    "Ryan (UK Male)": "en-GB-RyanNeural",
}

ja_voices = {
    "Nanami (Female - Default)": "ja-JP-NanamiNeural",
    "Keita (Male)": "ja-JP-KeitaNeural",
}

def preview_volume():
    speak("Volume check.", lang="en")

def preview_en_speed():
    speak("This is the English reading speed.", lang="en")

def preview_ja_speed():
    speak("これは日本語の読み上げ速度です。", lang="ja")

def preview_en_voice():
    # Update session state ID immediately so 'speak' uses the new voice
    if "en_voice_select" in st.session_state:
        full_name = st.session_state.en_voice_select
        short_name = full_name.split(" ")[0]
        # Update ID
        st.session_state.en_voice = en_voices[full_name]
        speak(f"Hi there, I'm {short_name}.", lang="en")

def preview_ja_voice():
    if "ja_voice_select" in st.session_state:
        full_name = st.session_state.ja_voice_select
        short_name = full_name.split(" ")[0]
        # Update ID
        st.session_state.ja_voice = ja_voices[full_name]
        speak(f"こんにちは！{short_name}だよ！よろしくね！", lang="ja")

def settings_page():
    st.title("Settings ⚙️")
    
    st.subheader("Audio Settings")
    
    # Volume Control (Simulated / Stored in state for 'play_sound' to use)
    # Note: `afplay` supports -v (volume). We need to pass this to the service.
    if "app_volume" not in st.session_state:
        st.session_state.app_volume = 1.0
        
    st.slider(
        "Volume", 
        min_value=0.0, 
        max_value=2.0, 
        step=0.1,
        key="app_volume",
        on_change=preview_volume
    )
    
    st.divider()

    st.subheader("Audio Voice Settings 🗣️")

    col_v1, col_v2 = st.columns(2)
    
    with col_v1:
        if "en_voice" not in st.session_state:
            st.session_state.en_voice = "en-US-AvaNeural"
            
        # Helper to find key by value for default index
        en_options = list(en_voices.keys())
        current_en_value = st.session_state.en_voice
        default_index = 0
        for i, name in enumerate(en_options):
            if en_voices[name] == current_en_value:
                default_index = i
                break
        
        selected_en_name = st.selectbox(
            "English Voice",
            options=en_options,
            index=default_index,
            key="en_voice_select",
            on_change=preview_en_voice
        )
        # Ensure consistency on render
        st.session_state.en_voice = en_voices[selected_en_name]

    with col_v2:
        if "ja_voice" not in st.session_state:
            st.session_state.ja_voice = "ja-JP-NanamiNeural"

        ja_options = list(ja_voices.keys())
        current_ja_value = st.session_state.ja_voice
        default_index = 0
        for i, name in enumerate(ja_options):
            if ja_voices[name] == current_ja_value:
                default_index = i
                break
                
        selected_ja_name = st.selectbox(
            "Japanese Voice",
            options=ja_options,
            index=default_index,
            key="ja_voice_select",
            on_change=preview_ja_voice
        )
        # Ensure consistency on render
        st.session_state.ja_voice = ja_voices[selected_ja_name]

    st.divider()
    
    st.subheader("Audio Speed Settings ⏩")
    
    col1, col2 = st.columns(2)
    with col1:
        # English Speed
        if "en_speed" not in st.session_state:
            st.session_state.en_speed = "+0%"
        
        st.select_slider(
            "English Speed",
            options=["-50%", "-25%", "+0%", "+25%", "+50%"],
            key="en_speed",
            on_change=preview_en_speed,
            help="Adjust the reading speed for English sentences."
        )

    with col2:
        # Japanese Speed
        if "ja_speed" not in st.session_state:
            st.session_state.ja_speed = "+0%"
            
        st.select_slider(
            "Japanese Speed",
            options=["-50%", "-25%", "+0%", "+25%", "+50%"],
            key="ja_speed",
            on_change=preview_ja_speed,
            help="Adjust the reading speed for Japanese translations."
        )
    
    st.divider()

    st.subheader("Review Mode Defaults 🎧")
    
    col_r1, col_r2 = st.columns(2)
    
    with col_r1:
        if "default_review_order" not in st.session_state:
            st.session_state.default_review_order = "Random"
            
        st.selectbox(
            "Default Order",
            options=["Ascending", "Descending", "Random"],
            key="default_review_order"
        )
        
    with col_r2:
        if "default_review_pattern" not in st.session_state:
            st.session_state.default_review_pattern = "Japanese → English"
            
        st.radio(
            "Default Pattern",
            options=["English Only", "Japanese → English"],
            key="default_review_pattern"
        )
    
    st.caption("Note: This volume setting controls the sound effects and reading voice playback.")
    
    st.divider()
    
    st.subheader("System Information")
    st.text("FillIn v1.0")
    st.text("Running on: macOS")
