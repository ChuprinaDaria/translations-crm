"""
TelegramService - обробка Telegram повідомлень через Telethon.
"""
import asyncio
from typing import Optional, List, Dict, Any
from uuid import UUID
from datetime import datetime
from sqlalchemy.orm import Session
from telethon import TelegramClient
from telethon.sessions import StringSession
from telethon.tl.types import Message as TelegramMessage

from modules.communications.models import (
    PlatformEnum,
    MessageDirection,
    MessageType,
    MessageStatus,
)
from modules.communications.services.base import MessengerService
from modules.communications.models import Conversation
from core.database import SessionLocal
import sys
import os
# Add parent directory to path for crud import
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../..'))
import crud


class TelegramService(MessengerService):
    """Сервіс для роботи з Telegram."""
    
    def __init__(self, db: Session, config: Optional[Dict[str, Any]] = None):
        """
        Ініціалізація Telegram сервісу.
        
        Args:
            db: Database session
            config: Конфігурація (api_id, api_hash, session_string)
        """
        if config is None:
            config = self._load_config()
        super().__init__(db, config)
        self._client: Optional[TelegramClient] = None
    
    def get_platform(self) -> PlatformEnum:
        return PlatformEnum.TELEGRAM
    
    def _load_config(self) -> Dict[str, Any]:
        """Завантажити конфігурацію з бази даних або env."""
        db = SessionLocal()
        try:
            settings = crud.get_telegram_api_settings(db)
        finally:
            db.close()
        
        import os
        return {
            "api_id": int(settings.get("telegram_api_id") or os.getenv("TELEGRAM_API_ID", "0")),
            "api_hash": settings.get("telegram_api_hash") or os.getenv("TELEGRAM_API_HASH", ""),
            "session_string": settings.get("telegram_session_string") or os.getenv("TELEGRAM_SESSION_STRING", ""),
        }
    
    async def _get_client(self) -> TelegramClient:
        """Отримати або створити Telegram клієнт."""
        if self._client is None:
            session_string = self.config.get("session_string")
            if not session_string:
                raise ValueError("Telegram session_string not configured")
            
            self._client = TelegramClient(
                StringSession(session_string),
                self.config["api_id"],
                self.config["api_hash"],
            )
            await self._client.connect()
        
        return self._client
    
    async def send_message(
        self,
        conversation_id: UUID,
        content: str,
        attachments: Optional[List[Dict[str, Any]]] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> "MessageModel":
        """Відправити повідомлення в Telegram."""
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
            # Відправити через Telegram
            client = await self._get_client()
            entity = await client.get_entity(conversation.external_id)
            
            # Якщо є вкладення, відправити файли
            if attachments:
                files = []
                for att in attachments:
                    # Тут потрібно завантажити файл з URL або шляху
                    # files.append(att["path"])
                    pass
                await client.send_message(entity, content, file=files if files else None)
            else:
                await client.send_message(entity, content)
            
            # Оновити статус
            message.status = MessageStatus.SENT
            message.sent_at = datetime.utcnow()
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
        """Обробити вхідне повідомлення з Telegram."""
        from modules.communications.models import Message as MessageModel
        
        # Отримати або створити розмову
        conversation = await self.get_or_create_conversation(
            external_id=external_id,
            client_id=None,  # Буде знайдено або створено клієнта
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
            Conversation.platform == PlatformEnum.TELEGRAM,
            Conversation.external_id == external_id,
        ).first()
        
        if conversation:
            return conversation
        
        # Створюємо нову розмову
        conversation = Conversation(
            platform=PlatformEnum.TELEGRAM,
            external_id=external_id,
            client_id=client_id,
            subject=subject,
        )
        self.db.add(conversation)
        self.db.commit()
        self.db.refresh(conversation)
        
        return conversation
    
    async def close(self):
        """Закрити з'єднання з Telegram."""
        if self._client:
            await self._client.disconnect()
            self._client = None

