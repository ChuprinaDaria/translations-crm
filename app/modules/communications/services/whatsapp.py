"""
WhatsAppService - обробка WhatsApp повідомлень через Meta Business API.
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


class WhatsAppService(MessengerService):
    """Сервіс для роботи з WhatsApp через Meta Business API."""
    
    def __init__(self, db: Session, config: Optional[Dict[str, Any]] = None):
        """
        Ініціалізація WhatsApp сервісу.
        
        Args:
            db: Database session
            config: Конфігурація (access_token, phone_number_id, app_secret, verify_token)
        """
        if config is None:
            config = self._load_config()
        super().__init__(db, config)
        self.base_url = "https://graph.facebook.com/v18.0"
    
    def get_platform(self) -> PlatformEnum:
        return PlatformEnum.WHATSAPP
    
    def _load_config(self) -> Dict[str, Any]:
        """Завантажити конфігурацію з бази даних або env."""
        import os
        return {
            "access_token": os.getenv("WHATSAPP_ACCESS_TOKEN", ""),
            "phone_number_id": os.getenv("WHATSAPP_PHONE_NUMBER_ID", ""),
            "app_secret": os.getenv("WHATSAPP_APP_SECRET", ""),
            "verify_token": os.getenv("WHATSAPP_VERIFY_TOKEN", ""),
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
        """Відправити повідомлення в WhatsApp."""
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
            # Відправити через Meta API
            phone_number_id = self.config.get("phone_number_id")
            access_token = self.config.get("access_token")
            
            if not phone_number_id or not access_token:
                raise ValueError("WhatsApp credentials not configured")
            
            url = f"{self.base_url}/{phone_number_id}/messages"
            headers = {
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json",
            }
            
            payload = {
                "messaging_product": "whatsapp",
                "to": conversation.external_id,  # Номер телефону
                "type": "text",
                "text": {"body": content},
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
            metadata["whatsapp_message_id"] = result.get("messages", [{}])[0].get("id")
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
        """Обробити вхідне повідомлення з WhatsApp."""
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
            Conversation.platform == PlatformEnum.WHATSAPP,
            Conversation.external_id == external_id,
        ).first()
        
        if conversation:
            return conversation
        
        # Створюємо нову розмову
        conversation = Conversation(
            platform=PlatformEnum.WHATSAPP,
            external_id=external_id,
            client_id=client_id,
            subject=subject,
        )
        self.db.add(conversation)
        self.db.commit()
        self.db.refresh(conversation)
        
        return conversation

