"""
Notification models для зберігання нотифікацій та налаштувань користувачів
"""
from uuid import UUID, uuid4
from enum import Enum
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Text, JSON, Integer
from sqlalchemy.dialects.postgresql import UUID as PostgresUUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from core.db import Base


class NotificationType(str, Enum):
    """Типи нотифікацій"""
    NEW_MESSAGE = "new_message"
    PAYMENT_RECEIVED = "payment_received"
    TRANSLATOR_ACCEPTED = "translator_accepted"
    TRANSLATOR_REJECTED = "translator_rejected"
    TRANSLATION_READY = "translation_ready"
    INTERNAL_NOTE = "internal_note"
    DEADLINE_WARNING = "deadline_warning"
    DEADLINE_PASSED = "deadline_passed"


class EntityType(str, Enum):
    """Типи сутностей, до яких прив'язана нотифікація"""
    ORDER = "order"
    CLIENT = "client"
    CHAT = "chat"
    MESSAGE = "message"
    TRANSACTION = "transaction"


class Notification(Base):
    """Модель нотифікації"""
    __tablename__ = "notifications"
    
    id = Column(PostgresUUID(as_uuid=True), primary_key=True, default=uuid4, index=True)
    user_id = Column(PostgresUUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    
    # Тип нотифікації
    type = Column(String, nullable=False, index=True)
    
    # Заголовок та повідомлення
    title = Column(String, nullable=False)
    message = Column(String, nullable=False)
    
    # Прив'язка до сутності
    entity_type = Column(String, nullable=True)  # "order" | "client" | "chat" | "transaction"
    entity_id = Column(String, nullable=True)  # ID сутності (може бути UUID або string)
    
    # Додаткові дані (JSON)
    data = Column(JSON, nullable=True)  # Додаткові дані для нотифікації
    
    # Статус прочитання
    is_read = Column(Boolean, default=False, nullable=False, index=True)
    read_at = Column(DateTime(timezone=True), nullable=True)
    
    # URL для переходу при кліку
    action_url = Column(String, nullable=True)  # "/orders/123" або "/inbox/chat-456"
    
    # Автовидалення через 30 днів
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    expires_at = Column(DateTime(timezone=True), nullable=True)  # created_at + 30 days
    
    # Зв'язок з користувачем
    user = relationship("User", back_populates="notifications")


class NotificationSettings(Base):
    """Налаштування нотифікацій для користувача"""
    __tablename__ = "notification_settings"
    
    id = Column(PostgresUUID(as_uuid=True), primary_key=True, default=uuid4, index=True)
    user_id = Column(PostgresUUID(as_uuid=True), ForeignKey("users.id"), unique=True, nullable=False, index=True)
    
    # Загальні налаштування
    enabled = Column(Boolean, default=True, nullable=False)
    sound = Column(Boolean, default=True, nullable=False)
    desktop = Column(Boolean, default=True, nullable=False)
    vibration = Column(Boolean, default=True, nullable=False)  # Для mobile
    
    # Типи нотифікацій (JSON: {"new_message": true, "internal_notes": false})
    types_enabled = Column(JSON, nullable=True, default={
        "new_message": True,
        "payment_received": True,
        "translator_accepted": True,
        "translator_rejected": True,
        "translation_ready": True,
        "internal_note": False,  # За замовчуванням вимкнено
        "deadline_warning": True,
        "deadline_passed": True,
    })
    
    # Не турбувати (Do Not Disturb)
    # JSON: {"weekdays": ["22:00", "08:00"], "weekend": "all_day"}
    do_not_disturb = Column(JSON, nullable=True, default={
        "weekdays": None,  # None = не активний
        "weekend": None,  # None = не активний, "all_day" = весь день
    })
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Зв'язок з користувачем
    user = relationship("User", back_populates="notification_settings")

