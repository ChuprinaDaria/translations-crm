from uuid import UUID, uuid4
from enum import Enum
from datetime import datetime
from typing import TYPE_CHECKING, Any
from sqlalchemy import String, Text, ForeignKey, DateTime
from sqlalchemy.types import JSON
from sqlalchemy.sql import func
from sqlalchemy.dialects.postgresql import UUID as PostgresUUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from core.db import Base

if TYPE_CHECKING:
    from modules.crm.models import Client


class PlatformEnum(str, Enum):
    TELEGRAM = "telegram"
    WHATSAPP = "whatsapp"
    INSTAGRAM = "instagram"
    FACEBOOK = "facebook"
    EMAIL = "email"


class MessageDirection(str, Enum):
    INBOUND = "inbound"
    OUTBOUND = "outbound"


class MessageType(str, Enum):
    TEXT = "text"
    HTML = "html"
    FILE = "file"


class MessageStatus(str, Enum):
    QUEUED = "queued"
    SENT = "sent"
    READ = "read"
    FAILED = "failed"


class Conversation(Base):
    __tablename__ = "communications_conversations"
    
    id: Mapped[UUID] = mapped_column(PostgresUUID(as_uuid=True), primary_key=True, default=uuid4, index=True)
    client_id: Mapped[UUID | None] = mapped_column(PostgresUUID(as_uuid=True), ForeignKey("crm_clients.id"), nullable=True, index=True)
    platform: Mapped[PlatformEnum] = mapped_column(String, nullable=False, index=True)
    external_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    subject: Mapped[str | None] = mapped_column(String, nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    
    client: Mapped["Client | None"] = relationship("Client", back_populates="conversations", lazy="joined")
    messages: Mapped[list["Message"]] = relationship("Message", back_populates="conversation", lazy="selectin", cascade="all, delete-orphan")


class Message(Base):
    __tablename__ = "communications_messages"
    
    id: Mapped[UUID] = mapped_column(PostgresUUID(as_uuid=True), primary_key=True, default=uuid4, index=True)
    conversation_id: Mapped[UUID] = mapped_column(PostgresUUID(as_uuid=True), ForeignKey("communications_conversations.id"), nullable=False, index=True)
    direction: Mapped[MessageDirection] = mapped_column(String, nullable=False, index=True)
    type: Mapped[MessageType] = mapped_column(String, nullable=False, index=True)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[MessageStatus] = mapped_column(String, default=MessageStatus.QUEUED, nullable=False, index=True)
    # Use JSONB on Postgres, JSON elsewhere (e.g. SQLite dev fallback).
    attachments: Mapped[list[dict[str, Any]] | None] = mapped_column(
        JSON().with_variant(JSONB, "postgresql"),
        nullable=True,
    )
    meta_data: Mapped[dict[str, Any] | None] = mapped_column(
        JSON().with_variant(JSONB, "postgresql"),
        nullable=True,
    )
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    
    conversation: Mapped["Conversation"] = relationship("Conversation", back_populates="messages", lazy="joined")

