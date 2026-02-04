from uuid import UUID
from datetime import datetime
from typing import Optional, List, Dict, Any
from enum import Enum
from pathlib import Path
from pydantic import BaseModel, EmailStr, Field
from modules.communications.models import (
    PlatformEnum,
    MessageDirection,
    MessageType,
    MessageStatus
)


# ========== Message Schemas ==========

class MessageCreate(BaseModel):
    conversation_id: UUID
    direction: MessageDirection
    type: MessageType
    content: str
    status: Optional[MessageStatus] = MessageStatus.QUEUED
    attachments: Optional[List[Dict[str, Any]]] = None
    meta_data: Optional[Dict[str, Any]] = None


class MessageSend(BaseModel):
    """Схема для відправки повідомлення через сервіс."""
    conversation_id: UUID
    content: str
    attachments: Optional[List[Dict[str, Any]]] = None
    metadata: Optional[Dict[str, Any]] = None


class MessageSendRequest(BaseModel):
    """Схема для API запиту на відправку повідомлення."""
    content: str
    attachments: Optional[List[Dict[str, Any]]] = None
    meta_data: Optional[Dict[str, Any]] = None


class EmailMessageCreate(MessageCreate):
    subject: str
    to: List[EmailStr]
    cc: Optional[List[EmailStr]] = None
    bcc: Optional[List[EmailStr]] = None


class ChatMessageCreate(MessageCreate):
    pass


class MessageRead(BaseModel):
    id: UUID
    conversation_id: UUID
    direction: MessageDirection
    type: MessageType
    content: str
    status: MessageStatus
    attachments: Optional[List[Dict[str, Any]]] = None
    meta_data: Optional[Dict[str, Any]] = None
    sent_at: Optional[datetime] = None
    created_at: datetime
    
    @classmethod
    def from_orm_with_attachments(cls, message):
        """Створити MessageRead з повідомлення, включаючи attachment_objects."""
        from modules.communications.utils.media import get_attachment_url
        
        # Конвертувати message в dict
        data = {
            "id": message.id,
            "conversation_id": message.conversation_id,
            "direction": message.direction,
            "type": message.type,
            "content": message.content,
            "status": message.status,
            "meta_data": message.meta_data,
            "sent_at": message.sent_at,
            "created_at": message.created_at,
        }
        
        # Якщо є attachment_objects, використовуємо їх
        if hasattr(message, 'attachment_objects') and message.attachment_objects:
            attachments = []
            for att_obj in message.attachment_objects:
                attachments.append({
                    "id": str(att_obj.id),
                    "type": att_obj.file_type,
                    "filename": att_obj.original_name,
                    "mime_type": att_obj.mime_type,
                    "size": att_obj.file_size,
                    "url": f"/api/v1/communications/media/{att_obj.file_path}",  # Використовуємо повний шлях: attachments/filename
                })
            data["attachments"] = attachments
        elif message.attachments:
            # Fallback на старий формат attachments (JSON)
            data["attachments"] = message.attachments
        
        return cls(**data)
    
    class Config:
        from_attributes = True


# ========== Conversation Schemas ==========

class ConversationCreate(BaseModel):
    """Схема для створення нової розмови."""
    platform: PlatformEnum
    external_id: str
    client_id: Optional[UUID] = None
    subject: Optional[str] = None


class ConversationRead(BaseModel):
    id: UUID
    client_id: Optional[UUID] = None
    platform: PlatformEnum
    external_id: str
    subject: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class ConversationWithMessages(ConversationRead):
    """Розмова з повідомленнями."""
    messages: List[MessageRead] = []
    unread_count: int = 0
    last_message: Optional[MessageRead] = None
    # Поля для пагінації повідомлень
    total_messages: Optional[int] = None
    has_more_messages: bool = False


# ========== Inbox Schemas ==========

class ConversationListItem(BaseModel):
    """Схема для елемента списку розмов в інбоксі."""
    id: UUID
    platform: PlatformEnum
    external_id: str
    subject: Optional[str] = None
    client_id: Optional[UUID] = None
    client_name: Optional[str] = None
    unread_count: int = 0
    last_message: Optional[str] = None
    last_message_at: Optional[datetime] = None
    updated_at: datetime
    assigned_manager_id: Optional[UUID] = None
    needs_attention: bool = False  # True якщо менеджер не відповідав 10+ хвилин
    is_archived: bool = False  # Чи діалог архівований
    
    class Config:
        from_attributes = True


class InboxResponse(BaseModel):
    """Відповідь для unified inbox."""
    conversations: List[ConversationListItem]
    total: int
    unread_total: int
    has_more: bool = False  # Чи є ще діалоги для завантаження


# ========== Filter Schemas ==========

class ConversationFilter(str, Enum):
    """Фільтри для розмов."""
    ALL = "all"
    NEW = "new"
    IN_PROGRESS = "in_progress"
    NEEDS_REPLY = "needs_reply"
    ARCHIVED = "archived"


class InboxQueryParams(BaseModel):
    """Параметри запиту для інбоксу."""
    filter: Optional[ConversationFilter] = ConversationFilter.ALL
    platform: Optional[PlatformEnum] = None
    search: Optional[str] = None
    limit: int = Field(default=50, ge=1, le=100)
    offset: int = Field(default=0, ge=0)


# ========== Client Creation from Conversation ==========

class ClientFromConversation(BaseModel):
    """Схема для створення клієнта з розмови."""
    # conversation_id НЕ ТРЕБА - він приходить з path параметру!
    name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    company_name: Optional[str] = None


# ========== Quick Actions ==========

class QuickActionRequest(BaseModel):
    """Схема для швидких дій."""
    action: str  # "create_client", "download_files", "create_order", "mark_important"
    data: Optional[Dict[str, Any]] = None


# ========== File Attachment ==========

class FileAttachment(BaseModel):
    """Схема для вкладеного файлу."""
    id: Optional[str] = None
    type: str  # "image", "document", "video", "audio"
    url: Optional[str] = None
    filename: Optional[str] = None
    mime_type: Optional[str] = None
    size: Optional[int] = None
    thumbnail_url: Optional[str] = None

