from fastapi import APIRouter, HTTPException
from src.services.llm_service import generate_vocabulary_list, filter_vocabulary_by_theme

router = APIRouter()

@router.post("/generate-vocab")
async def generate_vocab_from_theme(theme: str, count: int = 10):
    """Generate vocabulary list from theme using LLM"""
    try:
        items = generate_vocabulary_list(theme, count)
        return {
            "theme": theme,
            "count": len(items),
            "items": items
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/filter-by-theme")
async def filter_vocab_by_theme(vocab_list: list, theme: str):
    """Filter vocabulary by theme using LLM"""
    try:
        # Add IDs to vocab items if not present
        vocab_with_ids = []
        for idx, item in enumerate(vocab_list):
            item_with_id = {**item, "id": idx}
            vocab_with_ids.append(item_with_id)

        matched_ids = filter_vocabulary_by_theme(vocab_with_ids, theme)
        matched_items = [vocab_list[i] for i in matched_ids if i < len(vocab_list)]

        return {
            "theme": theme,
            "matched_count": len(matched_items),
            "items": matched_items
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
