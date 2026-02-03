"""
Autobot background tasks - асинхронна обробка повідомлень автоботом.
"""
import logging
from typing import Dict, Any
from uuid import UUID
from sqlalchemy.orm import Session

from tasks.celery_app import celery_app
from core.database import SessionLocal
from modules.communications.models import Message, Conversation, PlatformEnum

logger = logging.getLogger(__name__)


@celery_app.task(name="process_autobot_message_task")
def process_autobot_message_task(
    office_id: int,
    message_id: str,
    conversation_id: str,
    platform: str
):
    """
    Асинхронна обробка повідомлення автоботом.
    
    Args:
        office_id: ID офісу
        message_id: ID повідомлення
        conversation_id: ID розмови
        platform: Платформа (telegram, whatsapp, email, etc.)
    
    Returns:
        dict: Результат обробки
    """
    db: Session = SessionLocal()
    try:
        from modules.autobot.service import AutobotService
        
        # Отримати повідомлення
        message = db.query(Message).filter(Message.id == UUID(message_id)).first()
        
        if not message:
            logger.error(f"Message {message_id} not found")
            return {
                "status": "error",
                "error": "Message not found"
            }
        
        # Отримати інформацію про відправника
        from uuid import UUID
        conversation = db.query(Conversation).filter(
            Conversation.id == UUID(conversation_id)
        ).first()
        
        if not conversation:
            logger.error(f"Conversation {conversation_id} not found")
            return {
                "status": "error",
                "error": "Conversation not found"
            }
        
        # Формувати sender_info
        sender_info = {}
        if conversation.client:
            sender_info = {
                "email": getattr(conversation.client, "email", None),
                "phone": getattr(conversation.client, "phone", None),
                "name": getattr(conversation.client, "name", None),
            }
        else:
            # Спробувати отримати з external_id
            external_id = conversation.external_id
            if platform == PlatformEnum.EMAIL.value:
                sender_info["email"] = external_id
            elif platform in [PlatformEnum.TELEGRAM.value, PlatformEnum.WHATSAPP.value]:
                sender_info["phone"] = external_id
        
        # Викликати autobot service
        service = AutobotService(db)
        
        import asyncio
        try:
            loop = asyncio.get_event_loop()
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
        
        result = loop.run_until_complete(
            service.process_incoming_message(
                office_id=office_id,
                message=message,
                sender_info=sender_info
            )
        )
        
        logger.info(f"✅ Autobot processed message {message_id}: {result}")
        
        return {
            "status": "success",
            "message_id": message_id,
            "conversation_id": conversation_id,
            "result": result
        }
        
    except Exception as e:
        logger.error(f"❌ Failed to process autobot message {message_id}: {e}", exc_info=True)
        return {
            "status": "error",
            "message_id": message_id,
            "error": str(e)
        }
        
    finally:
        db.close()

