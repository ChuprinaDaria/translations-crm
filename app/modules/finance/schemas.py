from uuid import UUID
from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from pydantic import BaseModel
from modules.finance.models import PaymentMethod


class TransactionCreate(BaseModel):
    order_id: UUID
    amount_gross: Decimal
    payment_date: date
    service_date: date
    receipt_number: str
    payment_method: PaymentMethod
    notes: Optional[str] = None


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

