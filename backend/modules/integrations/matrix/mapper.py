"""
Matrix Mapper - конвертація Matrix сутностей в Inbox формат.
"""
from typing import Dict, Any, Optional, List
from datetime import datetime, timezone
from uuid import UUID

from modules.communications.models import (
    Conversation,
    Message as MessageModel,
    MessageDirection,
    MessageType,
    MessageStatus,
    PlatformEnum,
)
from .schemas import MatrixRoomInfo, MatrixEventInfo, MatrixMessageContent


class MatrixMapper:
    """
    Мапер для конвертації Matrix сутностей (Rooms, Events) 
    в внутрішній стандарт Inbox Page.
    """
    
    @staticmethod
    def room_to_conversation_external_id(room_id: str) -> str:
        """
        Конвертувати Matrix room_id в external_id для Conversation.
        
        Matrix room_id має формат: !abc123:matrix.org
        Для WhatsApp через mautrix-whatsapp, room_id відповідає номеру телефону.
        
        Args:
            room_id: Matrix room ID
            
        Returns:
            external_id для Conversation (номер телефону)
        """
        # mautrix-whatsapp зберігає номер телефону в room_id або в метаданих
        # Якщо room_id містить номер телефону, витягуємо його
        # Інакше використовуємо room_id як є
        return room_id
    
    @staticmethod
    def extract_phone_from_room(room_id: str, room_info: Optional[Dict[str, Any]] = None) -> str:
        """
        Витягнути номер телефону з Matrix room.
        
        Args:
            room_id: Matrix room ID
            room_info: Додаткова інформація про кімнату
            
        Returns:
            Номер телефону або room_id як fallback
        """
        # mautrix-whatsapp зберігає номер телефону в room aliases або в метаданих
        if room_info:
            # Перевіряємо aliases
            aliases = room_info.get("aliases", [])
            for alias in aliases:
                # Формат може бути: #+1234567890:matrix.org
                if alias.startswith("#+"):
                    phone = alias.split(":")[0][1:]  # Видаляємо #
                    return phone
            
            # Перевіряємо кастомні метадані
            metadata = room_info.get("metadata", {})
            phone = metadata.get("whatsapp_phone") or metadata.get("phone")
            if phone:
                return phone
        
        # Fallback: використовуємо room_id
        return room_id
    
    @staticmethod
    def event_to_message_content(event: Dict[str, Any]) -> tuple[str, MessageType, Optional[List[Dict[str, Any]]]]:
        """
        Конвертувати Matrix event в content, type та attachments.
        
        Args:
            event: Matrix event dict
            
        Returns:
            Tuple: (content, message_type, attachments)
        """
        content = event.get("content", {})
        msgtype = content.get("msgtype", "")
        
        # Текстове повідомлення
        if msgtype == "m.text":
            text_content = content.get("body", "")
            # Якщо є formatted_body, використовуємо його
            if content.get("format") == "org.matrix.custom.html":
                text_content = content.get("formatted_body", text_content)
            return text_content, MessageType.TEXT, None
        
        # Зображення
        elif msgtype == "m.image":
            body = content.get("body", "Image")
            url = content.get("url", "")
            info = content.get("info", {})
            
            attachments = [{
                "type": "image",
                "url": url,
                "filename": body,
                "mime_type": info.get("mimetype", "image/jpeg"),
                "size": info.get("size"),
                "thumbnail_url": info.get("thumbnail_url"),
            }]
            return body, MessageType.FILE, attachments
        
        # Відео
        elif msgtype == "m.video":
            body = content.get("body", "Video")
            url = content.get("url", "")
            info = content.get("info", {})
            
            attachments = [{
                "type": "video",
                "url": url,
                "filename": body,
                "mime_type": info.get("mimetype", "video/mp4"),
                "size": info.get("size"),
                "thumbnail_url": info.get("thumbnail_url"),
            }]
            return body, MessageType.FILE, attachments
        
        # Аудіо/Голос
        elif msgtype in ["m.audio", "m.voice"]:
            body = content.get("body", "Audio")
            url = content.get("url", "")
            info = content.get("info", {})
            
            attachments = [{
                "type": "audio" if msgtype == "m.audio" else "voice",
                "url": url,
                "filename": body,
                "mime_type": info.get("mimetype", "audio/ogg"),
                "size": info.get("size"),
            }]
            return body, MessageType.FILE, attachments
        
        # Файл/Документ
        elif msgtype == "m.file":
            body = content.get("body", "File")
            url = content.get("url", "")
            info = content.get("info", {})
            
            attachments = [{
                "type": "document",
                "url": url,
                "filename": body,
                "mime_type": info.get("mimetype", "application/octet-stream"),
                "size": info.get("size"),
            }]
            return body, MessageType.FILE, attachments
        
        # Sticker
        elif msgtype == "m.sticker":
            body = content.get("body", "Sticker")
            url = content.get("url", "")
            info = content.get("info", {})
            
            attachments = [{
                "type": "sticker",
                "url": url,
                "filename": body,
                "mime_type": info.get("mimetype", "image/png"),
                "size": info.get("size"),
            }]
            return body, MessageType.FILE, attachments
        
        # Fallback: текст
        else:
            body = content.get("body", str(content))
            return body, MessageType.TEXT, None
    
    @staticmethod
    def event_to_sender_info(event: Dict[str, Any], room_info: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Витягнути інформацію про відправника з Matrix event.
        
        Args:
            event: Matrix event dict
            room_info: Додаткова інформація про кімнату
            
        Returns:
            Dict з полями: name, phone, email
        """
        sender = event.get("sender", "")
        content = event.get("content", {})
        
        # Витягуємо ім'я з content (displayname)
        name = content.get("displayname") or content.get("name")
        
        # Витягуємо номер телефону з sender або room
        phone = None
        if sender.startswith("@") and ":" in sender:
            # Matrix user ID: @user:matrix.org
            # Для mautrix-whatsapp може бути: @+1234567890:matrix.org
            user_part = sender.split(":")[0][1:]  # Видаляємо @
            if user_part.startswith("+"):
                phone = user_part
        
        # Якщо phone не знайдено, спробуємо з room
        if not phone and room_info:
            phone = MatrixMapper.extract_phone_from_room(
                event.get("room_id", ""),
                room_info
            )
        
        return {
            "name": name or "Unknown",
            "phone": phone or sender,
            "email": None,
        }
    
    @staticmethod
    def event_to_metadata(event: Dict[str, Any], room_info: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Створити метадані для повідомлення з Matrix event.
        
        Args:
            event: Matrix event dict
            room_info: Додаткова інформація про кімнату
            
        Returns:
            Dict з метаданими
        """
        metadata = {
            "matrix_event_id": event.get("event_id"),
            "matrix_room_id": event.get("room_id"),
            "matrix_sender": event.get("sender"),
            "matrix_event_type": event.get("type"),
            "source": "matrix_bridge",
        }
        
        # Додаємо WhatsApp-специфічні метадані, якщо є
        content = event.get("content", {})
        if "whatsapp" in content:
            metadata["whatsapp"] = content["whatsapp"]
        
        return metadata
    
    @staticmethod
    def is_event_from_me(event: Dict[str, Any], my_user_id: str) -> bool:
        """
        Перевірити, чи event відправлено з нашого акаунту.
        
        Args:
            event: Matrix event dict
            my_user_id: Наш Matrix user ID
            
        Returns:
            True якщо event від нашого користувача
        """
        sender = event.get("sender", "")
        return sender == my_user_id

