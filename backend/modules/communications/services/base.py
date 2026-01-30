"""
Base MessengerService - абстракція для всіх сервісів повідомлень.
"""
from abc import ABC, abstractmethod
from typing import Optional, List, Dict, Any
from uuid import UUID
from datetime import datetime, timezone
from sqlalchemy.orm import Session

from modules.communications.models import (
    Conversation,
    Message as MessageModel,
    PlatformEnum,
    MessageDirection,
    MessageType,
    MessageStatus,
)


class MessengerService(ABC):
    """
    Базовий клас для всіх сервісів повідомлень.
    Всі конкретні сервіси (Telegram, WhatsApp, Email, Facebook) повинні наслідувати цей клас.
    """
    
    def __init__(self, db: Session, config: Dict[str, Any]):
        """
        Ініціалізація сервісу.
        
        Args:
            db: Database session
            config: Конфігурація сервісу (токени, API keys тощо)
        """
        self.db = db
        self.config = config
        self.platform = self.get_platform()
    
    @abstractmethod
    def get_platform(self) -> PlatformEnum:
        """Повертає платформу, яку обслуговує цей сервіс."""
        pass
    
    @abstractmethod
    async def send_message(
        self,
        conversation_id: UUID,
        content: str,
        attachments: Optional[List[Dict[str, Any]]] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> MessageModel:
        """
        Відправити повідомлення.
        
        Args:
            conversation_id: ID розмови
            content: Текст повідомлення
            attachments: Список вкладень
            metadata: Додаткові метадані
            
        Returns:
            Створене повідомлення
        """
        pass
    
    @abstractmethod
    async def receive_message(
        self,
        external_id: str,
        content: str,
        sender_info: Dict[str, Any],
        attachments: Optional[List[Dict[str, Any]]] = None,
        metadata: Optional[Dict[str, Any]] = None,
        is_from_me: Optional[bool] = None,
    ) -> MessageModel:
        """
        Обробити вхідне повідомлення.
        
        Args:
            external_id: Зовнішній ID повідомлення (від платформи)
            content: Текст повідомлення
            sender_info: Інформація про відправника (name, phone, email тощо)
            attachments: Список вкладень
            metadata: Додаткові метадані
            
        Returns:
            Створене повідомлення
        """
        pass
    
    @abstractmethod
    async def get_or_create_conversation(
        self,
        external_id: str,
        client_id: Optional[UUID] = None,
        subject: Optional[str] = None,
    ) -> Conversation:
        """
        Отримати або створити розмову.
        
        Args:
            external_id: Зовнішній ID розмови (від платформи)
            client_id: ID клієнта (опціонально)
            subject: Тема розмови (для email)
            
        Returns:
            Conversation об'єкт
        """
        pass
    
    def create_message_in_db(
        self,
        conversation_id: UUID,
        direction: MessageDirection,
        message_type: MessageType,
        content: str,
        status: MessageStatus = MessageStatus.SENT,
        attachments: Optional[List[Dict[str, Any]]] = None,
        metadata: Optional[Dict[str, Any]] = None,
        sent_at: Optional[datetime] = None,
        is_from_me: Optional[bool] = None,
    ) -> MessageModel:
        """
        Створити повідомлення в базі даних.
        
        Args:
            conversation_id: ID розмови
            direction: Напрямок (inbound/outbound)
            message_type: Тип повідомлення (text/html/file)
            content: Текст повідомлення
            status: Статус повідомлення
            attachments: Список вкладень
            metadata: Додаткові метадані (має бути dict, не JSON-рядок)
            sent_at: Час відправки
            
        Returns:
            Створене повідомлення
        """
        import json
        import logging
        logger = logging.getLogger(__name__)
        
        # Переконатися, що metadata - це dict, а не JSON-рядок
        if metadata is not None:
            if isinstance(metadata, str):
                # Якщо передано JSON-рядок, розпарсити його
                try:
                    metadata = json.loads(metadata)
                    logger.warning(f"[Message DB] Metadata was a string, parsed to dict")
                except json.JSONDecodeError as e:
                    logger.error(f"[Message DB] Failed to parse metadata string: {e}")
                    metadata = {}
            elif not isinstance(metadata, dict):
                # Якщо це не dict і не рядок, конвертувати в dict
                logger.warning(f"[Message DB] Metadata is not a dict, converting: {type(metadata)}")
                metadata = {}
        
        message = MessageModel(
            conversation_id=conversation_id,
            direction=direction,
            type=message_type,
            content=content,
            status=status,
            attachments=attachments,
            meta_data=metadata,
            sent_at=sent_at or datetime.now(timezone.utc),
            is_from_me=is_from_me,
        )
        self.db.add(message)
        
        # Оновити conversation: розархівувати та оновити last_message_at
        conversation = self.db.query(Conversation).filter(Conversation.id == conversation_id).first()
        if conversation:
            # Автоматичне розархівування при новому повідомленні
            if conversation.is_archived:
                conversation.is_archived = False
                logger.info(f"Auto-unarchived conversation {conversation_id} due to new message")
            
            # Оновити last_message_at
            message_time = sent_at or datetime.now(timezone.utc)
            conversation.last_message_at = message_time
            conversation.updated_at = message_time
        
        self.db.commit()
        self.db.refresh(message)
        return message
    
    def extract_client_info(self, sender_info: Dict[str, Any]) -> Dict[str, Any]:
        """
        Витягнути інформацію про клієнта з даних відправника.
        
        Args:
            sender_info: Інформація про відправника
            
        Returns:
            Словник з полями: name, phone, email
        """
        return {
            "name": sender_info.get("name") or sender_info.get("full_name") or "Unknown",
            "phone": sender_info.get("phone") or sender_info.get("phone_number"),
            "email": sender_info.get("email"),
        }
    
    def validate_config(self) -> bool:
        """
        Перевірити чи конфігурація валідна.
        
        Returns:
            True якщо конфігурація валідна
        """
        return True

