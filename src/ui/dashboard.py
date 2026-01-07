import streamlit as st
from src.database.core import get_db
from src.database.models import Vocabulary

def dashboard_page():
    st.title("Home 🏠")
    
    db = next(get_db())
    total_vocab = db.query(Vocabulary).count()
    
    st.markdown(f"""
    ### Welcome to Context Cloze Trainer!
    
    **Current Stats:**
    - 📚 **Total Sentences:** {total_vocab}
    
    **Activities:**
    - **Quiz**: Practice blank filling with voice input.
    - **Review**: Browse your sentence collection.
    - **Manage**: Add or edit sentences.
    """)
