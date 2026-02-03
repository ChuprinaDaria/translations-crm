"""
AI RAG background tasks - асинхронна обробка AI відповідей.
"""
import logging
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session

from tasks.celery_app import celery_app
from core.database import SessionLocal
from modules.communications.models import Conversation, PlatformEnum

logger = logging.getLogger(__name__)


@celery_app.task(name="process_ai_reply_task")
def process_ai_reply_task(
    conversation_id: str,
    message: str,
    platform: str,
    context: Optional[Dict[str, Any]] = None
):
    """
    Асинхронна обробка AI відповіді через RAG API.
    
    Args:
        conversation_id: ID розмови
        message: Текст повідомлення від клієнта
        platform: Платформа (telegram, whatsapp, email, etc.)
        context: Додатковий контекст (опціонально)
    
    Returns:
        dict: Результат обробки
    """
    db: Session = SessionLocal()
    try:
        from modules.ai_integration.service import AIService
        
        service = AIService(db)
        
        # Викликати RAG API
        import asyncio
        try:
            loop = asyncio.get_event_loop()
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
        
        response = loop.run_until_complete(
            service.send_to_rag(
                message=message,
                conversation_id=conversation_id,
                platform=platform,
                context=context
            )
        )
        
        if not response:
            logger.warning(f"AI service returned no response for conversation {conversation_id}")
            return {
                "status": "no_response",
                "conversation_id": conversation_id
            }
        
        # Відправити відповідь клієнту через відповідний сервіс
        # Використовуємо messaging task для відправки
        from tasks.messaging_tasks import send_message_task
        send_message_task.delay(
            conversation_id=conversation_id,
            platform=platform,
            content=response.reply,
            attachments=None,
            metadata={"ai_generated": True, "confidence": response.confidence}
        )
        
        logger.info(f"✅ AI reply sent successfully to conversation {conversation_id}")
        
        return {
            "status": "success",
            "conversation_id": conversation_id,
            "reply": response.reply,
            "confidence": response.confidence
        }
        
    except Exception as e:
        logger.error(f"❌ Failed to process AI reply for conversation {conversation_id}: {e}", exc_info=True)
        return {
            "status": "error",
            "conversation_id": conversation_id,
            "error": str(e)
        }
        
    finally:
        db.close()

