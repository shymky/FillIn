import streamlit as st
import pandas as pd
from src.database.core import get_db
from src.database.models import Vocabulary

def management_page():
    st.title("Sentence Management 🛠️")
    st.info("Edit the table below to modify sentences. Changes are saved automatically when you click 'Save Changes'.")

    db = next(get_db())
    vocabs = db.query(Vocabulary).all()
    
    # helper to convert db objs to dict
    current_data = []
    for v in vocabs:
        current_data.append({
            "id": v.id,
            "japanese_meaning": v.japanese_meaning,
            "english_phrase": v.english_phrase,
            "target_word": v.target_word,
            "proficiency_score": v.proficiency_score
        })
        
    df = pd.DataFrame(current_data)
    if df.empty:
        # Create empty with columns if no data
        df = pd.DataFrame(columns=["id", "japanese_meaning", "english_phrase", "target_word", "proficiency_score"])

    # Editable Dataframe
    # We hide 'id' from user view if possible or make it disabled, but for simplicity showing it is fine for debugging, 
    # but strictly we shouldn't let them edit ID.
    edited_df = st.data_editor(
        df,
        num_rows="dynamic",
        column_config={
            "id": st.column_config.NumberColumn(disabled=True),
            "japanese_meaning": "Japanese Meaning",
            "english_phrase": "English Phrase",
            "target_word": "Target Word (Optional)",
            "proficiency_score": st.column_config.NumberColumn("Proficiency", min_value=0, max_value=100)
        },
        use_container_width=True,
        key="vocab_editor"
    )

    if st.button("Save Changes", type="primary"):
        # Detect Changes
        # This is a naive full sync implementation for robustness.
        # Ideally we track added/deleted/edited rows specifically, but full sync is safer for small datasets.
        
        # 1. Update/Add
        for index, row in edited_df.iterrows():
            vocab_id = row.get("id")
            
            # Check if new (NaN or None id)
            if pd.isna(vocab_id):
                # Add New
                new_vocab = Vocabulary(
                    japanese_meaning=row["japanese_meaning"],
                    english_phrase=row["english_phrase"],
                    target_word=row["target_word"],
                    proficiency_score=row["proficiency_score"] if not pd.isna(row["proficiency_score"]) else 0
                )
                db.add(new_vocab)
            else:
                # Update Existing
                # Because we re-query, we might need to handle session correctly.
                # Assuming 'row' data is authoritative.
                existing = db.query(Vocabulary).filter(Vocabulary.id == int(vocab_id)).first()
                if existing:
                    existing.japanese_meaning = row["japanese_meaning"]
                    existing.english_phrase = row["english_phrase"]
                    existing.target_word = row["target_word"]
                    existing.proficiency_score = row["proficiency_score"]
        
        # 2. Deletions
        # Collect all IDs currently in the edited DF
        current_ids = [int(r["id"]) for index, r in edited_df.iterrows() if not pd.isna(r["id"])]
        
        # Find DB items not in current_ids
        to_delete = db.query(Vocabulary).filter(Vocabulary.id.notin_(current_ids)).all()
        for item in to_delete:
            db.delete(item)
            
        try:
            db.commit()
            st.success("Changes saved successfully!")
            st.rerun()
        except Exception as e:
            st.error(f"Error saving changes: {e}")
            db.rollback()
