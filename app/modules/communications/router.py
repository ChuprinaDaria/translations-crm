"""
Communications routes - unified inbox endpoints з підтримкою провайдерів.
"""
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from typing import Dict

from core.database import get_db
from modules.auth.dependencies import get_current_user_db
from modules.communications.providers.factory import ProviderFactory
from modules.communications.providers.base import Message
from tasks.webhook_tasks import process_meta_webhook_task
import models

router = APIRouter(prefix="/communications", tags=["communications"])


@router.get("/inbox")
def get_inbox(
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user_db),
):
    """Get unified inbox (Telegram, Meta, Email messages)."""
    # TODO: Implement unified inbox
    return {"messages": [], "channels": ["telegram", "email", "meta"]}


@router.post("/send/meta")
async def send_meta_message(
    recipient_id: str,
    message: str,
    provider_type: str = "meta",
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user_db),
):
    """
    Відправити повідомлення через Meta API.
    
    Args:
        recipient_id: ID отримувача в Meta
        message: Текст повідомлення
        provider_type: Тип провайдера ("meta" або "twilio")
    """
    # TODO: Отримати конфігурацію провайдера з БД або env
    config = {
        "access_token": "YOUR_META_ACCESS_TOKEN",
        "app_secret": "YOUR_APP_SECRET",
        "verify_token": "YOUR_VERIFY_TOKEN",
        "phone_number_id": "YOUR_PHONE_NUMBER_ID",  # Для WhatsApp
    }
    
    provider = ProviderFactory.create_provider(provider_type, config)
    
    if not provider:
        raise HTTPException(status_code=400, detail=f"Invalid provider type: {provider_type}")
    
    message_obj = Message(
        recipient_id=recipient_id,
        text=message
    )
    
    result = await provider.send_message(message_obj)
    
    if not result.success:
        raise HTTPException(status_code=500, detail=result.error)
    
    return {"status": "success", "message_id": result.message_id}


@router.get("/webhook/meta/verify")
def verify_meta_webhook(
    mode: str,
    token: str,
    challenge: str,
    db: Session = Depends(get_db),
):
    """
    Верифікація webhook від Meta (GET запит).
    
    Meta надсилає GET запит для верифікації webhook.
    """
    # TODO: Отримати verify_token з конфігурації
    verify_token = "YOUR_VERIFY_TOKEN"
    
    if mode == "subscribe" and token == verify_token:
        return int(challenge)
    else:
        raise HTTPException(status_code=403, detail="Verification failed")


@router.post("/webhook/meta")
async def receive_meta_webhook(
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Обробка webhook від Meta (POST запит).
    
    Meta надсилає POST запит з повідомленнями.
    """
    # Отримуємо підпис з заголовків
    signature = request.headers.get("X-Hub-Signature-256", "")
    payload = await request.body()
    
    # TODO: Отримати конфігурацію провайдера
    config = {
        "app_secret": "YOUR_APP_SECRET",
    }
    
    provider = ProviderFactory.create_provider("meta", config)
    
    if not provider:
        raise HTTPException(status_code=500, detail="Provider not configured")
    
    # Перевіряємо підпис
    is_valid = await provider.verify_webhook(signature, payload)
    
    if not is_valid:
        raise HTTPException(status_code=403, detail="Invalid webhook signature")
    
    # Обробляємо webhook асинхронно
    webhook_data = await request.json()
    await process_meta_webhook_task({}, webhook_data)
    
    return {"status": "ok"}
