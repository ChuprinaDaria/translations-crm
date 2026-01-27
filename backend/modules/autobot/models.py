from uuid import UUID, uuid4
from datetime import datetime, time, date
from typing import TYPE_CHECKING, Any
from sqlalchemy import String, Integer, Boolean, Time, Date, Text, ForeignKey, DateTime
from sqlalchemy.types import JSON
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
from core.db import Base

if TYPE_CHECKING:
    from modules.crm.models import Office, Client, Order
    from modules.communications.models import Message


class AutobotSettings(Base):
    """Налаштування автобота для офісу"""
    __tablename__ = "autobot_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    office_id: Mapped[int] = mapped_column(Integer, ForeignKey("offices.id"), nullable=False, unique=True, index=True)
    
    # Робочі години
    enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    monday_start: Mapped[time | None] = mapped_column(Time, nullable=True)
    monday_end: Mapped[time | None] = mapped_column(Time, nullable=True)
    tuesday_start: Mapped[time | None] = mapped_column(Time, nullable=True)
    tuesday_end: Mapped[time | None] = mapped_column(Time, nullable=True)
    wednesday_start: Mapped[time | None] = mapped_column(Time, nullable=True)
    wednesday_end: Mapped[time | None] = mapped_column(Time, nullable=True)
    thursday_start: Mapped[time | None] = mapped_column(Time, nullable=True)
    thursday_end: Mapped[time | None] = mapped_column(Time, nullable=True)
    friday_start: Mapped[time | None] = mapped_column(Time, nullable=True)
    friday_end: Mapped[time | None] = mapped_column(Time, nullable=True)
    saturday_start: Mapped[time | None] = mapped_column(Time, nullable=True)
    saturday_end: Mapped[time | None] = mapped_column(Time, nullable=True)
    sunday_start: Mapped[time | None] = mapped_column(Time, nullable=True)
    sunday_end: Mapped[time | None] = mapped_column(Time, nullable=True)
    
    # Повідомлення бота
    auto_reply_message: Mapped[str] = mapped_column(
        Text, 
        nullable=False, 
        default="""Добрий день! 👋

Це Бюро перекладів MT.

На жаль, зараз неробочий час, але ви можете:
- Написати ваше питання тут
- Відправити документ для перевірки

Наш менеджер зв'яжеться з вами в робочий час.

З цінами наших послуг ви можете ознайомитися на нашому сайті:
https://www.tlumaczeniamt.pl/cennik/

Для точної оцінки вартості, будь ласка, надішліть якісні фото або скани усіх сторінок документа.

Гарного дня! ☀️"""
    )
    
    # Додаткові налаштування
    auto_create_client: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    auto_create_order: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    auto_save_files: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    
    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    
    # Relationships
    office: Mapped["Office"] = relationship("Office", back_populates="autobot_settings", lazy="joined")
    holidays: Mapped[list["AutobotHoliday"]] = relationship("AutobotHoliday", back_populates="settings", cascade="all, delete-orphan", lazy="selectin")
    logs: Mapped[list["AutobotLog"]] = relationship("AutobotLog", back_populates="settings", lazy="selectin")


class AutobotHoliday(Base):
    """Свята та неробочі дні"""
    __tablename__ = "autobot_holidays"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    settings_id: Mapped[int] = mapped_column(Integer, ForeignKey("autobot_settings.id"), nullable=False, index=True)
    date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    is_recurring: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)  # Щорічне свято
    
    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    
    # Relationships
    settings: Mapped["AutobotSettings"] = relationship("AutobotSettings", back_populates="holidays", lazy="joined")


class AutobotLog(Base):
    """Лог роботи бота"""
    __tablename__ = "autobot_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    settings_id: Mapped[int] = mapped_column(Integer, ForeignKey("autobot_settings.id"), nullable=False, index=True)
    office_id: Mapped[int] = mapped_column(Integer, ForeignKey("offices.id"), nullable=False, index=True)
    
    # Деталі
    message_id: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)  # ID вхідного повідомлення
    client_id: Mapped[UUID | None] = mapped_column(ForeignKey("crm_clients.id"), nullable=True, index=True)
    order_id: Mapped[UUID | None] = mapped_column(ForeignKey("crm_orders.id"), nullable=True, index=True)
    
    # Дії
    action_taken: Mapped[str] = mapped_column(String(100), nullable=False, index=True)  # 'auto_reply', 'client_created', 'order_created', 'file_saved'
    success: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    
    # Метадані
    meta_data: Mapped[dict[str, Any] | None] = mapped_column(
        JSON().with_variant(JSONB, "postgresql"),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
    
    # Relationships
    settings: Mapped["AutobotSettings"] = relationship("AutobotSettings", back_populates="logs", lazy="joined")
    office: Mapped["Office"] = relationship("Office", lazy="joined")
    client: Mapped["Client | None"] = relationship("Client", lazy="joined")
    order: Mapped["Order | None"] = relationship("Order", lazy="joined")

