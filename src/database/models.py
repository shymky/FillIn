from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, Table, ForeignKey
from sqlalchemy.orm import relationship
from src.database.core import Base

# Association Table for Many-to-Many
vocabulary_tags = Table(
    "vocabulary_tags",
    Base.metadata,
    Column("vocabulary_id", Integer, ForeignKey("vocabulary.id")),
    Column("tag_id", Integer, ForeignKey("tags.id"))
)

class Tag(Base):
    __tablename__ = "tags"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    
    # Relationship back to Vocabulary
    vocabularies = relationship("Vocabulary", secondary=vocabulary_tags, back_populates="tags")
    
    def __repr__(self):
        return f"<Tag(name='{self.name}')>"

class Vocabulary(Base):
    __tablename__ = "vocabulary"

    id = Column(Integer, primary_key=True, index=True)
    english_phrase = Column(String, nullable=False)
    japanese_meaning = Column(String, nullable=False)
    target_word = Column(String, nullable=True)
    last_reviewed_at = Column(DateTime, default=datetime.utcnow)
    proficiency_score = Column(Integer, default=0)
    status = Column(String, default="Unattempted") # Unattempted, Correct, Incorrect
    # Spaced repetition scheduling fields
    next_review_at = Column(DateTime, default=datetime.utcnow)
    review_step = Column(Integer, default=0)  # 0: 1 day, 1: 3 days, 2: 7 days, etc.
    
    # Relationship to Tags
    tags = relationship("Tag", secondary=vocabulary_tags, back_populates="vocabularies")

    def __repr__(self):
        return f"<Vocabulary(english_phrase='{self.english_phrase}', target_word='{self.target_word}')>"
