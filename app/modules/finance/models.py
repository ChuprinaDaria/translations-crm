from uuid import UUID, uuid4
from enum import Enum
from datetime import date, datetime
from decimal import Decimal
from typing import TYPE_CHECKING
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
    
    order: Mapped["Order"] = relationship("Order", back_populates="transactions", lazy="joined")

