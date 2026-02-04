"""
Payment models for Stripe and Przelewy24 integration.
"""
from uuid import UUID, uuid4
from enum import Enum
from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING, Optional
from sqlalchemy import String, Text, ForeignKey, Numeric, DateTime, Boolean, Integer
from sqlalchemy.sql import func
from sqlalchemy.dialects.postgresql import UUID as PostgresUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from core.db import Base

if TYPE_CHECKING:
    from modules.crm.models import Order


class PaymentProvider(str, Enum):
    """Payment provider types."""
    STRIPE = "stripe"
    PRZELEWY24 = "przelewy24"


class PaymentStatus(str, Enum):
    """Payment transaction status."""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    REFUNDED = "refunded"
    CANCELLED = "cancelled"


class PaymentMethodType(str, Enum):
    """Payment method types."""
    # Stripe
    CARD = "card"
    SEPA = "sepa"
    # Przelewy24
    P24_TRANSFER = "p24_transfer"
    P24_CARD = "p24_card"
    P24_BLIK = "p24_blik"
    P24_APPLE_PAY = "p24_apple_pay"
    P24_GOOGLE_PAY = "p24_google_pay"
    P24_PAYPO = "p24_paypo"
    P24_INSTALLMENTS = "p24_installments"


class PaymentSettings(Base):
    """Payment settings for the organization."""
    __tablename__ = "payment_settings"
    
    id: Mapped[UUID] = mapped_column(PostgresUUID(as_uuid=True), primary_key=True, default=uuid4)
    
    # Stripe settings
    stripe_enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    stripe_public_key: Mapped[str | None] = mapped_column(String(255), nullable=True)
    stripe_secret_key: Mapped[str | None] = mapped_column(Text, nullable=True)  # Encrypted
    stripe_webhook_secret: Mapped[str | None] = mapped_column(Text, nullable=True)  # Encrypted
    
    # Przelewy24 settings
    przelewy24_enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    przelewy24_merchant_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    przelewy24_pos_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    przelewy24_crc: Mapped[str | None] = mapped_column(Text, nullable=True)  # Encrypted
    przelewy24_api_key: Mapped[str | None] = mapped_column(Text, nullable=True)  # Encrypted (secretId)
    przelewy24_sandbox: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    
    # General settings
    default_currency: Mapped[str] = mapped_column(String(3), default="PLN", nullable=False)
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


class PaymentTransaction(Base):
    """Payment transaction record."""
    __tablename__ = "payment_transactions"
    
    id: Mapped[UUID] = mapped_column(PostgresUUID(as_uuid=True), primary_key=True, default=uuid4, index=True)
    order_id: Mapped[UUID] = mapped_column(PostgresUUID(as_uuid=True), ForeignKey("crm_orders.id"), nullable=False, index=True)
    
    # Payment details
    provider: Mapped[PaymentProvider] = mapped_column(String(50), nullable=False, index=True)
    status: Mapped[PaymentStatus] = mapped_column(String(50), default=PaymentStatus.PENDING, nullable=False, index=True)
    payment_method: Mapped[PaymentMethodType | None] = mapped_column(String(50), nullable=True)
    
    # Amount
    amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default="PLN", nullable=False)
    
    # Provider-specific IDs
    session_id: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)  # Unique internal ID
    provider_transaction_id: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)  # Stripe Payment Intent ID or P24 orderId
    provider_token: Mapped[str | None] = mapped_column(Text, nullable=True)  # P24 token for redirect
    
    # URLs
    payment_url: Mapped[str | None] = mapped_column(Text, nullable=True)  # Payment link
    return_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    webhook_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    
    # Customer info
    customer_email: Mapped[str] = mapped_column(String(255), nullable=False)
    customer_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    
    # Metadata
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    metadata: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON string
    
    # Error handling
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    
    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    
    # Relationships
    order: Mapped["Order"] = relationship("Order", back_populates="payment_transactions", lazy="joined")


class PaymentLink(Base):
    """Payment link sent to customer."""
    __tablename__ = "payment_links"
    
    id: Mapped[UUID] = mapped_column(PostgresUUID(as_uuid=True), primary_key=True, default=uuid4, index=True)
    transaction_id: Mapped[UUID] = mapped_column(PostgresUUID(as_uuid=True), ForeignKey("payment_transactions.id"), nullable=False, index=True)
    order_id: Mapped[UUID] = mapped_column(PostgresUUID(as_uuid=True), ForeignKey("crm_orders.id"), nullable=False, index=True)
    
    # Link details
    link_url: Mapped[str] = mapped_column(Text, nullable=False)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    is_used: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    
    # Who sent the link
    sent_by_user_id: Mapped[UUID] = mapped_column(PostgresUUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    sent_to_email: Mapped[str] = mapped_column(String(255), nullable=False)
    
    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    
    # Relationships
    transaction: Mapped["PaymentTransaction"] = relationship("PaymentTransaction", lazy="joined")
    order: Mapped["Order"] = relationship("Order", lazy="joined")

