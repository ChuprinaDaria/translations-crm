"""
AI Integration Service - Business logic for RAG integration
"""
import httpx
import logging
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session
from .models import AISettings
from .schemas import RAGMessageRequest, RAGMessageResponse

logger = logging.getLogger(__name__)


class AIService:
    """Сервіс для роботи з AI налаштуваннями та RAG API"""
    
    def __init__(self, db: Session):
        self.db = db
    
    def get_settings(self) -> Optional[AISettings]:
        """Отримати налаштування AI (завжди одна запис)"""
        return self.db.query(AISettings).first()
    
    def get_or_create_settings(self) -> AISettings:
        """Отримати або створити налаштування AI"""
        settings = self.get_settings()
        if not settings:
            settings = AISettings()
            self.db.add(settings)
            self.db.commit()
            self.db.refresh(settings)
        return settings
    
    def update_settings(self, settings_data: Dict[str, Any]) -> AISettings:
        """Оновити налаштування AI"""
        settings = self.get_or_create_settings()
        
        for key, value in settings_data.items():
            if value is not None and hasattr(settings, key):
                setattr(settings, key, value)
        
        self.db.commit()
        self.db.refresh(settings)
        return settings
    
    async def send_to_rag(
        self, 
        message: str, 
        conversation_id: str, 
        platform: str,
        context: Optional[Dict[str, Any]] = None
    ) -> Optional[RAGMessageResponse]:
        """
        Відправити повідомлення до RAG API та отримати відповідь
        
        Args:
            message: Текст повідомлення від клієнта
            conversation_id: ID діалогу
            platform: Платформа (telegram, whatsapp, email, etc.)
            context: Додатковий контекст
        
        Returns:
            RAGMessageResponse або None якщо помилка
        """
        settings = self.get_settings()
        
        if not settings or not settings.is_enabled:
            logger.debug("AI integration is disabled")
            return None
        
        if platform not in settings.active_channels:
            logger.debug(f"Platform {platform} is not in active channels")
            return None
        
        if not settings.rag_api_key:
            logger.warning("RAG API key is not configured")
            return None
        
        try:
            # Формуємо запит до RAG API
            url = f"{settings.rag_api_url}/chat"
            headers = {
                "Authorization": f"Bearer {settings.rag_api_key}",
                "Content-Type": "application/json"
            }
            
            payload = {
                "message": message,
                "conversation_id": conversation_id,
                "platform": platform,
                "context": context or {}
            }
            
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(url, json=payload, headers=headers)
                response.raise_for_status()
                
                data = response.json()
                
                return RAGMessageResponse(
                    reply=data.get("reply", ""),
                    confidence=data.get("confidence"),
                    metadata=data.get("metadata")
                )
        
        except httpx.HTTPError as e:
            logger.error(f"HTTP error when calling RAG API: {e}")
            return None
        except Exception as e:
            logger.error(f"Error calling RAG API: {e}", exc_info=True)
            return None
    
    def is_channel_active(self, platform: str) -> bool:
        """Перевірити, чи активний канал для AI"""
        settings = self.get_settings()
        if not settings or not settings.is_enabled:
            return False
        return platform in settings.active_channels
    
    def get_trigger_delay(self) -> int:
        """Отримати затримку перед відправкою до AI"""
        settings = self.get_settings()
        if not settings:
            return 10
        return settings.trigger_delay_seconds

