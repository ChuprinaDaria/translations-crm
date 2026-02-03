"""
AI Integration Models - RAG Service Configuration
"""
import secrets
from datetime import datetime
from typing import TYPE_CHECKING, Any
from sqlalchemy import String, Boolean, Integer, Text, DateTime
from sqlalchemy.types import JSON
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func
from core.db import Base

if TYPE_CHECKING:
    pass


class AISettings(Base):
    """Налаштування AI RAG сервісу"""
    __tablename__ = "ai_settings"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    
    # API Configuration
    rag_api_url: Mapped[str] = mapped_column(
        String(500), 
        nullable=False, 
        default="https://api.adme-ai.com/v1"
    )
    rag_api_key: Mapped[str] = mapped_column(String(255), nullable=True, default="")
    rag_token: Mapped[str] = mapped_column(
        String(255), 
        nullable=True, 
        default="adme_rag_secret_987654321",
        comment="Токен для авторизації вхідних запитів від RAG (X-RAG-TOKEN)"
    )
    
    # Enable/Disable
    is_enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    
    # Configuration
    trigger_delay_seconds: Mapped[int] = mapped_column(Integer, default=10, nullable=False)
    active_channels: Mapped[list[str]] = mapped_column(
        JSON().with_variant(JSONB, "postgresql"),
        nullable=False,
        default=list
    )
    
    # Webhook Security
    webhook_secret: Mapped[str] = mapped_column(
        String(64), 
        nullable=False, 
        default=lambda: secrets.token_hex(32)
    )
    
    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), 
        server_default=func.now(), 
        nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), 
        server_default=func.now(), 
        onupdate=func.now(), 
        nullable=False
    )

