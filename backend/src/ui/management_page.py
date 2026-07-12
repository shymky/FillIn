import streamlit as st
import pandas as pd
from src.database.core import get_db
from src.database.models import Vocabulary, Tag, vocabulary_tags
from src.services.llm_service import generate_vocabulary_list, filter_vocabulary_by_theme

def management_page():
    st.title("Sentence Management 🛠️")
    st.info("Edit sentences and manage lists below.")

    db = next(get_db())
    vocabs = db.query(Vocabulary).all()
    
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

    st.divider()

    # --- SECTION 3: AI LIST GENERATOR ---
    st.subheader("3. AI List Generator 🤖")
    st.caption("Describe the kind of list you want, and AI will generate sentences for you.")

    with st.expander("AI Generator", expanded=True):
        ai_col1, ai_col2 = st.columns([3, 1])
        with ai_col1:
            ai_description = st.text_input("Description (e.g., 'Phrases for expressing disagreement', 'Kitchen vocabulary')", key="ai_desc")
        with ai_col2:
            ai_count = st.number_input("Count", min_value=1, max_value=20, value=5, key="ai_count")
            
        if st.button("Generate List ✨"):
            if not ai_description:
                st.warning("Please enter a description.")
            else:
                with st.spinner("Generating vocabulary using Ollama (Llama 3.2)..."):
                    generated_data = generate_vocabulary_list(ai_description, count=int(ai_count))
                    
                    if generated_data:
                        st.session_state.ai_generated_result = generated_data
                        st.success(f"Generated {len(generated_data)} items!")
                    else:
                        st.error("Failed to generate list. Please try again.")

        # Display Result if exists
        if "ai_generated_result" in st.session_state and st.session_state.ai_generated_result:
            st.markdown("##### Preview & Save")
            
            # Editor for review
            ai_df = pd.DataFrame(st.session_state.ai_generated_result)
            edited_ai_df = st.data_editor(
                ai_df,
                num_rows="dynamic",
                key="ai_editor",
                use_container_width=True
            )
            
            # Save Controls
            s_col1, s_col2 = st.columns([2, 1])
            with s_col1:
                # Option to save to a specific list
                existing_tag_names = [t.name for t in all_tags]
                save_tag = st.selectbox("Save to List (Optional)", ["(None)"] + existing_tag_names, key="ai_save_tag")
                
            with s_col2:
                if st.button("Save to Database 💾"):
                    added_count = 0
                    
                    # Target Tag
                    target_tag_obj = None
                    if save_tag != "(None)":
                        target_tag_obj = db.query(Tag).filter(Tag.name == save_tag).first()
                    
                    for index, row in edited_ai_df.iterrows():
                        new_vocab = Vocabulary(
                            japanese_meaning=row.get("japanese_meaning", ""),
                            english_phrase=row.get("english_phrase", ""),
                            target_word=row.get("target_word", ""),
                            proficiency_score=0
                        )
                        if target_tag_obj:
                            new_vocab.tags.append(target_tag_obj)
                            
                        db.add(new_vocab)
                        added_count += 1
                        
                    try:
                        db.commit()
                        st.success(f"Saved {added_count} new sentences to database!")
                        # Clear state
                        del st.session_state.ai_generated_result
                        st.rerun()
                    except Exception as e:
                        st.error(f"Error saving: {e}")

    st.divider()

    # --- SECTION 4: ORGANIZE EXISTING SENTENCES ---
    st.subheader("4. Organize Existing Sentences 🗂️")
    st.caption("Use AI to find sentences in your database that match a theme, and add them to a list.")
    
    with st.expander("AI Organizer", expanded=True):
        org_col1, org_col2 = st.columns([3, 1])
        with org_col1:
            org_theme = st.text_input("Criteria (e.g., 'Negative expressions', 'Using auxiliary verbs', 'Work')", key="org_theme")
        with org_col2:
             if st.button("Find Matches 🔍"):
                 if not org_theme:
                     st.warning("Enter a theme.")
                 else:
                     with st.spinner("Analyzing your database..."):
                         # 1. Fetch all vocab data
                         all_vocab_data = []
                         for v in vocabs:
                             all_vocab_data.append({
                                 "id": v.id,
                                 "english_phrase": v.english_phrase,
                                 "japanese_meaning": v.japanese_meaning
                             })
                         
                         # 2. Call LLM
                         matched_ids = filter_vocabulary_by_theme(all_vocab_data, org_theme)
                         
                         if matched_ids:
                             st.session_state.org_matched_ids = matched_ids
                             st.success(f"Found {len(matched_ids)} matches!")
                         else:
                             st.warning("No matches found.")
                             
        # Display Results
        if "org_matched_ids" in st.session_state and st.session_state.org_matched_ids:
             # Filter vocab objects
             matched_vocabs = [v for v in vocabs if v.id in st.session_state.org_matched_ids]
             
             st.markdown("##### matching Sentences")
             
             # Multiselect to refine
             vocab_options = {v.id: f"{v.id}: {v.english_phrase} ({v.japanese_meaning})" for v in matched_vocabs}
             final_selected_ids = st.multiselect(
                 "Confirm Selection",
                 options=vocab_options.keys(),
                 default=vocab_options.keys(),
                 format_func=lambda x: vocab_options[x],
                 key="org_final_select"
             )
             
             # Save Controls
             st.markdown("##### Assign to List")
             save_col1, save_col2 = st.columns([2, 1])
             
             with save_col1:
                 # Create New or Select Existing
                 # Actually simpler to just have input for NEW list name, or select box.
                 # Let's offer input for new list, defaulting to Theme name.
                 target_list_name = st.text_input("New or Existing List Name", value=org_theme, key="org_list_name")
                 
             with save_col2:
                 if st.button("Create/Assign List"):
                     if not final_selected_ids:
                         st.warning("No sentences selected.")
                     elif not target_list_name:
                         st.warning("Enter a list name.")
                     else:
                         # Logic: Find or Create Tag -> Assign
                         tag = db.query(Tag).filter(Tag.name == target_list_name).first()
                         if not tag:
                             tag = Tag(name=target_list_name)
                             db.add(tag)
                             db.commit() # Commit to get ID
                             st.toast(f"Created new list '{target_list_name}'")
                         
                         count = 0
                         for vid in final_selected_ids:
                             v_obj = db.query(Vocabulary).filter(Vocabulary.id == vid).first()
                             if v_obj and tag not in v_obj.tags:
                                 v_obj.tags.append(tag)
                                 count += 1
                         
                         db.commit()
                         st.success(f"Assigned {count} sentences to '{target_list_name}'!")
                         del st.session_state.org_matched_ids
                         st.rerun()
