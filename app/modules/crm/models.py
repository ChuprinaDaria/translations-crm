from uuid import UUID, uuid4
from enum import Enum
from datetime import datetime
from typing import TYPE_CHECKING
from sqlalchemy import String, DateTime, ForeignKey
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
    META = "meta"
    TG = "tg"
    MANUAL = "manual"


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
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    
    client: Mapped["Client"] = relationship("Client", back_populates="orders", lazy="joined")
    manager: Mapped["User"] = relationship("User", back_populates="orders", lazy="joined")
    transactions: Mapped[list["Transaction"]] = relationship("Transaction", back_populates="order", lazy="selectin", cascade="all, delete-orphan")

