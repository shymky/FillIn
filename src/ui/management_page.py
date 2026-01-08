import streamlit as st
import pandas as pd
from src.database.core import get_db
from src.database.models import Vocabulary, Tag, vocabulary_tags

def management_page():
    st.title("Sentence Management 🛠️")
    st.info("Edit sentences and manage lists below.")

    db = next(get_db())
    vocabs = db.query(Vocabulary).all()
    
    # --- SECTION 1: SENTENCE EDITOR ---
    st.subheader("1. Edit Sentences")
    
    # Helper: Get tags for each vocab
    data = []
    for v in vocabs:
        tag_names = ", ".join([t.name for t in v.tags])
        data.append({
            "id": v.id,
            "japanese_meaning": v.japanese_meaning,
            "english_phrase": v.english_phrase,
            "target_word": v.target_word,
            "proficiency_score": v.proficiency_score,
            "review_step": v.review_step,
            "next_review_at": v.next_review_at,
            "tags": tag_names
        })
        
    df = pd.DataFrame(data)
    if df.empty:
         df = pd.DataFrame(columns=["id", "japanese_meaning", "english_phrase", "target_word", "proficiency_score", "tags"])

    edited_df = st.data_editor(
        df,
        num_rows="dynamic",
        column_config={
            "id": st.column_config.NumberColumn(disabled=True, width="small"),
            "japanese_meaning": "Japanese Meaning",
            "english_phrase": "English Phrase",
            "target_word": "Target Word",
            "proficiency_score": st.column_config.NumberColumn("Score", disabled=True),
            "review_step": st.column_config.NumberColumn("Step", disabled=True),
            "next_review_at": st.column_config.DateColumn("Next Review", disabled=True, format="YYYY-MM-DD"),
            "tags": st.column_config.TextColumn("Lists", disabled=True)
        },
        width="stretch",
        key="vocab_editor"
    )
    
    if st.button("Save Changes (Text Only)", type="primary"):
        # Same logic as before for text updates
        for index, row in edited_df.iterrows():
            vocab_id = row.get("id")
            if pd.isna(vocab_id):
                new_vocab = Vocabulary(
                    japanese_meaning=row["japanese_meaning"],
                    english_phrase=row["english_phrase"],
                    target_word=row["target_word"],
                    proficiency_score=0
                )
                db.add(new_vocab)
            else:
                existing = db.query(Vocabulary).filter(Vocabulary.id == int(vocab_id)).first()
                if existing:
                    existing.japanese_meaning = row["japanese_meaning"]
                    existing.english_phrase = row["english_phrase"]
                    existing.target_word = row["target_word"]
        
        # Deletion Logic
        current_ids = [int(r["id"]) for index, r in edited_df.iterrows() if not pd.isna(r["id"])]
        to_delete = db.query(Vocabulary).filter(Vocabulary.id.notin_(current_ids)).all()
        for item in to_delete:
            db.delete(item)
            
        try:
            db.commit()
            st.success("Text changes saved!")
            st.rerun()
        except Exception as e:
            st.error(f"Error: {e}")
            
    st.divider()

    # --- SECTION 2: LIST MANAGEMENT ---
    st.subheader("2. Manage Lists (Tags)")
    
    col_manage, col_assign = st.columns(2)
    
    all_tags = db.query(Tag).all()
    
    # Left Column: Create & Delete Lists
    with col_manage:
        st.markdown("##### Create / Delete Lists")
        # Create
        with st.form("create_tag_form", clear_on_submit=True):
            new_tag_name = st.text_input("New List Name")
            if st.form_submit_button("Create List"):
                if new_tag_name:
                    existing = db.query(Tag).filter(Tag.name == new_tag_name).first()
                    if not existing:
                        db.add(Tag(name=new_tag_name))
                        db.commit()
                        st.success(f"Created list '{new_tag_name}'")
                        st.rerun()
                    else:
                        st.warning("List already exists.")
        
        st.write("---")
        st.write("**Existing Lists:**")
        if not all_tags:
            st.caption("No lists yet.")
        for t in all_tags:
            c_tag_name, c_tag_del = st.columns([3, 1])
            c_tag_name.write(f"- {t.name} ({len(t.vocabularies)} items)")
            if c_tag_del.button("Del", key=f"del_{t.id}"):
                db.delete(t)
                db.commit()
                st.rerun()

    # Right Column: Assign Sentences
    with col_assign:
        st.markdown("##### Assign Sentences to List")
        if not all_tags:
            st.warning("Create a list first.")
        else:
            selected_tag = st.selectbox("Select List", [t.name for t in all_tags], key="assign_tag_select")
            
            # Multi-select sentences
            vocab_options = {v.id: f"{v.id}: {v.english_phrase[:40]}..." for v in vocabs}
            selected_vocab_ids = st.multiselect("Select Sentences", options=vocab_options.keys(), format_func=lambda x: vocab_options[x], key="assign_vocab_select")
                
            if st.button("Add Selected Sentences to List", key="assign_btn"):
                target_tag = db.query(Tag).filter(Tag.name == selected_tag).first()
                if target_tag:
                    count = 0
                    for vid in selected_vocab_ids:
                        v_obj = db.query(Vocabulary).filter(Vocabulary.id == vid).first()
                        if v_obj and target_tag not in v_obj.tags:
                            v_obj.tags.append(target_tag)
                            count += 1
                    db.commit()
                    st.success(f"Added {count} sentences to '{selected_tag}'!")
                    st.rerun()
