from fastapi import APIRouter, HTTPException
from src.schemas import QuizGenerateRequest, QuizEvaluateRequest
from src.services.llm_service import select_mask_word, evaluate_answer

router = APIRouter()

@router.post("/generate")
async def generate_quiz(request: QuizGenerateRequest):
    """Generate a masked quiz sentence"""
    try:
        # TODO: Fetch sentence from database by list_id
        # For now, returning a placeholder
        sentence = "I would like to order the salad instead."

        result = select_mask_word(sentence)
        return {
            "sentence": result["target"],
            "masked_sentence": result["masked_sentence"],
            "sentence_id": 1
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/evaluate")
async def evaluate_quiz_answer(request: QuizEvaluateRequest):
    """Evaluate user's quiz answer"""
    try:
        result = evaluate_answer(
            target=request.target,
            user_input=request.user_answer,
            context=request.context,
            threshold=0.60
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
