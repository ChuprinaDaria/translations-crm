"""
BaseWhatsAppProvider - базовий інтерфейс для WhatsApp провайдерів.
"""
from abc import ABC, abstractmethod
from typing import Optional, List, Dict, Any
from uuid import UUID
from sqlalchemy.orm import Session

from modules.communications.models import (
    Conversation,
    Message as MessageModel,
    PlatformEnum,
    MessageDirection,
    MessageType,
    MessageStatus,
)


class BaseWhatsAppProvider(ABC):
    """
    Базовий інтерфейс для WhatsApp провайдерів.
    
    Реалізується як:
    - WhatsAppService (Classical Meta API)
    - MatrixWhatsAppService (Matrix Bridge)
    """
    
    def __init__(self, db: Session, config: Dict[str, Any]):
        """
        Ініціалізація провайдера.
        
        Args:
            db: Database session
            config: Конфігурація провайдера
        """
        self.db = db
        self.config = config
    
    @abstractmethod
    def get_platform(self) -> PlatformEnum:
        """Повертає платформу (завжди PlatformEnum.WHATSAPP)."""
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
            external_id: Зовнішній ID повідомлення
            content: Текст повідомлення
            sender_info: Інформація про відправника
            attachments: Список вкладень
            metadata: Додаткові метадані
            is_from_me: Чи відправлено з нашого пристрою
            
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
            external_id: Зовнішній ID розмови
            client_id: ID клієнта (опціонально)
            subject: Тема розмови (опціонально)
            
        Returns:
            Conversation об'єкт
        """
        pass

