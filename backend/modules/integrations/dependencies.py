"""
Integrations dependencies - helpers for RAG token verification.
"""
from fastapi import Header, HTTPException, status, Depends
from sqlalchemy.orm import Session
from core.database import get_db
from modules.ai_integration.models import AISettings
import logging

logger = logging.getLogger(__name__)


def verify_rag_token(
    x_rag_token: str = Header(..., alias="X-RAG-TOKEN"),
    db: Session = Depends(get_db)
) -> str:
    """
    Verify RAG token from header.
    Читає токен з налаштувань AI в базі даних.
    Returns the token if valid, raises HTTPException if invalid.
    """
    # Отримуємо налаштування AI з бази даних
    ai_settings = db.query(AISettings).first()
    
    if not ai_settings:
        logger.error("AI settings not found in database")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="RAG token verification not configured. Please configure AI settings first."
        )
    
    expected_token = ai_settings.rag_token
    
    if not expected_token:
        logger.error("RAG_TOKEN not configured in AI settings")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="RAG token verification not configured. Please set RAG token in AI settings."
        )
    
    if x_rag_token != expected_token:
        logger.warning(f"🚨 УВАГА: Хтось стукає з неправильним токеном: {x_rag_token[:10]}...")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: Invalid RAG Token"
        )
    
    logger.info("✅ Успішна авторизація від AdMe RAG")
    return x_rag_token

