"""
InstagramService - обробка Instagram Direct Messages через Meta Instagram Graph API.
"""
import hmac
import hashlib
import httpx
from typing import Optional, List, Dict, Any
from uuid import UUID
from datetime import datetime
from sqlalchemy.orm import Session

from modules.communications.models import (
    PlatformEnum,
    MessageDirection,
    MessageType,
    MessageStatus,
    Conversation,
)
from modules.communications.services.base import MessengerService


class InstagramService(MessengerService):
    """Сервіс для роботи з Instagram Direct Messages через Meta Instagram Graph API."""
    
    def __init__(self, db: Session, config: Optional[Dict[str, Any]] = None):
        """
        Ініціалізація Instagram сервісу.
        
        Args:
            db: Database session
            config: Конфігурація (access_token, app_secret, verify_token, page_id)
        """
        if config is None:
            config = self._load_config()
        super().__init__(db, config)
        self.base_url = "https://graph.facebook.com/v18.0"
    
    def get_platform(self) -> PlatformEnum:
        return PlatformEnum.INSTAGRAM
    
    def _load_config(self) -> Dict[str, Any]:
        """Завантажити конфігурацію з бази даних або env."""
        import os
        import crud
        import logging
        logger = logging.getLogger(__name__)
        
        # Використовуємо передану сесію БД замість створення нової
        # Це дозволяє уникнути проблем з кешуванням та забезпечує актуальні дані
        try:
            settings = crud.get_instagram_settings(self.db)
            logger.info(f"[Instagram Config] Loaded from DB: app_id={bool(settings.get('instagram_app_id'))}, access_token={bool(settings.get('instagram_access_token'))}, app_secret={bool(settings.get('instagram_app_secret'))}, verify_token={bool(settings.get('instagram_verify_token'))}")
            
            # Перевіряємо чи є хоча б один ключ (не обов'язково app_secret)
            if any(settings.values()):
                config = {
                    "access_token": settings.get("instagram_access_token") or "",
                    "app_secret": settings.get("instagram_app_secret") or "",
                    "verify_token": settings.get("instagram_verify_token") or "",
                    "app_id": settings.get("instagram_app_id") or "",
                    "page_id": settings.get("instagram_page_id") or "",
                }
                logger.info(f"[Instagram Config] Using DB config, verify_token length: {len(config.get('verify_token', ''))}")
                return config
        except Exception as e:
            logger.warning(f"[Instagram Config] Error loading from DB: {e}")
        
        # Fallback до env
        logger.info("[Instagram Config] Using env fallback")
        return {
            "access_token": os.getenv("INSTAGRAM_ACCESS_TOKEN", ""),
            "app_secret": os.getenv("INSTAGRAM_APP_SECRET", ""),
            "verify_token": os.getenv("INSTAGRAM_VERIFY_TOKEN", ""),
            "app_id": os.getenv("INSTAGRAM_APP_ID", ""),
            "page_id": os.getenv("INSTAGRAM_PAGE_ID", ""),
        }
    
    def verify_webhook(self, signature: str, payload: bytes) -> bool:
        """
        Перевірити підпис webhook від Meta.
        
        Args:
            signature: Підпис з заголовка X-Hub-Signature-256
            payload: Тіло запиту
            
        Returns:
            True якщо підпис валідний
        """
        app_secret = self.config.get("app_secret")
        if not app_secret:
            return False
        
        # Meta використовує формат: sha256=<hash>
        expected_signature = hmac.new(
            app_secret.encode(),
            payload,
            hashlib.sha256
        ).hexdigest()
        
        # Видаляємо префікс "sha256=" зі вхідного підпису
        received_signature = signature.replace("sha256=", "")
        
        return hmac.compare_digest(expected_signature, received_signature)
    
    async def send_message(
        self,
        conversation_id: UUID,
        content: str,
        attachments: Optional[List[Dict[str, Any]]] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> "MessageModel":
        """Відправити повідомлення в Instagram Direct Messages."""
        from modules.communications.models import Message as MessageModel
        
        # Отримати розмову
        conversation = self.db.query(Conversation).filter(
            Conversation.id == conversation_id
        ).first()
        
        if not conversation:
            raise ValueError(f"Conversation {conversation_id} not found")
        
        # Створити повідомлення в БД
        message = self.create_message_in_db(
            conversation_id=conversation_id,
            direction=MessageDirection.OUTBOUND,
            message_type=MessageType.TEXT,
            content=content,
            status=MessageStatus.QUEUED,
            attachments=attachments,
            metadata=metadata,
        )
        
        try:
            # Відправити через Meta Instagram Graph API
            page_id = self.config.get("page_id")
            access_token = self.config.get("access_token")
            
            if not page_id or not access_token:
                raise ValueError("Instagram credentials not configured")
            
            # Instagram використовує той самий API що і Facebook Messenger
            url = f"{self.base_url}/{page_id}/messages"
            headers = {
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json",
            }
            
            payload = {
                "recipient": {"id": conversation.external_id},  # Instagram User ID
                "message": {"text": content},
            }
            
            async with httpx.AsyncClient() as client:
                response = await client.post(url, json=payload, headers=headers)
                response.raise_for_status()
                result = response.json()
            
            # Оновити статус
            message.status = MessageStatus.SENT
            message.sent_at = datetime.utcnow()
            if metadata is None:
                metadata = {}
            metadata["instagram_message_id"] = result.get("message_id")
            message.meta_data = metadata
            self.db.commit()
            
        except Exception as e:
            message.status = MessageStatus.FAILED
            self.db.commit()
            raise
        
        return message
    
    async def receive_message(
        self,
        external_id: str,
        content: str,
        sender_info: Dict[str, Any],
        attachments: Optional[List[Dict[str, Any]]] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> "MessageModel":
        """Обробити вхідне повідомлення з Instagram Direct Messages."""
        from modules.communications.models import Message as MessageModel
        
        # Отримати або створити розмову
        conversation = await self.get_or_create_conversation(
            external_id=external_id,
            client_id=None,
        )
        
        # Створити повідомлення
        message = self.create_message_in_db(
            conversation_id=conversation.id,
            direction=MessageDirection.INBOUND,
            message_type=MessageType.TEXT,
            content=content,
            status=MessageStatus.SENT,
            attachments=attachments,
            metadata=metadata,
        )
        
        # Notify via WebSocket
        try:
            from modules.communications.router import notify_new_message
            await notify_new_message(message, conversation)
        except Exception as e:
            # Don't fail if WebSocket notification fails
            import logging
            logging.getLogger(__name__).warning(f"Failed to send WebSocket notification: {e}")
        
        return message
    
    async def get_or_create_conversation(
        self,
        external_id: str,
        client_id: Optional[UUID] = None,
        subject: Optional[str] = None,
    ) -> Conversation:
        """Отримати або створити розмову."""
        # Шукаємо існуючу розмову
        conversation = self.db.query(Conversation).filter(
            Conversation.platform == PlatformEnum.INSTAGRAM,
            Conversation.external_id == external_id,
        ).first()
        
        if conversation:
            return conversation
        
        # Створюємо нову розмову
        conversation = Conversation(
            platform=PlatformEnum.INSTAGRAM,
            external_id=external_id,
            client_id=client_id,
            subject=subject,
        )
        self.db.add(conversation)
        self.db.commit()
        self.db.refresh(conversation)
        
        return conversation

