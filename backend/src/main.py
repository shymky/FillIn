import sys
import os
import warnings

# Suppress pydub SyntaxWarnings
warnings.filterwarnings("ignore", category=SyntaxWarning, module="pydub")

# Ensure src is in path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import streamlit as st
from src.database.core import init_db
from src.ui.quiz_page import quiz_page
from src.ui.dashboard import dashboard_page
from src.ui.review_page import review_page
from src.ui.listening_page import listening_page
from src.ui.management_page import management_page
from src.ui.settings_page import settings_page

def main():
    st.set_page_config(page_title="FillIn", layout="wide", page_icon="📝")
    
    # Initialize DB
    init_db()

    with st.sidebar:
        st.title("FillIn")
        page = st.radio("Navigation", ["Home 🏠", "Quiz 📝", "Review 📖", "Listening 🎧", "Manage Sentences 🛠️", "Settings ⚙️"], label_visibility="collapsed")
        st.divider()
        st.caption("Made for effective learning.")

    if "Home" in page:
        dashboard_page()
    elif "Quiz" in page:
        quiz_page()
    elif "Review" in page:
        review_page()
    elif "Listening" in page:
        listening_page()
    elif "Manage" in page:
        management_page()
    elif "Settings" in page:
        settings_page()

if __name__ == "__main__":
    main()
