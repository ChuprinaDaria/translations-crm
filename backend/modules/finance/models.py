from uuid import UUID, uuid4
from enum import Enum
from datetime import date, datetime
from decimal import Decimal
from typing import TYPE_CHECKING, Optional
from sqlalchemy import String, Date, Text, ForeignKey, Numeric, DateTime
from sqlalchemy.sql import func
from sqlalchemy.dialects.postgresql import UUID as PostgresUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from core.db import Base

if TYPE_CHECKING:
    from modules.crm.models import Order


class PaymentMethod(str, Enum):
    TRANSFER = "transfer"
    CARD = "card"
    BLIK = "blik"
    CASH = "cash"


class PaymentStatus(str, Enum):
    """Статус оплати для Stripe транзакцій"""
    PENDING = "pending"
    SUCCEEDED = "succeeded"
    FAILED = "failed"
    REFUNDED = "refunded"


class ShipmentMethod(str, Enum):
    """Метод доставки"""
    INPOST_LOCKER = "inpost_locker"  # InPost пачкомат
    INPOST_COURIER = "inpost_courier"  # InPost кур'єр
    OFFICE_PICKUP = "office_pickup"  # Самовивіз з офісу
    COURIER = "courier"  # Інший кур'єр


class ShipmentStatus(str, Enum):
    """Статус відправки"""
    CREATED = "created"  # Створено
    LABEL_PRINTED = "label_printed"  # Етикетка надрукована
    IN_TRANSIT = "in_transit"  # В дорозі
    READY_FOR_PICKUP = "ready_for_pickup"  # Готово до отримання
    DELIVERED = "delivered"  # Доставлено
    RETURNED = "returned"  # Повернено


class Transaction(Base):
    __tablename__ = "finance_transactions"
    
    id: Mapped[UUID] = mapped_column(PostgresUUID(as_uuid=True), primary_key=True, default=uuid4, index=True)
    order_id: Mapped[UUID] = mapped_column(PostgresUUID(as_uuid=True), ForeignKey("crm_orders.id"), nullable=False, index=True)
    amount_gross: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    payment_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    service_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    posting_date: Mapped[date | None] = mapped_column(Date, nullable=True, index=True)  # Data nabicia na KF
    receipt_number: Mapped[str] = mapped_column(String, nullable=False, index=True)
    payment_method: Mapped[PaymentMethod] = mapped_column(String, nullable=False, index=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    
    # Stripe fields
    stripe_payment_intent_id: Mapped[str | None] = mapped_column(String(255), nullable=True, unique=True, index=True)
    stripe_session_id: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    stripe_customer_email: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    currency: Mapped[str] = mapped_column(String(3), default="PLN", nullable=False)
    stripe_fee: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)  # Комісія Stripe
    net_amount: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)  # Нетто-сума після комісії
    card_brand: Mapped[str | None] = mapped_column(String(50), nullable=True)  # Visa, Mastercard, etc.
    card_last4: Mapped[str | None] = mapped_column(String(4), nullable=True)  # Останні 4 цифри картки
    stripe_receipt_url: Mapped[str | None] = mapped_column(Text, nullable=True)  # URL receipt від Stripe
    payment_status: Mapped[PaymentStatus | None] = mapped_column(String(50), nullable=True, index=True)  # Статус оплати
    stripe_payment_link_id: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)  # ID Payment Link
    
    order: Mapped["Order"] = relationship("Order", back_populates="transactions", lazy="joined")


class Shipment(Base):
    """Модель відправки - універсальна для різних типів доставок"""
    __tablename__ = "finance_shipments"
    
    id: Mapped[UUID] = mapped_column(PostgresUUID(as_uuid=True), primary_key=True, default=uuid4, index=True)
    order_id: Mapped[UUID] = mapped_column(PostgresUUID(as_uuid=True), ForeignKey("crm_orders.id"), nullable=False, index=True)
    
    # Метод доставки
    method: Mapped[ShipmentMethod] = mapped_column(String(50), nullable=False, index=True)
    
    # Tracking
    tracking_number: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    tracking_url: Mapped[str | None] = mapped_column(Text, nullable=True)  # Auto-generate для InPost
    
    # Статус
    status: Mapped[ShipmentStatus] = mapped_column(String(50), default=ShipmentStatus.CREATED, nullable=False, index=True)
    
    # Пачкомат (для inpost_locker)
    paczkomat_code: Mapped[str | None] = mapped_column(String(20), nullable=True)  # e.g. "WRO01M"
    
    # Адреса доставки (для кур'єра)
    delivery_address: Mapped[str | None] = mapped_column(Text, nullable=True)  # Повна адреса
    
    # Дані отримувача
    recipient_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    recipient_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    recipient_phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    
    # Вартість доставки
    shipping_cost: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)  # 13.99 zł для InPost
    
    # URL етикетки
    label_url: Mapped[str | None] = mapped_column(Text, nullable=True)  # URL етикетки InPost
    
    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    shipped_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    delivered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    
    # InPost shipment ID (якщо створено через InPost API)
    inpost_shipment_id: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    
    # Relationship
    order: Mapped["Order"] = relationship("Order", back_populates="shipments", lazy="joined")

