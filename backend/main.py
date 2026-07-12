import sys
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Add src to path
sys.path.insert(0, os.path.dirname(__file__))

from src.database.core import init_db
from src.api import quiz, vocab, listening, manage, llm

# Initialize database
init_db()

# Create FastAPI app
app = FastAPI(
    title="FillIn API",
    description="AI-powered English learning platform",
    version="0.1.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:8000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(quiz.router, prefix="/api/quiz", tags=["quiz"])
app.include_router(vocab.router, prefix="/api/vocab", tags=["vocab"])
app.include_router(listening.router, prefix="/api/listening", tags=["listening"])
app.include_router(manage.router, prefix="/api/manage", tags=["manage"])
app.include_router(llm.router, prefix="/api/llm", tags=["llm"])

# Health check
@app.get("/health")
def health_check():
    return {"status": "ok"}

@app.get("/")
def root():
    return {"message": "FillIn API is running"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
