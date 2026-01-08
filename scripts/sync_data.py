import pandas as pd
import os
import sys

# Ensure src is in path (Must be before imports from src)
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from sqlalchemy.orm import Session
from src.database.core import get_db, init_db
from src.database.models import Vocabulary

def export_db_to_file(file_path: str):
    """Exports the current database to a file (CSV or Excel)."""
    db: Session = next(get_db())
    vocabs = db.query(Vocabulary).all()
    
    data = []
    for v in vocabs:
        data.append({
            "Japanese": v.japanese_meaning,
            "English": v.english_phrase,
            "Target Word (Optional)": v.target_word,
            "Proficiency": v.proficiency_score or 0
        })
    
    df = pd.DataFrame(data)
    
    try:
        if file_path.endswith(".csv"):
            df.to_csv(file_path, index=False)
        else:
            df.to_excel(file_path, index=False)
        print(f"Exported {len(data)} items to {file_path}")
    except Exception as e:
        print(f"Export Error: {e}")

def import_file_to_db(file_path: str):
    """Imports a file into the database (Merge/Update)."""
    if not os.path.exists(file_path):
        print(f"File not found: {file_path}")
        return

    try:
        if file_path.endswith(".csv"):
            df = pd.read_csv(file_path, on_bad_lines='skip')
            # Handle NaN values being read as float nan
            df = df.fillna("")
        else:
            df = pd.read_excel(file_path)
            df = df.fillna("")
    except Exception as e:
        print(f"Error reading file: {e}")
        return

    db: Session = next(get_db())
    
    added_count = 0
    updated_count = 0
    
    # Expected columns: Japanese, English
    for _, row in df.iterrows():
        japanese = str(row.get("Japanese", "")).strip()
        english = str(row.get("English", "")).strip()
        
        if not japanese or not english:
            continue
            
        # Check if exists
        existing = db.query(Vocabulary).filter_by(english_phrase=english).first()
        
        if existing:
            # Update only if changed? For now, we trust file as master if importing.
            if existing.japanese_meaning != japanese:
                existing.japanese_meaning = japanese
                updated_count += 1
        else:
            new_vocab = Vocabulary(
                english_phrase=english,
                japanese_meaning=japanese,
                proficiency_score=0
            )
            db.add(new_vocab)
            added_count += 1
            
    db.commit()
    print(f"Import Complete: {added_count} added, {updated_count} updated.")

if __name__ == "__main__":
    # usage: python sync_data.py [export|import] [filename]
    
    init_db()
    
    action = "export"
    if len(sys.argv) > 1:
        action = sys.argv[1]
        
    file_path = "data/vocab.csv" # Default to CSV now
    if len(sys.argv) > 2:
        file_path = sys.argv[2]
        
    if action == "export":
        export_db_to_file(file_path)
    elif action == "import":
        import_file_to_db(file_path)
    else:
        print("Usage: python sync_data.py [export|import] [path]")
