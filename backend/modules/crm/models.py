from uuid import UUID, uuid4
from enum import Enum
from datetime import datetime
from typing import TYPE_CHECKING, List
from sqlalchemy import String, DateTime, ForeignKey, Integer, Text, Float, Boolean, ARRAY
from sqlalchemy.sql import func
from sqlalchemy.dialects.postgresql import UUID as PostgresUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from core.db import Base

if TYPE_CHECKING:
    from modules.auth.models import User
    from modules.communications.models import Conversation
    from modules.finance.models import Transaction


class OrderStatus(str, Enum):
    DO_WYKONANIA = "do_wykonania"
    DO_POSWIADCZENIA = "do_poswiadczenia"
    DO_WYDANIA = "do_wydania"
    USTNE = "ustne"
    CLOSED = "closed"


class ClientSource(str, Enum):
    EMAIL = "email"
    TELEGRAM = "telegram"
    WHATSAPP = "whatsapp"
    INSTAGRAM = "instagram"
    FACEBOOK = "facebook"
    MANUAL = "manual"


class EntityType(str, Enum):
    CLIENT = "client"
    ORDER = "order"
    CHAT = "chat"
    PAYMENT = "payment"


class TimelineStepType(str, Enum):
    """Типи етапів в Timeline замовлення"""
    CLIENT_CREATED = "client_created"  # 1. Створено клієнта
    ORDER_CREATED = "order_created"  # 2. Створено замовлення
    PAYMENT_LINK_SENT = "payment_link_sent"  # 3. Надіслано лінк оплати
    PAYMENT_RECEIVED = "payment_received"  # 4. Оплачено
    TRANSLATOR_ASSIGNED = "translator_assigned"  # 5. Призначено перекладача
    TRANSLATION_READY = "translation_ready"  # 6. Переклад готовий
    ISSUED_SENT = "issued_sent"  # 7. Видано/Відправлено


class Client(Base):
    __tablename__ = "crm_clients"
    
    id: Mapped[UUID] = mapped_column(PostgresUUID(as_uuid=True), primary_key=True, default=uuid4, index=True)
    full_name: Mapped[str] = mapped_column(String, nullable=False, index=True)
    email: Mapped[str | None] = mapped_column(String, nullable=True, index=True)
    phone: Mapped[str] = mapped_column(String, nullable=False, index=True)
    source: Mapped[ClientSource] = mapped_column(String, default=ClientSource.MANUAL, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    
    orders: Mapped[list["Order"]] = relationship("Order", back_populates="client", lazy="selectin", cascade="all, delete-orphan")
    conversations: Mapped[list["Conversation"]] = relationship("Conversation", back_populates="client", lazy="selectin", cascade="all, delete-orphan")


class Office(Base):
    """Офіси видачі замовлень"""
    __tablename__ = "offices"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String, nullable=False, index=True)
    address: Mapped[str] = mapped_column(String, nullable=False)
    city: Mapped[str] = mapped_column(String, nullable=False, index=True)
    postal_code: Mapped[str] = mapped_column(String, nullable=False)
    phone: Mapped[str] = mapped_column(String, nullable=False)
    email: Mapped[str] = mapped_column(String, nullable=False)
    working_hours: Mapped[str] = mapped_column(String, nullable=False)
    is_active: Mapped[bool] = mapped_column(default=True, nullable=False, index=True)
    is_default: Mapped[bool] = mapped_column(default=False, nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
    
    orders: Mapped[list["Order"]] = relationship("Order", back_populates="office", lazy="selectin")


class Order(Base):
    __tablename__ = "crm_orders"
    
    id: Mapped[UUID] = mapped_column(PostgresUUID(as_uuid=True), primary_key=True, default=uuid4, index=True)
    client_id: Mapped[UUID] = mapped_column(PostgresUUID(as_uuid=True), ForeignKey("crm_clients.id"), nullable=False, index=True)
    manager_id: Mapped[UUID] = mapped_column(PostgresUUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    order_number: Mapped[str] = mapped_column(String, unique=True, nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(String, nullable=True)
    status: Mapped[OrderStatus] = mapped_column(String, default=OrderStatus.DO_WYKONANIA, nullable=False, index=True)
    deadline: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, index=True)
    file_url: Mapped[str | None] = mapped_column(String, nullable=True)
    office_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("offices.id"), nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    
    client: Mapped["Client"] = relationship("Client", back_populates="orders", lazy="joined")
    manager: Mapped["User"] = relationship("User", back_populates="orders", lazy="joined")
    office: Mapped["Office | None"] = relationship("Office", back_populates="orders", lazy="joined")
    transactions: Mapped[list["Transaction"]] = relationship("Transaction", back_populates="order", lazy="selectin", cascade="all, delete-orphan")
    timeline_steps: Mapped[list["TimelineStep"]] = relationship("TimelineStep", back_populates="order", lazy="selectin", cascade="all, delete-orphan", order_by="TimelineStep.created_at")
    translation_requests: Mapped[list["TranslationRequest"]] = relationship("TranslationRequest", back_populates="order", lazy="selectin", cascade="all, delete-orphan")


class InternalNote(Base):
    """Єдина система нотаток для всіх сутностей"""
    __tablename__ = "internal_notes"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    entity_type: Mapped[EntityType] = mapped_column(String, nullable=False, index=True)
    entity_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    author_id: Mapped[UUID] = mapped_column(PostgresUUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    author_name: Mapped[str] = mapped_column(String, nullable=False)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
    
    author: Mapped["User"] = relationship("User", lazy="joined")


class TimelineStep(Base):
    """Етапи Timeline для замовлення"""
    __tablename__ = "timeline_steps"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    order_id: Mapped[UUID] = mapped_column(PostgresUUID(as_uuid=True), ForeignKey("crm_orders.id"), nullable=False, index=True)
    step_type: Mapped[TimelineStepType] = mapped_column(String, nullable=False, index=True)
    completed: Mapped[bool] = mapped_column(default=True, nullable=False)
    completed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
    completed_by_id: Mapped[UUID | None] = mapped_column(PostgresUUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    step_metadata: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON для додаткових даних
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
    
    order: Mapped["Order"] = relationship("Order", back_populates="timeline_steps", lazy="joined")
    completed_by: Mapped["User | None"] = relationship("User", foreign_keys=[completed_by_id], lazy="joined")


class TranslatorStatus(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    BUSY = "busy"


class Translator(Base):
    """Перекладачі"""
    __tablename__ = "translators"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String, nullable=False, index=True)
    email: Mapped[str] = mapped_column(String, nullable=False, unique=True, index=True)
    phone: Mapped[str] = mapped_column(String, nullable=False, index=True)
    telegram_id: Mapped[str | None] = mapped_column(String, nullable=True, index=True)
    whatsapp: Mapped[str | None] = mapped_column(String, nullable=True)
    
    status: Mapped[TranslatorStatus] = mapped_column(String, default=TranslatorStatus.ACTIVE, nullable=False, index=True)
    rating: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    completed_orders: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    
    languages: Mapped[list["TranslatorLanguage"]] = relationship("TranslatorLanguage", back_populates="translator", lazy="selectin", cascade="all, delete-orphan")
    translation_requests: Mapped[list["TranslationRequest"]] = relationship("TranslationRequest", back_populates="translator", lazy="selectin", cascade="all, delete-orphan")


class TranslatorLanguage(Base):
    """Мови та ставки перекладача"""
    __tablename__ = "translator_languages"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    translator_id: Mapped[int] = mapped_column(Integer, ForeignKey("translators.id"), nullable=False, index=True)
    language: Mapped[str] = mapped_column(String, nullable=False, index=True)  # "Angielski", "Niemiecki", etc.
    rate_per_page: Mapped[float] = mapped_column(Float, nullable=False)
    specializations: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON array: ["TRC", "Umowy", "Szkolne"]
    
    translator: Mapped["Translator"] = relationship("Translator", back_populates="languages", lazy="joined")


class TranslationRequestStatus(str, Enum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    DECLINED = "declined"


class TranslationRequest(Base):
    """Запити на переклад"""
    __tablename__ = "translation_requests"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    order_id: Mapped[UUID] = mapped_column(PostgresUUID(as_uuid=True), ForeignKey("crm_orders.id"), nullable=False, index=True)
    translator_id: Mapped[int] = mapped_column(Integer, ForeignKey("translators.id"), nullable=False, index=True)
    
    sent_via: Mapped[str] = mapped_column(String, nullable=False, index=True)  # "email" | "telegram" | "whatsapp"
    sent_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
    
    status: Mapped[TranslationRequestStatus] = mapped_column(String, default=TranslationRequestStatus.PENDING, nullable=False, index=True)
    response_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    
    offered_rate: Mapped[float] = mapped_column(Float, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
    
    order: Mapped["Order"] = relationship("Order", back_populates="translation_requests", lazy="joined")
    translator: Mapped["Translator"] = relationship("Translator", back_populates="translation_requests", lazy="joined")

