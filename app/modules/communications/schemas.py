from uuid import UUID
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr
from modules.communications.models import (
    PlatformEnum,
    MessageDirection,
    MessageType,
    MessageStatus
)


class MessageCreate(BaseModel):
    conversation_id: UUID
    direction: MessageDirection
    type: MessageType
    content: str
    status: Optional[MessageStatus] = MessageStatus.QUEUED
    attachments: Optional[list[dict]] = None
    meta_data: Optional[dict] = None


class EmailMessageCreate(MessageCreate):
    subject: str
    to: list[EmailStr]
    cc: Optional[list[EmailStr]] = None
    bcc: Optional[list[EmailStr]] = None


class ChatMessageCreate(MessageCreate):
    pass


class MessageRead(BaseModel):
    id: UUID
    conversation_id: UUID
    direction: MessageDirection
    type: MessageType
    content: str
    status: MessageStatus
    attachments: Optional[list[dict]] = None
    meta_data: Optional[dict] = None
    sent_at: Optional[datetime] = None
    created_at: datetime
    
    class Config:
        from_attributes = True


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

