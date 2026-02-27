"""
MatrixWhatsAppService - сервіс для роботи з WhatsApp через Matrix Bridge.
"""
import logging
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
from modules.communications.services.base import MessengerService
from .base import BaseWhatsAppProvider
from .provider import MatrixProvider
from .mapper import MatrixMapper
from .schemas import MatrixConfig

logger = logging.getLogger(__name__)


class MatrixWhatsAppService(MessengerService, BaseWhatsAppProvider):
    """
    Сервіс для роботи з WhatsApp через Matrix Bridge (mautrix-whatsapp).
    
    Реалізує BaseWhatsAppProvider та MessengerService для сумісності
    з існуючою архітектурою.
    """
    
    def __init__(self, db: Session, config: Optional[Dict[str, Any]] = None):
        """
        Ініціалізація Matrix WhatsApp сервісу.
        
        Args:
            db: Database session
            config: Конфігурація (homeserver, access_token, user_id, device_id)
        """
        if config is None:
            config = self._load_config()
        
        super().__init__(db, config)
        self.matrix_provider: Optional[MatrixProvider] = None
        self._initialize_provider()
    
    def get_platform(self) -> PlatformEnum:
        """Повертає платформу WhatsApp."""
        return PlatformEnum.WHATSAPP
    
    def _load_config(self) -> Dict[str, Any]:
        """Завантажити конфігурацію з бази даних або env."""
        import os
        import crud
        from db import SessionLocal
        
        # Спробувати завантажити з бази даних
        db = SessionLocal()
        try:
            settings = crud.get_matrix_settings(db)
            if settings.get("matrix_homeserver") and settings.get("matrix_access_token"):
                return {
                    "homeserver": settings.get("matrix_homeserver", ""),
                    "access_token": settings.get("matrix_access_token", ""),
                    "user_id": settings.get("matrix_user_id"),
                    "device_id": settings.get("matrix_device_id"),
                }
        finally:
            db.close()
        
        # Fallback до env
        return {
            "homeserver": os.getenv("MATRIX_HOMESERVER", ""),
            "access_token": os.getenv("MATRIX_ACCESS_TOKEN", ""),
            "user_id": os.getenv("MATRIX_USER_ID"),
            "device_id": os.getenv("MATRIX_DEVICE_ID"),
        }
    
    def _initialize_provider(self) -> None:
        """Ініціалізувати Matrix провайдер."""
        try:
            matrix_config = MatrixConfig(
                homeserver=self.config.get("homeserver", ""),
                access_token=self.config.get("access_token", ""),
                user_id=self.config.get("user_id"),
                device_id=self.config.get("device_id"),
            )
            self.matrix_provider = MatrixProvider(matrix_config)
        except Exception as e:
            logger.error(f"Failed to initialize Matrix provider: {e}")
            self.matrix_provider = None
    
    async def ensure_connected(self, max_retries: int = 3) -> None:
        """Ensure connection to Matrix with exponential backoff retry."""
        if not self.matrix_provider:
            self._initialize_provider()
        if not self.matrix_provider:
            raise RuntimeError("Matrix provider not initialized — check MATRIX_HOMESERVER and MATRIX_ACCESS_TOKEN config")

        last_error = None
        for attempt in range(max_retries):
            try:
                await self.matrix_provider.connect()
                return
            except Exception as e:
                last_error = e
                wait_time = 2 ** attempt  # 1s, 2s, 4s
                logger.warning(f"Matrix connect attempt {attempt + 1}/{max_retries} failed: {e}. Retrying in {wait_time}s...")
                import asyncio
                await asyncio.sleep(wait_time)

        logger.error(f"Failed to connect to Matrix after {max_retries} attempts: {last_error}")
        raise last_error
    
    async def send_message(
        self,
        conversation_id: UUID,
        content: str,
        attachments: Optional[List[Dict[str, Any]]] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> MessageModel:
        """
        Відправити повідомлення через Matrix Bridge.
        
        Args:
            conversation_id: ID розмови
            content: Текст повідомлення
            attachments: Вкладення (опціонально)
            metadata: Метадані (опціонально)
        """
        # Отримати розмову
        conversation = self.db.query(Conversation).filter(
            Conversation.id == conversation_id
        ).first()
        
        if not conversation:
            raise ValueError(f"Conversation {conversation_id} not found")
        
        # Позначити, що повідомлення відправлено через CRM
        if metadata is None:
            metadata = {}
        metadata["sent_from_crm"] = True
        metadata["source"] = "matrix_bridge"
        
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
            await self.ensure_connected()
            
            if not self.matrix_provider:
                raise ValueError("Matrix provider not initialized")
            
            # Отримати Matrix room_id з conversation.external_id
            room_id = conversation.external_id
            
            # Відправити повідомлення
            if attachments and len(attachments) > 0:
                # Відправити медіа
                att = attachments[0]
                att_url = att.get("url", "")
                att_type = att.get("type", "document")
                att_filename = att.get("filename", "file")
                att_mime = att.get("mime_type", "application/octet-stream")
                
                # Завантажити файл
                from pathlib import Path
                from modules.communications.utils.media import get_media_dir
                
                MEDIA_DIR = get_media_dir()
                file_path = None
                file_data = None
                
                # Спробувати знайти файл
                if att_url:
                    url_clean = att_url.split("?")[0]
                    if "/media/" in url_clean:
                        file_path_str = url_clean.split("/media/")[-1]
                        file_path = MEDIA_DIR / file_path_str
                    elif "/files/" in url_clean:
                        from modules.communications.models import Attachment
                        file_id = url_clean.split("/files/")[-1]
                        try:
                            attachment_obj = self.db.query(Attachment).filter(
                                Attachment.id == UUID(file_id)
                            ).first()
                            if attachment_obj:
                                file_path = MEDIA_DIR / Path(attachment_obj.file_path).name
                        except:
                            pass
                
                if file_path and file_path.exists():
                    with open(file_path, "rb") as f:
                        file_data = f.read()
                    
                    # Завантажити на Matrix
                    mxc_url = await self.matrix_provider.upload_media(
                        file_data=file_data,
                        content_type=att_mime,
                        filename=att_filename,
                    )
                    
                    if mxc_url:
                        # Визначити msgtype
                        msgtype_map = {
                            "image": "m.image",
                            "video": "m.video",
                            "audio": "m.audio",
                            "voice": "m.audio",
                            "document": "m.file",
                        }
                        msgtype = msgtype_map.get(att_type, "m.file")
                        
                        # Відправити медіа-повідомлення
                        event_id = await self.matrix_provider.send_media_message(
                            room_id=room_id,
                            url=mxc_url,
                            msgtype=msgtype,
                            body=content or att_filename,
                            info={
                                "mimetype": att_mime,
                                "size": len(file_data),
                            },
                        )
                        
                        if event_id:
                            message.status = MessageStatus.SENT
                            message.sent_at = datetime.now(timezone.utc)
                            if metadata is None:
                                metadata = {}
                            metadata["matrix_event_id"] = event_id
                            message.meta_data = metadata
                            self.db.commit()
                            return message
            else:
                # Відправити текстове повідомлення
                event_id = await self.matrix_provider.send_text_message(
                    room_id=room_id,
                    text=content,
                )
                
                if event_id:
                    message.status = MessageStatus.SENT
                    message.sent_at = datetime.now(timezone.utc)
                    if metadata is None:
                        metadata = {}
                    metadata["matrix_event_id"] = event_id
                    message.meta_data = metadata
                    self.db.commit()
                    return message
            
            # Якщо не вдалося відправити
            raise ValueError("Failed to send message via Matrix")
            
        except Exception as e:
            message.status = MessageStatus.FAILED
            self.db.commit()
            logger.error(f"Failed to send Matrix message: {e}", exc_info=True)
            raise
        
        return message
    
    async def receive_message(
        self,
        external_id: str,
        content: str,
        sender_info: Dict[str, Any],
        attachments: Optional[List[Dict[str, Any]]] = None,
        metadata: Optional[Dict[str, Any]] = None,
        is_from_me: Optional[bool] = None,
    ) -> MessageModel:
        """Обробити вхідне повідомлення з Matrix."""
        # Отримати або створити розмову
        conversation = await self.get_or_create_conversation(
            external_id=external_id,
            client_id=None,
        )
        
        # Визначити тип повідомлення
        message_type = MessageType.TEXT
        if attachments and len(attachments) > 0:
            message_type = MessageType.FILE
        
        # Створити повідомлення
        message = self.create_message_in_db(
            conversation_id=conversation.id,
            direction=MessageDirection.INBOUND,
            message_type=message_type,
            content=content,
            status=MessageStatus.SENT,
            attachments=attachments,
            metadata=metadata,
            is_from_me=is_from_me,
        )
        
        # Notify via WebSocket
        try:
            from modules.communications.router import notify_new_message
            await notify_new_message(message, conversation)
        except Exception as e:
            logger.warning(f"Failed to send WebSocket notification: {e}")
        
        return message
    
    async def get_or_create_conversation(self, external_id: str, client_id=None, subject=None):
        """Get or create conversation with race-condition protection."""
        from sqlalchemy.exc import IntegrityError

        conversation = self.db.query(Conversation).filter(
            Conversation.platform == PlatformEnum.WHATSAPP,
            Conversation.external_id == external_id,
        ).first()

        if conversation:
            return conversation

        try:
            conversation = Conversation(
                platform=PlatformEnum.WHATSAPP,
                external_id=external_id,
                client_id=client_id,
                subject=subject,
            )
            self.db.add(conversation)
            self.db.flush()
            self.db.commit()
            return conversation
        except IntegrityError:
            self.db.rollback()
            conversation = self.db.query(Conversation).filter(
                Conversation.platform == PlatformEnum.WHATSAPP,
                Conversation.external_id == external_id,
            ).first()
            return conversation
    
    async def process_matrix_event(self, event: Dict[str, Any], room_info: Optional[Dict[str, Any]] = None) -> MessageModel:
        """
        Обробити Matrix event та створити повідомлення.
        
        Args:
            event: Matrix event dict
            room_info: Додаткова інформація про кімнату
            
        Returns:
            Створене повідомлення
        """
        # Конвертувати event в content, type, attachments
        content, message_type, attachments = MatrixMapper.event_to_message_content(event)
        
        # Витягнути інформацію про відправника
        sender_info = MatrixMapper.event_to_sender_info(event, room_info)
        
        # Визначити чи від нас
        my_user_id = self.config.get("user_id", "")
        is_from_me = MatrixMapper.is_event_from_me(event, my_user_id)
        
        # Створити метадані
        metadata = MatrixMapper.event_to_metadata(event, room_info)
        
        # Витягнути external_id (номер телефону) з room
        room_id = event.get("room_id", "")
        external_id = MatrixMapper.extract_phone_from_room(room_id, room_info)
        
        # Створити повідомлення
        return await self.receive_message(
            external_id=external_id,
            content=content,
            sender_info=sender_info,
            attachments=attachments,
            metadata=metadata,
            is_from_me=is_from_me,
        )

