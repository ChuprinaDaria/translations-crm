"""
Messaging background tasks - асинхронна відправка повідомлень через платформи.
"""
import logging
from typing import Optional, List, Dict, Any
from uuid import UUID
from sqlalchemy.orm import Session

from tasks.celery_app import celery_app
from core.database import SessionLocal
from modules.communications.models import Conversation, Message, PlatformEnum, MessageStatus

logger = logging.getLogger(__name__)


@celery_app.task(name="send_message_task", max_retries=3, bind=True)
def send_message_task(
    self,
    conversation_id: str,
    platform: str,
    content: str,
    attachments: Optional[List[Dict[str, Any]]] = None,
    metadata: Optional[Dict[str, Any]] = None,
    message_id: Optional[str] = None,
):
    """
    Асинхронна відправка повідомлення через відповідну платформу.
    
    Args:
        self: Celery task instance (for retry)
        conversation_id: ID розмови
        platform: Платформа (telegram, whatsapp, instagram, facebook, email)
        content: Текст повідомлення
        attachments: Список вкладень (опціонально)
        metadata: Метадані повідомлення (опціонально)
        message_id: ID повідомлення в БД (якщо вже створено)
    
    Returns:
        dict: Результат відправки
    """
    db: Session = SessionLocal()
    try:
        # Отримати розмову
        conversation = db.query(Conversation).filter(
            Conversation.id == UUID(conversation_id)
        ).first()
        
        if not conversation:
            raise ValueError(f"Conversation {conversation_id} not found")
        
        # Отримати або створити повідомлення
        if message_id:
            message = db.query(Message).filter(Message.id == UUID(message_id)).first()
            if not message:
                raise ValueError(f"Message {message_id} not found")
        else:
            # Створити нове повідомлення зі статусом QUEUED
            from modules.communications.models import MessageDirection, MessageType
            message = Message(
                conversation_id=UUID(conversation_id),
                direction=MessageDirection.OUTBOUND,
                type=MessageType.TEXT,
                content=content,
                status=MessageStatus.QUEUED,
                attachments=attachments,
                meta_data=metadata,
            )
            db.add(message)
            db.commit()
            db.refresh(message)
        
        # Відправка через відповідний сервіс
        platform_enum = PlatformEnum(platform.lower())
        
        if platform_enum == PlatformEnum.TELEGRAM:
            from modules.communications.services.telegram import TelegramService
            service = TelegramService(db)
            # Використовуємо синхронну обгортку для async методу
            import asyncio
            try:
                loop = asyncio.get_event_loop()
            except RuntimeError:
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
            
            message = loop.run_until_complete(
                service.send_message(
                    conversation_id=UUID(conversation_id),
                    content=content,
                    attachments=attachments,
                    metadata=metadata,
                )
            )
            
        elif platform_enum == PlatformEnum.WHATSAPP:
            import os
            whatsapp_mode = os.getenv("WHATSAPP_MODE", "meta")

            if whatsapp_mode == "matrix":
                from modules.integrations.matrix.service import MatrixWhatsAppService
                service = MatrixWhatsAppService(db)
            else:
                from modules.communications.services.whatsapp import WhatsAppService
                service = WhatsAppService(db)

            import asyncio
            try:
                loop = asyncio.get_event_loop()
            except RuntimeError:
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)

            message = loop.run_until_complete(
                service.send_message(
                    conversation_id=UUID(conversation_id),
                    content=content,
                    attachments=attachments,
                    metadata=metadata,
                )
            )
            
        elif platform_enum == PlatformEnum.INSTAGRAM:
            from modules.communications.services.instagram import InstagramService
            service = InstagramService(db)
            import asyncio
            try:
                loop = asyncio.get_event_loop()
            except RuntimeError:
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
            
            message = loop.run_until_complete(
                service.send_message(
                    conversation_id=UUID(conversation_id),
                    content=content,
                    attachments=attachments,
                    metadata=metadata,
                )
            )
            
        elif platform_enum == PlatformEnum.FACEBOOK:
            from modules.communications.services.facebook import FacebookService
            service = FacebookService(db)
            import asyncio
            try:
                loop = asyncio.get_event_loop()
            except RuntimeError:
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
            
            message = loop.run_until_complete(
                service.send_message(
                    conversation_id=UUID(conversation_id),
                    content=content,
                    attachments=attachments,
                    metadata=metadata,
                )
            )
            
        elif platform_enum == PlatformEnum.EMAIL:
            from modules.communications.services.email import EmailService
            service = EmailService(db)
            import asyncio
            try:
                loop = asyncio.get_event_loop()
            except RuntimeError:
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
            
            message = loop.run_until_complete(
                service.send_message(
                    conversation_id=UUID(conversation_id),
                    content=content,
                    attachments=attachments,
                    metadata=metadata,
                )
            )
        else:
            raise ValueError(f"Unsupported platform: {platform}")
        
        # Оновити статус повідомлення
        if message:
            message.status = MessageStatus.SENT
            db.commit()
            db.refresh(message)
        
        logger.info(f"✅ Message sent successfully via {platform} to conversation {conversation_id}")
        
        return {
            "status": "success",
            "message_id": str(message.id),
            "conversation_id": conversation_id,
            "platform": platform
        }
        
    except Exception as e:
        logger.error(f"❌ Failed to send message via {platform}: {e}", exc_info=True)
        
        # Оновити статус повідомлення на FAILED
        if message_id:
            try:
                message = db.query(Message).filter(Message.id == UUID(message_id)).first()
                if message:
                    message.status = MessageStatus.FAILED
                    db.commit()
            except Exception as commit_error:
                logger.error(f"Failed to update message status: {commit_error}")
        
        # Retry з експоненційною затримкою
        raise self.retry(exc=e, countdown=2 ** self.request.retries)
        
    finally:
        db.close()

