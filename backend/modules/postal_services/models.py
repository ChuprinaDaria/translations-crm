"""
Postal Services Models - InPost shipments and tracking.
"""
from datetime import datetime
from typing import Optional, Dict, Any, TYPE_CHECKING
from sqlalchemy import String, Boolean, Integer, Text, DateTime, ForeignKey, Enum as SQLEnum
from sqlalchemy.types import JSON
from sqlalchemy.dialects.postgresql import JSONB, UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
from uuid import UUID, uuid4
import enum

from core.db import Base

if TYPE_CHECKING:
    from modules.crm.models import Order


class ShipmentStatus(str, enum.Enum):
    """InPost shipment status enumeration."""
    CREATED = "created"  # Створено в системі
    CONFIRMED = "confirmed"  # Підтверджено в InPost
    DISPATCHED_BY_SENDER = "dispatched_by_sender"  # Відправлено відправником
    COLLECTED_FROM_SENDER = "collected_from_sender"  # Забрано від відправника
    TAKEN_BY_COURIER = "taken_by_courier"  # Взято кур'єром
    ADOPTED_AT_SOURCE_BRANCH = "adopted_at_source_branch"  # Прийнято на відділенні
    SENT_FROM_SOURCE_BRANCH = "sent_from_source_branch"  # Відправлено з відділення
    READY_TO_PICKUP = "ready_to_pickup"  # Готово до отримання
    OUT_FOR_DELIVERY = "out_for_delivery"  # Доставляється
    DELIVERED = "delivered"  # Доставлено
    PICKUP_REMINDER_SENT = "pickup_reminder_sent"  # Надіслано нагадування
    RETURNED_TO_SENDER = "returned_to_sender"  # Повернено відправнику
    AVIZO = "avizo"  # Не вдалося доставити
    CANCELED = "canceled"  # Скасовано
    ERROR = "error"  # Помилка


class DeliveryType(str, enum.Enum):
    """Delivery type enumeration."""
    PARCEL_LOCKER = "parcel_locker"  # Пачкомат
    COURIER = "courier"  # Кур'єр
    POP = "pop"  # Відділення


class InPostShipment(Base):
    """InPost shipment model."""
    __tablename__ = "inpost_shipments"

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
        index=True
    )
    
    # Order reference
    order_id: Mapped[Optional[UUID]] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("crm_orders.id", ondelete="CASCADE"),
        nullable=True,
        index=True
    )
    
    # InPost shipment ID
    shipment_id: Mapped[Optional[str]] = mapped_column(
        String(100),
        nullable=True,
        index=True,
        comment="InPost shipment ID"
    )
    
    tracking_number: Mapped[Optional[str]] = mapped_column(
        String(100),
        nullable=True,
        index=True,
        comment="Tracking number"
    )
    
    # Delivery info
    delivery_type: Mapped[str] = mapped_column(
        SQLEnum(DeliveryType),
        nullable=False,
        default=DeliveryType.PARCEL_LOCKER
    )
    
    # Parcel locker
    parcel_locker_code: Mapped[Optional[str]] = mapped_column(
        String(20),
        nullable=True,
        comment="Parcel locker code (e.g., KRA010)"
    )
    
    # Courier address
    courier_address: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        comment="Full delivery address for courier"
    )
    
    courier_street: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    courier_building_number: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    courier_flat_number: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    courier_city: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    courier_post_code: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    courier_country: Mapped[Optional[str]] = mapped_column(String(2), nullable=True, default="PL")
    
    # Receiver info
    receiver_email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    receiver_phone: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    receiver_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    
    # Sender info
    sender_email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    sender_phone: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    sender_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    
    # Package info
    package_size: Mapped[Optional[str]] = mapped_column(
        String(20),
        nullable=True,
        default="small",
        comment="Package size: small, medium, large"
    )
    
    package_weight: Mapped[Optional[float]] = mapped_column(
        nullable=True,
        comment="Package weight in kg"
    )
    
    # Insurance
    insurance_amount: Mapped[Optional[float]] = mapped_column(
        nullable=True,
        comment="Insurance amount in PLN"
    )
    
    # COD (Cash on Delivery)
    cod_amount: Mapped[Optional[float]] = mapped_column(
        nullable=True,
        comment="COD amount in PLN"
    )
    
    # Status
    status: Mapped[str] = mapped_column(
        SQLEnum(ShipmentStatus),
        nullable=False,
        default=ShipmentStatus.CREATED,
        index=True
    )
    
    status_description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    # Tracking URL
    tracking_url: Mapped[Optional[str]] = mapped_column(
        String(500),
        nullable=True,
        comment="Public tracking URL"
    )
    
    # Label
    label_url: Mapped[Optional[str]] = mapped_column(
        String(500),
        nullable=True,
        comment="Shipping label PDF URL"
    )
    
    # Cost
    cost: Mapped[Optional[float]] = mapped_column(
        nullable=True,
        comment="Shipment cost in PLN"
    )
    
    # Response from InPost API
    inpost_response: Mapped[Optional[Dict[str, Any]]] = mapped_column(
        JSON().with_variant(JSONB, "postgresql"),
        nullable=True,
        default=dict
    )
    
    # Status history
    status_history: Mapped[Optional[list[Dict[str, Any]]]] = mapped_column(
        JSON().with_variant(JSONB, "postgresql"),
        nullable=True,
        default=list
    )
    
    # Error info
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )
    
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False
    )
    
    dispatched_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="When shipment was dispatched"
    )
    
    delivered_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="When shipment was delivered"
    )
    
    # Relationships
    order: Mapped[Optional["Order"]] = relationship(
        "Order",
        back_populates="inpost_shipments",
        foreign_keys=[order_id]
    )
    
    def __repr__(self) -> str:
        return f"<InPostShipment(id={self.id}, tracking={self.tracking_number}, status={self.status})>"


class InPostSettings(Base):
    """InPost API settings model."""
    __tablename__ = "inpost_settings"
    
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    
    # API Configuration
    api_key: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
        comment="InPost API key (Organization token)"
    )
    
    organization_id: Mapped[Optional[str]] = mapped_column(
        String(100),
        nullable=True,
        comment="InPost Organization ID for ShipX API"
    )
    
    api_url: Mapped[str] = mapped_column(
        String(500),
        nullable=False,
        default="https://api-shipx-pl.easypack24.net/v1",
        comment="InPost API base URL"
    )
    
    # Sandbox mode
    sandbox_mode: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
        comment="Use sandbox API for testing"
    )
    
    sandbox_api_key: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
        comment="InPost sandbox API key"
    )
    
    sandbox_api_url: Mapped[str] = mapped_column(
        String(500),
        nullable=False,
        default="https://sandbox-api-shipx-pl.easypack24.net/v1",
        comment="InPost sandbox API URL"
    )
    
    # Webhook
    webhook_url: Mapped[Optional[str]] = mapped_column(
        String(500),
        nullable=True,
        comment="Webhook URL for status updates"
    )
    
    webhook_secret: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        comment="Webhook secret for verification"
    )
    
    # Default sender info
    default_sender_email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    default_sender_phone: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    default_sender_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    
    # Enable/Disable
    is_enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    
    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )
    
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False
    )
    
    def __repr__(self) -> str:
        return f"<InPostSettings(id={self.id}, enabled={self.is_enabled})>"

