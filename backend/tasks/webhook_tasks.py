"""
Webhook background tasks - асинхронна обробка webhooks від різних платформ.
"""
import logging
from typing import Dict, Any
from sqlalchemy.orm import Session

from tasks.celery_app import celery_app
from core.database import SessionLocal

logger = logging.getLogger(__name__)


@celery_app.task(name="process_webhook_task")
def process_webhook_task(platform: str, webhook_data: Dict[str, Any]):
    """
    Асинхронна обробка webhook від різних платформ.
    
    Args:
        platform: Платформа (telegram, whatsapp, instagram, facebook)
        webhook_data: Дані з webhook
    
    Returns:
        dict: Результат обробки
    """
    db: Session = SessionLocal()
    try:
        platform_lower = platform.lower()
        
        if platform_lower == "telegram":
            from modules.communications.webhooks.telegram import handle_telegram_webhook
            import asyncio
            try:
                loop = asyncio.get_event_loop()
            except RuntimeError:
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
            
            result = loop.run_until_complete(
                handle_telegram_webhook(db, webhook_data)
            )
            
        elif platform_lower == "whatsapp":
            from modules.communications.webhooks.whatsapp import handle_whatsapp_webhook
            import asyncio
            try:
                loop = asyncio.get_event_loop()
            except RuntimeError:
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
            
            result = loop.run_until_complete(
                handle_whatsapp_webhook(db, webhook_data)
            )
            
        elif platform_lower == "instagram":
            from modules.communications.webhooks.instagram import handle_instagram_webhook
            import asyncio
            try:
                loop = asyncio.get_event_loop()
            except RuntimeError:
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
            
            result = loop.run_until_complete(
                handle_instagram_webhook(db, webhook_data)
            )
            
        elif platform_lower == "facebook":
            from modules.communications.webhooks.facebook import handle_facebook_webhook
            import asyncio
            try:
                loop = asyncio.get_event_loop()
            except RuntimeError:
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
            
            result = loop.run_until_complete(
                handle_facebook_webhook(db, webhook_data)
            )
            
        else:
            logger.warning(f"Unsupported webhook platform: {platform}")
            return {
                "status": "error",
                "error": f"Unsupported platform: {platform}"
            }
        
        logger.info(f"✅ Webhook processed successfully for {platform}")
        return {
            "status": "success",
            "platform": platform,
            "result": result
        }
        
    except Exception as e:
        logger.error(f"❌ Failed to process webhook for {platform}: {e}", exc_info=True)
        return {
            "status": "error",
            "platform": platform,
            "error": str(e)
        }
        
    finally:
        db.close()


@celery_app.task(name="process_meta_webhook_task")
def process_meta_webhook_task(webhook_data: Dict[str, Any]):
    """
    Фонова задача для обробки webhook від Meta API (WhatsApp, Instagram, Facebook).
    
    Args:
        webhook_data: Дані з webhook
    
    Returns:
        dict: Результат обробки
    """
    # Meta webhook може містити дані для різних платформ
    # Визначаємо платформу з даних
    object_type = webhook_data.get("object", "")
    
    if object_type == "whatsapp_business_account":
        return process_webhook_task("whatsapp", webhook_data)
    elif object_type == "instagram":
        return process_webhook_task("instagram", webhook_data)
    elif object_type == "page":
        return process_webhook_task("facebook", webhook_data)
    else:
        logger.warning(f"Unknown Meta webhook object type: {object_type}")
        return {
            "status": "error",
            "error": f"Unknown object type: {object_type}"
        }
