from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime
from src.database.core import Base

class Vocabulary(Base):
    __tablename__ = "vocabulary"

    id = Column(Integer, primary_key=True, index=True)
    english_phrase = Column(String, nullable=False)
    japanese_meaning = Column(String, nullable=False)
    target_word = Column(String, nullable=True)
    last_reviewed_at = Column(DateTime, default=datetime.utcnow)
    proficiency_score = Column(Integer, default=0)

    def __repr__(self):
        return f"<Vocabulary(english_phrase='{self.english_phrase}', target_word='{self.target_word}')>"
