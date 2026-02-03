"""
AI Integration Router - API endpoints for AI settings and RAG integration
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Optional

from core.database import get_db
from modules.auth.dependencies import get_current_user_db
from modules.auth import models as auth_models
from .service import AIService
from .schemas import (
    AISettingsResponse,
    AISettingsCreate,
    AISettingsUpdate,
    RAGMessageRequest,
    RAGMessageResponse
)

router = APIRouter(prefix="/ai", tags=["ai-integration"])


@router.get("/settings", response_model=AISettingsResponse)
def get_ai_settings(
    db: Session = Depends(get_db),
    user: auth_models.User = Depends(get_current_user_db)
):
    """Отримати налаштування AI"""
    service = AIService(db)
    settings = service.get_or_create_settings()
    return settings


@router.post("/settings", response_model=AISettingsResponse)
def create_ai_settings(
    settings: AISettingsCreate,
    db: Session = Depends(get_db),
    user: auth_models.User = Depends(get_current_user_db)
):
    """Створити налаштування AI (якщо не існують)"""
    service = AIService(db)
    existing = service.get_settings()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Settings already exist. Use PATCH to update."
        )
    
    new_settings = service.update_settings(settings.model_dump(exclude_unset=True))
    return new_settings


@router.patch("/settings", response_model=AISettingsResponse)
def update_ai_settings(
    settings: AISettingsUpdate,
    db: Session = Depends(get_db),
    user: auth_models.User = Depends(get_current_user_db)
):
    """Оновити налаштування AI"""
    service = AIService(db)
    updated = service.update_settings(settings.model_dump(exclude_unset=True))
    return updated


@router.post("/rag/message", response_model=RAGMessageResponse)
async def send_message_to_rag(
    request: RAGMessageRequest,
    db: Session = Depends(get_db),
    user: auth_models.User = Depends(get_current_user_db)
):
    """Відправити повідомлення до RAG API та отримати відповідь"""
    service = AIService(db)
    
    response = await service.send_to_rag(
        message=request.message,
        conversation_id=request.conversation_id,
        platform=request.platform,
        context=request.context
    )
    
    if not response:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI service is unavailable or disabled"
        )
    
    return response


@router.get("/settings/webhook-secret")
def get_webhook_secret(
    db: Session = Depends(get_db),
    user: auth_models.User = Depends(get_current_user_db)
):
    """Отримати webhook secret для безпеки"""
    service = AIService(db)
    settings = service.get_or_create_settings()
    return {"webhook_secret": settings.webhook_secret}

