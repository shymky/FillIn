from pydantic import BaseModel
from typing import Optional

class QuizGenerateRequest(BaseModel):
    list_id: int
    difficulty: Optional[str] = "medium"

class QuizEvaluateRequest(BaseModel):
    user_answer: str
    target: str
    sentence_id: int
    context: Optional[str] = ""

class VocabItem(BaseModel):
    english_phrase: str
    japanese_meaning: str
    target_word: str

class VocabCreateRequest(BaseModel):
    english_phrase: str
    japanese_meaning: str
    target_word: str
    list_id: Optional[int] = None

class VocabGenerateRequest(BaseModel):
    theme: str
    count: Optional[int] = 10

class VocabAnalyzeRequest(BaseModel):
    theme: str
    count: Optional[int] = 10
