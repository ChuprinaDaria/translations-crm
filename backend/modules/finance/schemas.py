from uuid import UUID
from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from pydantic import BaseModel
from modules.finance.models import PaymentMethod, PaymentStatus, ShipmentMethod, ShipmentStatus


class TransactionCreate(BaseModel):
    order_id: UUID
    amount_gross: Decimal
    payment_date: date
    service_date: date
    receipt_number: str
    payment_method: PaymentMethod
    notes: Optional[str] = None
    # Stripe fields (optional)
    stripe_payment_intent_id: Optional[str] = None
    stripe_session_id: Optional[str] = None
    stripe_customer_email: Optional[str] = None
    currency: Optional[str] = "PLN"
    stripe_fee: Optional[Decimal] = None
    net_amount: Optional[Decimal] = None
    card_brand: Optional[str] = None
    card_last4: Optional[str] = None
    stripe_receipt_url: Optional[str] = None
    payment_status: Optional[PaymentStatus] = None
    stripe_payment_link_id: Optional[str] = None


class TransactionRead(BaseModel):
    id: UUID
    order_id: UUID
    amount_gross: Decimal
    payment_date: date
    service_date: date
    receipt_number: str
    payment_method: PaymentMethod
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    # Stripe fields
    stripe_payment_intent_id: Optional[str] = None
    stripe_session_id: Optional[str] = None
    stripe_customer_email: Optional[str] = None
    currency: Optional[str] = "PLN"
    stripe_fee: Optional[Decimal] = None
    net_amount: Optional[Decimal] = None
    card_brand: Optional[str] = None
    card_last4: Optional[str] = None
    stripe_receipt_url: Optional[str] = None
    payment_status: Optional[PaymentStatus] = None
    stripe_payment_link_id: Optional[str] = None
    
    class Config:
        from_attributes = True


class StatsSchema(BaseModel):
    total_revenue: Decimal
    total_transactions: int
    revenue_by_method: dict[str, Decimal]
    revenue_by_date_range: dict[str, Decimal]
    average_transaction_amount: Decimal
    period_start: date
    period_end: date


class ShipmentCreate(BaseModel):
    order_id: UUID
    method: ShipmentMethod
    tracking_number: Optional[str] = None
    paczkomat_code: Optional[str] = None
    delivery_address: Optional[str] = None
    recipient_name: Optional[str] = None
    recipient_email: Optional[str] = None
    recipient_phone: Optional[str] = None
    shipping_cost: Optional[Decimal] = None
    create_inpost_shipment: Optional[bool] = False  # Створити відправку через InPost API одразу


class ShipmentUpdate(BaseModel):
    tracking_number: Optional[str] = None
    status: Optional[ShipmentStatus] = None
    paczkomat_code: Optional[str] = None
    delivery_address: Optional[str] = None
    recipient_name: Optional[str] = None
    recipient_email: Optional[str] = None
    recipient_phone: Optional[str] = None
    shipping_cost: Optional[Decimal] = None
    label_url: Optional[str] = None
    shipped_at: Optional[datetime] = None
    delivered_at: Optional[datetime] = None
    inpost_shipment_id: Optional[str] = None


class ShipmentRead(BaseModel):
    id: UUID
    order_id: UUID
    method: ShipmentMethod
    tracking_number: Optional[str] = None
    tracking_url: Optional[str] = None
    status: ShipmentStatus
    paczkomat_code: Optional[str] = None
    delivery_address: Optional[str] = None
    recipient_name: Optional[str] = None
    recipient_email: Optional[str] = None
    recipient_phone: Optional[str] = None
    shipping_cost: Optional[Decimal] = None
    label_url: Optional[str] = None
    created_at: datetime
    shipped_at: Optional[datetime] = None
    delivered_at: Optional[datetime] = None
    inpost_shipment_id: Optional[str] = None
    # Order info
    order_number: Optional[str] = None
    
    class Config:
        from_attributes = True

