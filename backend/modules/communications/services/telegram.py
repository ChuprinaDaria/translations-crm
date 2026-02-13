"""
TelegramService - обробка Telegram повідомлень через Telethon.
"""
import asyncio
from typing import Optional, List, Dict, Any, TYPE_CHECKING
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
    Message,
)
from modules.communications.services.base import MessengerService
from modules.communications.models import Conversation

if TYPE_CHECKING:
    from modules.communications.models import Message as MessageModel
else:
    MessageModel = Message
from core.database import SessionLocal
import sys
import os
# Add parent directory to path for crud import
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../..'))
import crud
import models


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
            config = self._load_config(db)
        super().__init__(db, config)
        self._client: Optional[TelegramClient] = None
    
    def get_platform(self) -> PlatformEnum:
        return PlatformEnum.TELEGRAM
    
    def _load_config(self, db: Session) -> Dict[str, Any]:
        """Завантажити конфігурацію з активного Telegram акаунта."""
        from models import TelegramAccount
        
        # Get first active Telegram account
        account = db.query(TelegramAccount).filter(
            TelegramAccount.is_active == True,
            TelegramAccount.session_string.isnot(None),
            TelegramAccount.api_id.isnot(None),
            TelegramAccount.api_hash.isnot(None),
        ).first()
        
        if not account:
            # Fallback to env or old settings
            import os
            db = SessionLocal()
            try:
                settings = crud.get_telegram_api_settings(db)
            finally:
                db.close()
            
            return {
                "api_id": int(settings.get("telegram_api_id") or os.getenv("TELEGRAM_API_ID", "0")),
                "api_hash": settings.get("telegram_api_hash") or os.getenv("TELEGRAM_API_HASH", ""),
                "session_string": settings.get("telegram_session_string") or os.getenv("TELEGRAM_SESSION_STRING", ""),
            }
        
        return {
            "api_id": account.api_id,
            "api_hash": account.api_hash,
            "session_string": account.session_string,
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
    ) -> MessageModel:
        """Відправити повідомлення в Telegram."""
        
        # Отримати розмову
        conversation = self.db.query(Conversation).filter(
            Conversation.id == conversation_id
        ).first()
        
        if not conversation:
            raise ValueError(f"Conversation {conversation_id} not found")
        
        # Позначити, що повідомлення відправлено через CRM API
        if metadata is None:
            metadata = {}
        metadata["sent_from_crm"] = True
        
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
            
            # Parse external_id - could be phone number, username, or chat_id
            external_id = conversation.external_id
            entity = None
            import logging
            logger = logging.getLogger(__name__)
            
            # Try different methods to get entity
            try:
                if external_id.startswith('+'):
                    # Phone number - try direct lookup first
                    try:
                        entity = await client.get_entity(external_id)
                        logger.info(f"Found entity by phone: {external_id}")
                    except Exception:
                        # If direct lookup fails, search in dialogs
                        logger.info(f"Direct lookup failed for {external_id}, searching in dialogs...")
                        phone_digits = external_id.replace('+', '').replace(' ', '').replace('-', '')
                        async for dialog in client.iter_dialogs():
                            if hasattr(dialog.entity, 'phone'):
                                dialog_phone = dialog.entity.phone.replace(' ', '').replace('-', '')
                                if dialog_phone == phone_digits or dialog_phone.endswith(phone_digits[-9:]):
                                    entity = dialog.entity
                                    logger.info(f"Found entity in dialogs by phone: {external_id}")
                                    break
                elif external_id.startswith('@'):
                    # Username
                    entity = await client.get_entity(external_id)
                    logger.info(f"Found entity by username: {external_id}")
                else:
                    # Try as chat_id (integer) first
                    try:
                        chat_id = int(external_id)
                        entity = await client.get_entity(chat_id)
                        logger.info(f"Found entity by chat_id: {chat_id}")
                    except (ValueError, TypeError):
                        # If not a number, try as string (username without @)
                        try:
                            entity = await client.get_entity(external_id)
                        except Exception:
                            # Last resort: try with @ prefix
                            entity = await client.get_entity(f"@{external_id}")
            except Exception as e:
                logger.error(f"Failed to get Telegram entity for {external_id}: {e}")
                # Last attempt: search in dialogs by ID
                try:
                    async for dialog in client.iter_dialogs():
                        dialog_id_str = str(dialog.id)
                        if dialog_id_str == external_id or dialog_id_str == external_id.replace('+', ''):
                            entity = dialog.entity
                            logger.info(f"Found entity in dialogs by ID: {external_id}")
                            break
                except Exception as search_error:
                    logger.error(f"Failed to search dialogs: {search_error}")
                
                if entity is None:
                    raise ValueError(f"Could not find Telegram contact for {external_id}. Error: {str(e)}")
            
            if entity is None:
                raise ValueError(f"Could not resolve Telegram entity for {external_id}")
            
            # Якщо є вкладення, відправити файли
            if attachments:
                from pathlib import Path
                from modules.communications.models import Attachment
                from modules.communications.utils.media import get_media_dir
                
                MEDIA_DIR = get_media_dir()
                
                if not MEDIA_DIR or not MEDIA_DIR.exists():
                    logger.error(f"❌ MEDIA_DIR is not configured or doesn't exist: {MEDIA_DIR}")
                    raise ValueError(f"Media directory not configured: {MEDIA_DIR}")
                
                logger.info(f"📎 Processing {len(attachments)} attachments for Telegram message")
                logger.info(f"📎 MEDIA_DIR: {MEDIA_DIR}")
                logger.info(f"📎 Attachments data: {attachments}")
                files = []
                for att in attachments:
                    att_id = att.get("id")
                    url = att.get("url", "")
                    
                    logger.info(f"📎 Processing attachment: {att}, ID: {att_id}, URL: {url}")
                    
                    file_path = None
                    
                    # Спробувати знайти файл за ID
                    if att_id:
                        try:
                            attachment_obj = self.db.query(Attachment).filter(
                                Attachment.id == UUID(att_id)
                            ).first()
                            if attachment_obj and attachment_obj.file_path:
                                # Склеюємо базовий шлях з тим, що зберігається в БД
                                # В БД зберігається як "attachments/filename.pdf"
                                file_path = MEDIA_DIR / attachment_obj.file_path if attachment_obj.file_path else None
                                logger.info(f"📁 Found attachment in DB: {file_path} (from DB: {attachment_obj.file_path})")
                            else:
                                logger.warning(f"⚠️ Attachment object found but file_path is empty: {att_id}")
                        except Exception as e:
                            logger.warning(f"⚠️ Failed to load attachment by ID {att_id}: {e}")
                    
                    # Якщо не знайдено за ID, спробувати за URL
                    if not file_path and url:
                        # Extract filename from URL
                        url_clean = url.split("?")[0]
                        if "/media/" in url_clean:
                            # Використовуємо повний шлях з URL (attachments/filename)
                            file_path_str = url_clean.split("/media/")[-1]
                            file_path = MEDIA_DIR / file_path_str
                            logger.info(f"📁 Looking for file from /media/ URL: {file_path}")
                        elif "/files/" in url_clean:
                            # Якщо це /files/{id}, спробувати знайти за ID
                            file_id = url_clean.split("/files/")[-1]
                            try:
                                attachment_obj = self.db.query(Attachment).filter(
                                    Attachment.id == UUID(file_id)
                                ).first()
                                if attachment_obj and attachment_obj.file_path:
                                    file_path = MEDIA_DIR / attachment_obj.file_path
                                    logger.info(f"📁 Found attachment via /files/ URL: {file_path}")
                            except:
                                logger.warning(f"⚠️ Failed to parse file_id from URL: {file_id}")
                        else:
                            # Якщо URL не містить /media/, спробувати як прямий шлях
                            file_path = MEDIA_DIR / url_clean.lstrip("/")
                            logger.info(f"📁 Looking for file from URL (direct path): {file_path}")
                    
                    if file_path and file_path.exists():
                        file_size = file_path.stat().st_size
                        size_mb = file_size / (1024 * 1024)
                        logger.info(f"✅ File found: {file_path} ({size_mb:.2f} MB)")
                        
                        # Telegram limits: 20MB for photos, 50MB for documents/videos
                        if size_mb > 50:
                            logger.error(f"❌ File too large for Telegram: {size_mb:.2f} MB (max 50 MB)")
                            continue
                        elif size_mb > 20:
                            logger.warning(f"⚠️ File larger than 20 MB, will send as document: {size_mb:.2f} MB")
                        
                        files.append(str(file_path))
                    else:
                        logger.error(f"❌ File not found: {file_path}")
                
                if files:
                    logger.info(f"📤 Sending {len(files)} file(s) via Telegram")
                    # Send with attachments
                    await client.send_file(entity, files, caption=content if content else None)
                    logger.info(f"✅ Files sent successfully via Telegram")
                else:
                    logger.warning(f"⚠️ No valid files found, sending text only")
                    # No valid files, just send text
                    if content:
                        await client.send_message(entity, content)
            else:
                await client.send_message(entity, content)
            
            logger.info(f"✅ Telegram message sent successfully to {external_id}")
            
            # Оновити статус
            message.status = MessageStatus.SENT
            message.sent_at = datetime.utcnow()
            self.db.commit()
            logger.info(f"✅ Message status updated to SENT in database")
            
        except Exception as e:
            import logging
            logging.getLogger(__name__).error(f"Error sending Telegram message: {e}")
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
        is_from_me: Optional[bool] = None,
        subject: Optional[str] = None,
    ) -> MessageModel:
        """Обробити вхідне повідомлення з Telegram."""
        
        # Отримати або створити розмову
        conversation = await self.get_or_create_conversation(
            external_id=external_id,
            client_id=None,  # Буде знайдено або створено клієнта
            subject=subject,
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
            Conversation.platform == PlatformEnum.TELEGRAM,
            Conversation.external_id == external_id,
        ).first()
        
        if conversation:
            # Оновлюємо subject якщо він переданий і відрізняється від поточного
            # (особливо корисно для груп, де назва може бути отримана пізніше)
            if subject and subject != conversation.subject:
                # Не оновлюємо якщо поточний subject не є fallback (не містить "Група -100")
                is_fallback = conversation.subject and (
                    conversation.subject.startswith("Група ") or 
                    conversation.subject.startswith("Group ")
                )
                if is_fallback or not conversation.subject:
                    conversation.subject = subject
                    self.db.commit()
                    self.db.refresh(conversation)
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

