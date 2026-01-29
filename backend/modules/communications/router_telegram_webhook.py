"""
Telegram webhook endpoint з діагностикою та автоматичним встановленням.
"""
from fastapi import APIRouter, Request, Depends, HTTPException
from sqlalchemy.orm import Session
import logging
import httpx
import os
from modules.communications.webhooks.telegram import handle_telegram_webhook
from core.database import get_db

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/telegram/webhook")
async def telegram_webhook_handler(
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Обробка вхідних повідомлень від Telegram через webhook.
    З діагностикою та автоматичним встановленням webhook.
    """
    try:
        # Логування вхідного запиту
        logger.info(f"📥 Telegram webhook received: {request.method} {request.url}")
        logger.info(f"📥 Headers: {dict(request.headers)}")
        
        # Отримати дані
        try:
            data = await request.json()
            logger.info(f"📥 Telegram webhook data: {data}")
        except Exception as e:
            logger.error(f"❌ Failed to parse Telegram webhook JSON: {e}")
            body = await request.body()
            logger.error(f"❌ Raw body: {body[:500]}")
            raise HTTPException(status_code=400, detail="Invalid JSON")
        
        # Обробити webhook
        result = await handle_telegram_webhook(db, data)
        
        logger.info(f"✅ Telegram webhook processed: {result}")
        return result
        
    except Exception as e:
        logger.error(f"❌ Telegram webhook error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/telegram/webhook/setup")
async def telegram_webhook_setup(
    db: Session = Depends(get_db),
):
    """
    Автоматичне встановлення Telegram webhook.
    Викликається вручну або автоматично при старті.
    """
    try:
        from modules.communications.services.telegram import TelegramService
        from crud import get_telegram_api_settings
        
        # Отримати токен бота
        settings = get_telegram_api_settings(db)
        bot_token = settings.get("telegram_bot_token") or os.getenv("TELEGRAM_BOT_TOKEN")
        
        if not bot_token:
            return {
                "status": "error",
                "message": "Telegram bot token not configured"
            }
        
        # URL для webhook
        domain = os.getenv("DOMAIN", "https://tlumaczeniamt.com.pl")
        webhook_url = f"{domain}/api/v1/communications/telegram/webhook"
        
        # Встановити webhook
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"https://api.telegram.org/bot{bot_token}/setWebhook",
                json={"url": webhook_url},
                timeout=10.0
            )
            result = response.json()
            
            logger.info(f"🔧 Telegram webhook setup result: {result}")
            
            return {
                "status": "success" if result.get("ok") else "error",
                "message": result.get("description", ""),
                "webhook_url": webhook_url,
                "telegram_response": result
            }
            
    except Exception as e:
        logger.error(f"❌ Failed to setup Telegram webhook: {e}", exc_info=True)
        return {
            "status": "error",
            "message": str(e)
        }


@router.get("/telegram/webhook/info")
async def telegram_webhook_info(
    db: Session = Depends(get_db),
):
    """
    Отримати інформацію про поточний стан Telegram webhook.
    """
    try:
        from crud import get_telegram_api_settings
        import os
        
        # Отримати токен бота
        settings = get_telegram_api_settings(db)
        bot_token = settings.get("telegram_bot_token") or os.getenv("TELEGRAM_BOT_TOKEN")
        
        if not bot_token:
            return {
                "status": "error",
                "message": "Telegram bot token not configured"
            }
        
        # Отримати інформацію про webhook
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"https://api.telegram.org/bot{bot_token}/getWebhookInfo",
                timeout=10.0
            )
            result = response.json()
            
            return {
                "status": "success" if result.get("ok") else "error",
                "webhook_info": result.get("result", {}),
            }
            
    except Exception as e:
        logger.error(f"❌ Failed to get Telegram webhook info: {e}", exc_info=True)
        return {
            "status": "error",
            "message": str(e)
        }

