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

    if "current_track_index" not in st.session_state:
        st.session_state.current_track_index = 0

def review_page():
    get_review_state()
    st.title("Review 📖")
    
    db = next(get_db())
    
    # --- Custom CSS for Larger Tables ---
    st.markdown("""
    <style>
    /* Increase font size for dataframe/data_editor tables */
    .stDataFrame div[data-testid="stDataFrame"] div[role="grid"] div[role="row"] div {
        font-size: 18px !important;
    }
    .stDataFrame div[data-testid="stDataFrame"] div[role="columnheader"] {
        font-size: 18px !important;
        font-weight: bold !important;
    }
    </style>
    """, unsafe_allow_html=True)
    
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
