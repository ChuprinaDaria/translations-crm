"""
Payment schemas for request/response validation.
"""
from uuid import UUID
from datetime import datetime
from decimal import Decimal
from typing import Optional, Dict, Any
from pydantic import BaseModel, EmailStr, Field, field_validator
from modules.payment.models import PaymentProvider, PaymentStatus, PaymentMethodType


# Settings Schemas
class PaymentSettingsBase(BaseModel):
    """Base settings schema."""
    # Stripe
    stripe_enabled: bool = False
    stripe_public_key: Optional[str] = None
    stripe_secret_key: Optional[str] = None
    stripe_webhook_secret: Optional[str] = None
    
    # Przelewy24
    przelewy24_enabled: bool = False
    przelewy24_merchant_id: Optional[int] = None
    przelewy24_pos_id: Optional[int] = None
    przelewy24_crc: Optional[str] = None
    przelewy24_api_key: Optional[str] = None
    przelewy24_sandbox: bool = True
    
    # General
    default_currency: str = "PLN"
    active_payment_provider: Optional[PaymentProvider] = None  # Активна система оплати (stripe або przelewy24)


class PaymentSettingsCreate(PaymentSettingsBase):
    """Create payment settings."""
    pass


class PaymentSettingsUpdate(BaseModel):
    """Update payment settings (all fields optional)."""
    # Stripe
    stripe_enabled: Optional[bool] = None
    stripe_public_key: Optional[str] = None
    stripe_secret_key: Optional[str] = None
    stripe_webhook_secret: Optional[str] = None
    
    # Przelewy24
    przelewy24_enabled: Optional[bool] = None
    przelewy24_merchant_id: Optional[int] = None
    przelewy24_pos_id: Optional[int] = None
    przelewy24_crc: Optional[str] = None
    przelewy24_api_key: Optional[str] = None
    przelewy24_sandbox: Optional[bool] = None
    
    # General
    default_currency: Optional[str] = None
    active_payment_provider: Optional[PaymentProvider] = None  # Активна система оплати (stripe або przelewy24)


class PaymentSettingsRead(PaymentSettingsBase):
    """Read payment settings (without sensitive data for non-admin users)."""
    id: UUID
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class PaymentSettingsReadSecure(PaymentSettingsRead):
    """Read payment settings with sensitive data (admin only)."""
    pass


# Transaction Schemas
class PaymentTransactionCreate(BaseModel):
    """Create payment transaction."""
    order_id: UUID
    provider: PaymentProvider
    amount: Decimal = Field(gt=0)
    currency: str = "PLN"
    customer_email: EmailStr
    customer_name: Optional[str] = None
    description: Optional[str] = None
    payment_method: Optional[PaymentMethodType] = None
    return_url: Optional[str] = None


class PaymentTransactionRead(BaseModel):
    """Read payment transaction."""
    id: UUID
    order_id: UUID
    provider: PaymentProvider
    status: PaymentStatus
    payment_method: Optional[PaymentMethodType]
    amount: Decimal
    currency: str
    session_id: str
    provider_transaction_id: Optional[str]
    payment_url: Optional[str]
    customer_email: str
    customer_name: Optional[str]
    description: Optional[str]
    error_message: Optional[str]
    created_at: datetime
    updated_at: datetime
    completed_at: Optional[datetime]
    
    class Config:
        from_attributes = True


class PaymentTransactionUpdate(BaseModel):
    """Update payment transaction status."""
    status: Optional[PaymentStatus] = None
    provider_transaction_id: Optional[str] = None
    payment_method: Optional[PaymentMethodType] = None
    error_message: Optional[str] = None
    completed_at: Optional[datetime] = None


# Payment Link Schemas
class PaymentLinkCreate(BaseModel):
    """Create payment link."""
    order_id: UUID
    provider: PaymentProvider
    amount: Decimal = Field(gt=0)
    currency: str = "PLN"
    customer_email: EmailStr
    customer_name: Optional[str] = None
    description: Optional[str] = None
    expires_at: Optional[datetime] = None


class PaymentLinkRead(BaseModel):
    """Read payment link."""
    id: UUID
    transaction_id: UUID
    order_id: UUID
    link_url: str
    expires_at: Optional[datetime]
    is_used: bool
    sent_by_user_id: UUID
    sent_to_email: str
    created_at: datetime
    used_at: Optional[datetime]
    
    class Config:
        from_attributes = True


# Przelewy24 Specific Schemas
class P24TransactionRegisterRequest(BaseModel):
    """Przelewy24 transaction register request."""
    order_id: UUID
    amount: Decimal = Field(gt=0)
    currency: str = "PLN"
    customer_email: EmailStr
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    customer_address: Optional[str] = None
    customer_city: Optional[str] = None
    customer_zip: Optional[str] = None
    customer_country: str = "PL"
    description: str
    method: Optional[int] = None  # P24 payment method ID
    channel: Optional[int] = None  # P24 channel filter
    language: str = "pl"


class P24TransactionRegisterResponse(BaseModel):
    """Przelewy24 transaction register response."""
    token: str
    payment_url: str


class P24NotificationWebhook(BaseModel):
    """Przelewy24 notification webhook payload."""
    merchantId: int
    posId: int
    sessionId: str
    amount: int
    originAmount: int
    currency: str
    orderId: int
    methodId: int
    statement: str
    sign: str


class P24VerifyRequest(BaseModel):
    """Przelewy24 verify request."""
    merchantId: int
    posId: int
    sessionId: str
    amount: int
    currency: str
    orderId: int
    sign: str


# Stripe Specific Schemas
class StripePaymentIntentRequest(BaseModel):
    """Stripe payment intent request."""
    order_id: UUID
    amount: Decimal = Field(gt=0)
    currency: str = "pln"
    customer_email: EmailStr
    customer_name: Optional[str] = None
    description: Optional[str] = None
    payment_method_types: list[str] = ["card"]


class StripePaymentIntentResponse(BaseModel):
    """Stripe payment intent response."""
    client_secret: str
    payment_intent_id: str


class StripeWebhookEvent(BaseModel):
    """Stripe webhook event."""
    id: str
    type: str
    data: Dict[str, Any]


# Payment Methods Response
class PaymentMethodsResponse(BaseModel):
    """Available payment methods response."""
    stripe_enabled: bool
    przelewy24_enabled: bool
    available_methods: list[PaymentMethodType]
    default_currency: str


# Payment Statistics
class PaymentStatsResponse(BaseModel):
    """Payment statistics response."""
    total_transactions: int
    total_amount: Decimal
    successful_transactions: int
    failed_transactions: int
    pending_transactions: int
    by_provider: Dict[str, int]
    by_status: Dict[str, int]
    period_start: datetime
    period_end: datetime

