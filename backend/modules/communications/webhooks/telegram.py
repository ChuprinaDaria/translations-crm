"""
Telegram webhook handler.
"""
from typing import Dict, Any
from sqlalchemy.orm import Session

from modules.communications.services.telegram import TelegramService
from modules.communications.models import PlatformEnum


async def handle_telegram_webhook(
    db: Session,
    webhook_data: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Обробити webhook від Telegram.
    
    Args:
        db: Database session
        webhook_data: Дані з webhook
        
    Returns:
        Результат обробки
    """
    service = TelegramService(db)
    
    # Telegram webhook структура залежить від того, як налаштований бот
    # Приклад структури:
    # {
    #     "message": {
    #         "message_id": 123,
    #         "from": {"id": 123456, "first_name": "John", "username": "john"},
    #         "chat": {"id": 123456, "type": "private"},
    #         "date": 1234567890,
    #         "text": "Hello"
    #     }
    # }
    
    message_data = webhook_data.get("message", {})
    if not message_data:
        return {"status": "ignored", "reason": "No message data"}
    
    # Отримати інформацію про відправника
    from_data = message_data.get("from", {})
    chat_data = message_data.get("chat", {})
    
    external_id = str(chat_data.get("id", ""))
    content = message_data.get("text", "")
    
    sender_info = {
        "telegram_id": str(from_data.get("id", "")),
        "name": from_data.get("first_name", "") + " " + from_data.get("last_name", "").strip(),
        "username": from_data.get("username"),
    }
    
    # Обробити вхідне повідомлення
    message = await service.receive_message(
        external_id=external_id,
        content=content,
        sender_info=sender_info,
        metadata={
            "message_id": message_data.get("message_id"),
            "date": message_data.get("date"),
        },
    )
    
    return {
        "status": "processed",
        "message_id": str(message.id),
        "conversation_id": str(message.conversation_id),
    }

