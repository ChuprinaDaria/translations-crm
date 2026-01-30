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
    
    chat_id = chat_data.get("id", 0)
    chat_type = chat_data.get("type", "private")
    
    # Determine if this is a group/channel (chat_id < 0 or type is group/channel)
    is_group_or_channel = chat_id < 0 or chat_type in ["group", "supergroup", "channel"]
    
    # Determine external_id based on chat type
    if is_group_or_channel:
        # For groups/channels: use chat_id as external_id (one conversation per group)
        external_id = str(chat_id)
        conversation_subject = chat_data.get("title", f"Група {chat_id}")
    else:
        # For private chats: use user_id (or phone/username if available)
        user_id = from_data.get("id", "")
        username = from_data.get("username")
        if username:
            external_id = f"@{username}"
        else:
            external_id = str(user_id)
        conversation_subject = None
    
    content = message_data.get("text", "")
    
    sender_info = {
        "telegram_id": str(from_data.get("id", "")),
        "name": from_data.get("first_name", "") + " " + from_data.get("last_name", "").strip(),
        "username": from_data.get("username"),
    }
    
    # Prepare metadata
    metadata = {
        "message_id": message_data.get("message_id"),
        "date": message_data.get("date"),
        "telegram_chat_id": chat_id,
        "is_group_message": is_group_or_channel,
    }
    if from_data.get("id"):
        metadata["telegram_user_id"] = from_data.get("id")
    if from_data.get("username"):
        metadata["telegram_username"] = from_data.get("username")
    
    # Обробити вхідне повідомлення
    message = await service.receive_message(
        external_id=external_id,
        content=content,
        sender_info=sender_info,
        metadata=metadata,
        subject=conversation_subject,
    )
    
    return {
        "status": "processed",
        "message_id": str(message.id),
        "conversation_id": str(message.conversation_id),
    }

